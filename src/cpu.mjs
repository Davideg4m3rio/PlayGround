import { blankInput } from './input-model.mjs'
import { clamp } from './utils.mjs'

const DIFFICULTY = {
  easy: { react: 24, block: 0.22, parry: 0.02, aggression: 0.4, combo: 1, special: 0.18, think: 20 },
  normal: { react: 13, block: 0.5, parry: 0.07, aggression: 0.66, combo: 2, special: 0.32, think: 11 },
  hard: { react: 6, block: 0.78, parry: 0.18, aggression: 0.88, combo: 3, special: 0.48, think: 5 },
}

function freshMemory() {
  return {
    plan: null, frames: 0, step: 0, wait: 0, cool: 0,
    lastFoeMove: null, react: 0, guardLow: false, jumpPressed: false,
  }
}

export function createCpuMemory() {
  return freshMemory()
}

function setPlan(mem, plan, frames) {
  mem.plan = plan
  mem.frames = frames
  mem.step = 0
  mem.wait = plan.wait || 0
  mem.cool = plan.cool || 0
}

function planar(mem, me, foe, difficulty, battle) {
  const d = DIFFICULTY[difficulty] || DIFFICULTY.normal
  const rng = battle.rng
  const dist = Math.abs(foe.x - me.x)
  const dir = foe.x > me.x ? 1 : -1
  const lowHealth = me.health / me.maxHealth < 0.34
  const team = me.team
  const bench = team.members.filter((m) => m !== me && m.health > 0 && m.alive)
  const canAwaken = team.meter >= 300 && me.awakening <= 0
  const canSuper = team.meter >= 100
  const canAssist = team.meter >= 50 && team.assistCooldown <= 0 && bench.length > 0
  const canTag = team.tagCooldown <= 0 && bench.length > 0
  const rand = rng()

  if (canAwaken && (lowHealth || rand < 0.25)) return { type: 'awaken', frames: 8 }
  if (canTag && (lowHealth && rand < 0.68 || rand < 0.06)) return { type: 'tag', frames: 8 }
  if (canAssist && dist < 380 && rand < 0.2 + d.aggression * 0.15) return { type: 'assist', frames: 14 }
  if (canSuper && dist < 300 && rand < 0.12 + d.aggression * 0.18) return { type: 'super', frames: 20 }
  if (lowHealth && dist > 380 && rand < 0.3) return { type: 'retreat', frames: 18 }

  if (foe.airborne && dist < 250 && rand < 0.55) {
    return { type: 'antiair', frames: 18 }
  }

  if (dist > 520) {
    if (rand < 0.3 && (me.char.id === 'frost' || me.char.id === 'volt' || me.char.id === 'kaze')) return { type: 'projectile', frames: 22 }
    return { type: 'approach', frames: 18 + Math.floor(rng() * 16), dash: rng() < 0.45 }
  }
  if (dist > 230) {
    if (rand < 0.24) return { type: 'projectile', frames: 20 }
    if (rand < 0.2) return { type: 'jumpin', frames: 34 }
    return { type: 'approach', frames: 12 + Math.floor(rng() * 14), dash: rng() < 0.38 }
  }
  if (dist > 110) {
    if (rand < 0.3) return { type: 'approach', frames: 9, dash: rng() < 0.55 }
    if (rand < 0.22) return { type: 'jumpin', frames: 30 }
    if (rand < 0.36 && canAssist) return { type: 'assist', frames: 12 }
    return { type: 'attack', frames: 40, wait: 0, sequence: buildSequence(me, d, rng) }
  }
  if (rand < 0.16) return { type: 'throw', frames: 12 }
  if (rand < 0.1) return { type: 'retreat', frames: 12 }
  return { type: 'attack', frames: 44, wait: 0, sequence: buildSequence(me, d, rng) }
}

function buildSequence(me, d, rng) {
  const seq = ['light', 'medium', 'heavy']
  if (d.combo >= 2) seq.push('special')
  if (d.combo >= 3 && me.team.meter >= 100) seq.push('super')
  if (rng() < 0.2) seq.unshift('dash')
  return seq
}

export function cpuInput(battle, side, difficulty, mem) {
  const input = blankInput()
  const team = battle.teams[side]
  const me = team.active
  const foe = battle.teams[1 - side].active
  if (!me || !foe || me.ko) return input
  const d = DIFFICULTY[difficulty] || DIFFICULTY.normal
  const dist = Math.abs(foe.x - me.x)
  const dir = foe.x > me.x ? 1 : -1
  const rng = battle.rng

  if (mem.cool > 0) mem.cool--
  if (mem.react > 0) mem.react--

  if (me.state === 'hitstun' && me.airborne) {
    if (me.stateTime > 14 && !mem.jumpPressed) {
      input.pressed.up = true
      mem.jumpPressed = true
    }
    return input
  }
  if (me.state !== 'hitstun') mem.jumpPressed = false

  const foeMoveId = foe.state === 'attack' ? foe.move && foe.move.id : null
  if (foeMoveId && mem.lastFoeMove !== foeMoveId && mem.react <= 0 && dist < 240) {
    mem.react = d.react
    mem.lastFoeMove = foeMoveId
    const threat = foe.move
    const blockRoll = rng()
    if (blockRoll < d.block) {
      mem.guardLow = threat && threat.guard === 'low' ? true : false
      setPlan(mem, { type: 'block', wait: d.react }, 13 + Math.floor(rng() * 12))
    } else if (blockRoll < d.block + d.parry) {
      setPlan(mem, { type: 'parry' }, 10)
    } else if (blockRoll < d.block + d.parry + 0.1) {
      setPlan(mem, { type: 'dodge' }, 12)
    }
  }
  if (!foeMoveId) mem.lastFoeMove = null

  if (!mem.plan) {
    if (me.state === 'attack' || me.state === 'hitstun' || me.state === 'blockstun' || me.state === 'knockdown') {
      return input
    }
    mem.plan = planar(mem, me, foe, difficulty, battle)
    mem.frames = mem.plan.frames
    mem.step = 0
    mem.wait = mem.plan.wait || 0
  }

  const plan = mem.plan
  if (mem.wait > 0) mem.wait--
  mem.frames--
  if (mem.frames <= 0 && plan.type !== 'attack') mem.plan = null

  switch (plan.type) {
    case 'approach':
      if (dist > 68) input[dir > 0 ? 'right' : 'left'] = true
      if (plan.dash && mem.frames === plan.frames - 2 && dist > 100) input.pressed.dash = true
      if (dist < 120 && mem.frames < plan.frames - 4 && rng() < 0.12) mem.plan = null
      break
    case 'retreat':
      input[dir > 0 ? 'left' : 'right'] = true
      break
    case 'block':
      input[dir > 0 ? 'left' : 'right'] = true
      input.block = true
      if (mem.guardLow) input.down = true
      break
    case 'parry':
      if (mem.frames === plan.frames - 1) input.pressed.parry = true
      break
    case 'dodge':
      if (mem.frames === plan.frames - 1) input.pressed.dodge = true
      break
    case 'throw':
      if (mem.frames === plan.frames - 1) input.pressed.throw = true
      if (dist > 64) input[dir > 0 ? 'right' : 'left'] = true
      break
    case 'projectile':
      if (mem.frames === plan.frames - 2) input.pressed.special = true
      break
    case 'super':
      if (mem.frames === plan.frames - 2) input.pressed.super = true
      break
    case 'assist':
      if (mem.frames === plan.frames - 2) input.pressed.assist = true
      break
    case 'tag':
      if (mem.frames === plan.frames - 1) input.pressed.tag = true
      break
    case 'awaken':
      if (mem.frames === plan.frames - 1) input.pressed.awaken = true
      break
    case 'antiair':
      if (mem.frames === plan.frames - 1) {
        if (rng() < 0.5) input.pressed.special = true
        else input.pressed.heavy = true
      }
      break
    case 'jumpin':
      if (mem.frames === plan.frames - 1) input.pressed.up = true
      if (dist > 60) input[dir > 0 ? 'right' : 'left'] = true
      if (me.airborne && mem.frames < plan.frames - 8 && mem.frames > plan.frames - 24) {
        if (mem.frames === plan.frames - 10) input.pressed.heavy = true
      }
      break
    case 'attack': {
      const seq = plan.sequence
      if (mem.wait > 0) break
      if (mem.step >= seq.length) {
        if (me.state !== 'attack' && rng() < 0.3) mem.plan = null
        break
      }
      const next = seq[mem.step]
      if (me.state === 'attack' && me.connected) {
        input.pressed[next] = true
        mem.step++
        mem.wait = 2
      } else if (me.state !== 'attack') {
        if (next === 'dash') {
          input.pressed.dash = true
          mem.step++
          mem.wait = 4
        } else {
          input.pressed[next] = true
          mem.step++
          mem.wait = 5
        }
      } else if (dist > 80) {
        input[dir > 0 ? 'right' : 'left'] = true
      }
      break
    }
    default:
      break
  }

  if (me.state !== 'attack' && me.state !== 'hitstun' && me.state !== 'blockstun' && me.state !== 'knockdown') {
    if (dist > 70 && plan.type !== 'block' && plan.type !== 'retreat' && plan.type !== 'approach' && plan.type !== 'attack' && plan.type !== 'jumpin') {
      input[dir > 0 ? 'right' : 'left'] = true
    }
  }

  if (clamp(dist, 0, 1) === 0) input.block = true
  return input
}
