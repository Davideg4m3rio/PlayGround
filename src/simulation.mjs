import { clamp, mulberry32, overlap, sign } from './utils.mjs'
import { ROSTER_BY_ID, getMoves } from './roster.mjs'
import { stageById } from './stages.mjs'
import { blankInput, normalizeInput } from './input-model.mjs'
import { cpuInput, createCpuMemory } from './cpu.mjs'

export const GRAVITY = 0.74
export const STAGE_LIMIT = 1220
export const MAX_JUGGLE = 5
const ROUND_FRAMES = 99 * 60
const FPS = 60

const landingKeys = { light: 'light', medium: 'medium', heavy: 'heavy' }

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function makeFighter(battle, side, index, char) {
  const f = {
    battle, side, index, char, moves: getMoves(char),
    name: char.name, id: char.id,
    x: 0, y: 0, vx: 0, vy: 0, facing: side === 0 ? 1 : -1,
    maxHealth: char.stats.health, health: char.stats.health,
    meter: 0, guard: 100, awakening: 0,
    state: 'idle', stateTime: 0, airborne: false, crouching: false,
    move: null, moveFrame: 0, hitTargets: new Set(), multiTick: 0, finalHit: false,
    connected: false, chainWindow: 0, hitstop: 0,
    hitstun: 0, blockstun: 0, invuln: 0, moveInvuln: false,
    juggle: 0, airTechUsed: false, pendingKnockdown: false, hardKnockdown: false,
    comboEater: 0, throwVictim: null, throwTimer: 0, grabbedBy: null, grabbedTimer: 0,
    buffer: [], dashCooldown: 0, dodgeCooldown: 0, airDashUsed: false, doubleJumpUsed: false,
    slowFrames: 0, slowFactor: 1, parryWindow: 0,
    lastTapDir: 0, lastTapFrame: -99, blockStance: false, autoBlock: false,
    ko: false, alive: true, koHandled: false, tagTimer: 0, tagAttackDone: false,
    statStage: 0, trail: [], landingLag: 0, lastMoveId: '', lastMoveCount: 0,
    input: blankInput(), hitFlash: 0, superFlash: 0,
    knockdownTimer: 0, parryCooldown: 0, dashTimer: 0, dashDir: 1,
    projectileSpawned: false, wallBounceUsed: false, lastFacing: side === 0 ? 1 : -1,
  }
  return Object.assign(f, fighterMethods)
}

const fighterMethods = {
  opponent() {
    return this.battle.teams[1 - this.side].active
  },

  bufferRecent(key, frames) {
    return this.buffer.some((e) => e.key === key && this.battle.frame - e.frame <= frames)
  },

  takeBuffered(keys) {
    for (let i = this.buffer.length - 1; i >= 0; i--) {
      const e = this.buffer[i]
      if (keys.includes(e.key) && this.battle.frame - e.frame <= (e.frozen ? 20 : 7)) {
        this.buffer.splice(i, 1)
        return e.key
      }
    }
    return null
  },

  applyBufferedAttack(input) {
    const attackKeys = ['light', 'medium', 'heavy', 'special', 'super']
    if (attackKeys.some((k) => input.pressed[k])) return
    if (this.state === 'attack' || this.state === 'hitstun' || this.state === 'blockstun') return
    const key = this.takeBuffered(attackKeys)
    if (key) input.pressed[key] = true
  },

  isMoveInvuln() {
    if (this.state !== 'attack' || !this.move || !this.move.invuln) return false
    return this.moveFrame >= this.move.invuln[0] && this.moveFrame <= this.move.invuln[1]
  },

  ingestInput(raw) {
    this.input = normalizeInput(raw)
    this.captureBuffer()
  },

  captureBuffer() {
    const pressedMap = this.input.pressed || {}
    for (const key of ['light', 'medium', 'heavy', 'special', 'super', 'throw', 'parry', 'dodge', 'tag', 'assist', 'awaken', 'dash', 'up', 'left', 'right', 'down']) {
      if (pressedMap[key]) this.buffer.push({ key, frame: this.battle.frame, frozen: this.battle.freeze > 0 })
    }
    this.buffer = this.buffer.filter((e) => this.battle.frame - e.frame <= (e.frozen ? 22 : 8))
  },

  tickTimers() {
    const team = this.team
    if (team.tagCooldown > 0) team.tagCooldown--
    if (team.assistCooldown > 0) team.assistCooldown--
    if (this.dashCooldown > 0) this.dashCooldown--
    if (this.dodgeCooldown > 0) this.dodgeCooldown--
    if (this.parryCooldown > 0) this.parryCooldown--
    if (this.invuln > 0) this.invuln--
    if (this.chainWindow > 0) this.chainWindow--
    if (this.hitFlash > 0) this.hitFlash--
    if (this.superFlash > 0) this.superFlash--
    if (this.landingLag > 0) this.landingLag--
    if (this.slowFrames > 0) {
      this.slowFrames--
      if (this.slowFrames === 0) this.slowFactor = 1
    }
    if (this.awakening > 0) {
      this.awakening--
      if (this.awakening === 0) this.battle.emit({ type: 'awakenEnd', side: this.side, x: this.x, y: this.y })
    }
    if (this.guard < 100 && this.state !== 'blockstun') this.guard = Math.min(100, this.guard + 0.16)
    team.guard = this.guard
    if (this.throwVictim) {
      this.throwTimer--
      if (this.throwTimer <= 0) this.battle.resolveThrowDamage(this)
    }
  },

  speedFactor() {
    let s = this.slowFrames > 0 ? this.slowFactor : 1
    if (this.awakening > 0) s *= this.char.awakening.speed
    return s
  },

  keyFor(type) {
    if (this.airborne) return 'air' + cap(type)
    if (this.crouching) return 'crouch' + cap(type)
    return type
  },

  tryStart(type) {
    const key = this.keyFor(type)
    const move = this.moves[key]
    if (!move) return false
    if (type === 'special' && this.airborne && !move.air) return false
    if (type === 'super' && this.airborne) return false
    return this.battle.executeMove(this, key)
  },

  startJump() {
    if (this.airborne) {
      if (this.doubleJumpUsed || this.state === 'attack') return false
      this.doubleJumpUsed = true
      this.vy = this.char.stats.jump * 0.92 * this.speedFactor()
      this.state = 'air'
      this.stateTime = 0
      this.battle.emit({ type: 'doubleJump', x: this.x, y: this.y, side: this.side })
      return true
    }
    if (this.landingLag > 0) return false
    this.vy = this.char.stats.jump * this.speedFactor()
    this.y = 0.01
    this.airborne = true
    this.crouching = false
    this.state = 'air'
    this.stateTime = 0
    this.doubleJumpUsed = false
    this.airDashUsed = false
    this.wallBounceUsed = false
    this.battle.emit({ type: 'jump', x: this.x, y: this.y, side: this.side })
    return true
  },

  startDash(dir) {
    if (this.dashCooldown > 0) return false
    const d = dir || this.facing
    if (this.airborne) {
      if (this.airDashUsed || this.state === 'attack') return false
      this.airDashUsed = true
      this.state = 'air'
      this.stateTime = 0
      this.vx = d * (this.char.stats.run + 3.2) * this.speedFactor()
      this.vy = 0
      this.dashCooldown = 18
      this.invuln = Math.max(this.invuln, 3)
      this.battle.emit({ type: 'airDash', x: this.x, y: this.y, side: this.side, dir: d })
      return true
    }
    this.state = 'dash'
    this.stateTime = 0
    this.dashTimer = 13
    this.dashDir = d
    this.vx = d * (this.char.stats.run + 2.6) * this.speedFactor()
    this.dashCooldown = 24
    this.invuln = Math.max(this.invuln, 2)
    this.battle.emit({ type: 'dash', x: this.x, y: this.y, side: this.side, dir: d })
    return true
  },

  startDodge(dir) {
    if (this.dodgeCooldown > 0 || this.airborne) return false
    this.state = 'dodge'
    this.stateTime = 0
    this.dodgeCooldown = 48
    this.invuln = Math.max(this.invuln, 17)
    this.vx = (dir || -this.facing) * 4.6
    this.battle.emit({ type: 'dodge', x: this.x, y: this.y, side: this.side })
    return true
  },

  startParry() {
    if (this.parryCooldown > 0 || this.airborne) return false
    this.state = 'parry'
    this.stateTime = 0
    this.parryWindow = 8
    this.parryCooldown = 22
    this.vx *= 0.2
    this.battle.emit({ type: 'parryWind', x: this.x, y: this.y, side: this.side })
    return true
  },

  handleAir(input) {
    this.crouching = false
    this.applyBufferedAttack(input)
    if (input.pressed.up) {
      if (this.startJump()) return
    }
    if (input.pressed.tag) { if (this.battle.tryTag(this.team)) return }
    if (input.pressed.assist) {
      if (this.battle.spawnAssist(this.team)) return
    }
    if (input.pressed.awaken) {
      if (this.battle.startAwakening(this)) return
    }
    if (input.pressed.super) { if (this.tryStart('super')) return }
    if (input.pressed.special) { if (this.tryStart('special')) return }
    if (input.pressed.heavy) { if (this.tryStart('heavy')) return }
    if (input.pressed.medium) { if (this.tryStart('medium')) return }
    if (input.pressed.light) { if (this.tryStart('light')) return }
    if (input.pressed.dash) { if (this.startDash(input.left ? -1 : input.right ? 1 : this.facing)) return }

    const dir = input.left ? -1 : input.right ? 1 : 0
    if (dir) {
      const accel = (this.char.stats.air + 0.2) * this.speedFactor()
      this.vx = clamp(this.vx + dir * 0.55, -accel * 1.5, accel * 1.5)
      this.state = 'air'
    }
  },

  handleGround(input) {
    this.applyBufferedAttack(input)
    if (input.down) {
      this.crouching = true
      this.state = 'crouch'
      this.vx *= 0.72
    } else {
      this.crouching = false
    }

    if (input.pressed.tag) { if (this.battle.tryTag(this.team)) return }
    if (input.pressed.assist) {
      if (this.battle.spawnAssist(this.team)) return
    }
    if (input.pressed.awaken) {
      if (this.battle.startAwakening(this)) return
    }
    if (input.pressed.parry) {
      if (this.startParry()) return
    }
    if (input.pressed.dodge) {
      if (this.startDodge(input.left ? -1 : input.right ? 1 : -this.facing)) return
    }
    if (input.pressed.throw) {
      if (this.tryStart('throw')) return
    }
    if (input.pressed.super) {
      if (this.tryStart('super')) return
    }
    if (input.pressed.special) {
      if (this.tryStart('special')) return
    }
    if (input.pressed.heavy) { if (this.tryStart('heavy')) return }
    if (input.pressed.medium) { if (this.tryStart('medium')) return }
    if (input.pressed.light) { if (this.tryStart('light')) return }

    if (input.pressed.up) {
      if (this.startJump()) return
    }
    if (input.pressed.dash) {
      if (this.startDash(input.left ? -1 : input.right ? 1 : this.facing)) return
    }

    const dir = input.left ? -1 : input.right ? 1 : 0
    if (dir) {
      if (input.pressed[dir < 0 ? 'left' : 'right']) {
        if (this.lastTapDir === dir && this.battle.frame - this.lastTapFrame <= 13) {
          this.lastTapDir = 0
          if (this.startDash(dir)) return
        } else {
          this.lastTapDir = dir
          this.lastTapFrame = this.battle.frame
        }
      }
    }

    const opponent = this.opponent()
    if (opponent && Math.abs(opponent.x - this.x) > 6) this.facing = opponent.x > this.x ? 1 : -1
    const away = this.facing > 0 ? 'left' : 'right'
    const guarding = input.block || (!!input[away] && opponent && (opponent.state === 'attack' || opponent.state === 'blockstun'))
    this.blockStance = !!guarding
    if (dir && !this.crouching) {
      const forward = dir === this.facing
      const speed = this.char.stats.walk * (forward ? 1 : 0.76) * this.speedFactor()
      this.vx = dir * speed
      this.state = 'walk'
    } else if (!this.crouching) {
      this.state = 'idle'
      this.vx *= 0.6
    }
  },

  handleAttack(input) {
    const move = this.move
    if (!move) {
      this.state = this.airborne ? 'air' : 'idle'
      return
    }
    this.moveFrame++
    if (this.moveFrame === move.startup) {
      this.hitTargets.clear()
      this.multiTick = 0
      this.finalHit = false
      this.connected = false
      if (move.projectile && !this.projectileSpawned) {
        this.battle.spawnProjectile(this, move)
        this.projectileSpawned = true
      }
      if (move.dash) this.vx = this.facing * move.dash
      if (move.rise) {
        this.airborne = true
        this.y = Math.max(this.y, 2)
        this.vy = move.rise
      }
      if (move.super) this.battle.addShake(4)
    }
    if (move.dash && this.moveFrame > move.startup && this.moveFrame < move.startup + move.active) {
      this.vx = this.facing * move.dash * 0.72
    }
    if (move.multi) {
      const idx = this.moveFrame - move.startup
      if (idx >= 0 && idx < move.active && idx % move.multi.interval === 0) {
        this.hitTargets.clear()
        this.multiTick++
        this.finalHit = this.multiTick >= move.multi.count
      }
    }
    if (move.teleportBehind && this.moveFrame === move.startup - 2) this.teleportBehind()
    if (move.jumpCancel && this.connected && input.pressed.up) {
      if (this.startJump()) return
    }
    if (move.dashCancel && this.connected && input.pressed.dash) {
      if (this.startDash(input.left ? -1 : input.right ? 1 : this.facing)) return
    }

    if (this.connected && this.chainWindow > 0) {
      if (!input.pressed.super && !input.pressed.special && !input.pressed.heavy && !input.pressed.medium && !input.pressed.light) {
        const buffered = this.takeBuffered(['light', 'medium', 'heavy', 'special', 'super'])
        if (buffered) input.pressed[buffered] = true
      }
      if (input.pressed.super && this.tryStart('super')) return
      if (input.pressed.special && this.tryStart('special')) return
      const pressedType = input.pressed.heavy ? 'heavy' : input.pressed.medium ? 'medium' : input.pressed.light ? 'light' : null
      if (pressedType) {
        const nextKey = this.keyFor(pressedType)
        const nextMove = this.moves[nextKey]
        if (nextMove && move.cancels.includes(nextMove.id)) {
          if (this.tryStart(pressedType)) return
        }
      }
    }

    const total = move.startup + move.active + move.recovery
    if (this.moveFrame >= total) {
      this.move = null
      this.state = this.airborne ? 'air' : 'idle'
      this.stateTime = 0
      this.hitTargets.clear()
      if (!this.airborne) this.landingLag = Math.max(this.landingLag, 2)
    }
  },

  teleportBehind() {
    const opponent = this.opponent()
    if (!opponent) return
    const target = opponent.x + this.facing * 88
    const side = target > STAGE_LIMIT - 50 ? opponent.x - this.facing * 88 : target
    this.x = clamp(side, -STAGE_LIMIT + 40, STAGE_LIMIT - 40)
    this.facing = opponent.x > this.x ? 1 : -1
    this.battle.emit({ type: 'teleport', x: this.x, y: this.y, side: this.side, color: this.char.color })
  },

  handleHitstun(input) {
    if (this.airborne) {
      if (this.stateTime > 16 && !this.airTechUsed && (input.pressed.parry || input.pressed.up || input.pressed.dodge)) {
        this.airTechUsed = true
        this.hitstun = 0
        this.state = 'air'
        this.stateTime = 0
        this.invuln = Math.max(this.invuln, 12)
        this.vy = Math.max(this.vy, 3.5)
        this.battle.emit({ type: 'airTech', x: this.x, y: this.y, side: this.side })
        return
      }
      if (this.hitstun > 0) this.hitstun--
      if (this.hitstun <= 0) {
        this.state = 'air'
        this.stateTime = 0
      }
      return
    }
    if (this.hitstun > 0) this.hitstun--
    if (this.hitstun <= 0) {
      if (this.pendingKnockdown) {
        this.state = 'knockdown'
        this.knockdownTimer = this.hardKnockdown ? 62 : 42
        this.stateTime = 0
      } else {
        this.state = 'idle'
        this.stateTime = 0
      }
    }
  },

  handleKnockdown() {
    this.knockdownTimer--
    this.vx *= 0.9
    if (this.knockdownTimer <= 0) {
      if (this.ko) {
        this.state = 'defeat'
        return
      }
      this.state = 'getup'
      this.stateTime = 0
      this.invuln = Math.max(this.invuln, 18)
      this.battle.emit({ type: 'getup', x: this.x, y: this.y, side: this.side })
    }
  },

  physics() {
    if (this.airborne) {
      this.vy -= GRAVITY
      this.vy = Math.max(this.vy, -21)
    }
    this.x += this.vx
    this.y += this.vy

    if (this.airborne) {
      if (this.state !== 'dash') this.vx *= 0.995
    } else if (!['walk', 'crouch', 'idle', 'dash'].includes(this.state)) {
      this.vx *= this.state === 'attack' ? 0.88 : 0.92
    }

    let wallHit = false
    if (this.x < -STAGE_LIMIT) {
      this.x = -STAGE_LIMIT
      wallHit = true
    } else if (this.x > STAGE_LIMIT) {
      this.x = STAGE_LIMIT
      wallHit = true
    }
    if (wallHit) {
      if (this.airborne && this.state === 'hitstun' && !this.wallBounceUsed && Math.abs(this.vx) > 7) {
        this.vx *= -0.68
        this.vy = Math.max(this.vy, 6.5)
        this.hitstun = Math.max(this.hitstun, 18)
        this.wallBounceUsed = true
        this.battle.emit({ type: 'wallBounce', x: this.x, y: this.y + 50, side: this.side })
        this.battle.addShake(5)
      } else {
        this.vx = 0
      }
    }

    if (this.y <= 0) {
      const wasAirborne = this.airborne
      this.y = 0
      this.vy = 0
      this.airborne = false
      this.doubleJumpUsed = false
      this.airDashUsed = false
      this.wallBounceUsed = false
      if (wasAirborne) {
        this.juggle = 0
        this.airTechUsed = false
        if (this.state === 'hitstun' || this.state === 'knockdown') {
          this.state = 'knockdown'
          this.knockdownTimer = this.hardKnockdown ? 60 : (this.pendingKnockdown ? 42 : 32)
          this.stateTime = 0
          this.pendingKnockdown = false
          this.battle.emit({ type: 'land', x: this.x, y: this.y, side: this.side, hard: this.hardKnockdown })
          this.battle.addShake(this.hardKnockdown ? 5 : 2)
        } else if (this.state === 'attack') {
          this.move = null
          this.state = 'idle'
          this.stateTime = 0
          this.landingLag = 6
          this.battle.emit({ type: 'land', x: this.x, y: this.y, side: this.side })
        } else if (this.state === 'defeat') {
          this.vx *= 0.4
        } else if (this.state !== 'dodge') {
          this.state = 'idle'
          this.stateTime = 0
          this.battle.emit({ type: 'land', x: this.x, y: this.y, side: this.side })
        }
      }
    }
  },

  update(rawInput) {
    this.input = normalizeInput(rawInput)
    this.stateTime++
    this.captureBuffer()
    this.tickTimers()

    if (this.state === 'grabbed') {
      const attacker = this.grabbedBy
      if (attacker) {
        this.x = attacker.x + attacker.facing * 30
        this.y = attacker.y
        this.facing = -attacker.facing
        this.grabbedTimer--
        if (this.grabbedTimer <= 0 || !attacker.throwVictim) {
          this.state = 'idle'
          this.grabbedBy = null
        }
      } else {
        this.state = 'idle'
      }
      this.physics()
      return
    }

    if (this.state === 'attack') {
      this.handleAttack(this.input)
      this.physics()
      return
    }

    if (this.state === 'hitstun') {
      this.handleHitstun(this.input)
      this.physics()
      return
    }

    if (this.state === 'blockstun') {
      if (this.blockstun > 0) this.blockstun--
      this.vx *= 0.9
      if (this.blockstun <= 0) {
        this.state = 'idle'
        this.stateTime = 0
      }
      this.physics()
      return
    }

    if (this.state === 'knockdown') {
      this.handleKnockdown()
      this.physics()
      return
    }

    if (this.state === 'getup') {
      if (this.stateTime > 14) {
        this.state = 'idle'
        this.stateTime = 0
      }
      this.physics()
      return
    }

    if (this.state === 'defeat') {
      this.physics()
      return
    }

    if (this.state === 'dodge') {
      this.vx *= 0.86
      if (this.stateTime > 23) {
        this.state = 'idle'
        this.stateTime = 0
      }
      this.physics()
      return
    }

    if (this.state === 'parry') {
      this.vx *= 0.6
      if (this.stateTime > 19) {
        this.state = 'idle'
        this.stateTime = 0
      }
      this.physics()
      return
    }

    if (this.state === 'tag') {
      this.tagTimer--
      if (!this.tagAttackDone && this.tagTimer <= 16) {
        this.tagAttackDone = true
        this.battle.executeMove(this, 'tag')
        this.invuln = Math.max(this.invuln, 12)
      } else {
        this.vx *= 0.7
        if (this.tagTimer <= 0) {
          this.state = 'idle'
          this.stateTime = 0
        }
      }
      this.physics()
      return
    }

    if (this.state === 'dash') {
      this.dashTimer--
      if (this.dashTimer < 6) this.vx *= 0.82
      if (this.input.pressed.up) { if (this.startJump()) return }
      if (this.input.pressed.light) { if (this.tryStart('light')) return }
      if (this.input.pressed.medium) { if (this.tryStart('medium')) return }
      if (this.input.pressed.heavy) { if (this.tryStart('heavy')) return }
      if (this.input.pressed.special) { if (this.tryStart('special')) return }
      if (this.input.pressed.super) { if (this.tryStart('super')) return }
      if (this.dashTimer <= 0) {
        this.state = 'idle'
        this.stateTime = 0
      }
      this.physics()
      return
    }

    if (this.airborne) {
      this.handleAir(this.input)
      this.physics()
      return
    }

    if (this.landingLag > 0) {
      this.crouching = false
      this.state = 'idle'
      this.vx *= 0.7
      this.physics()
      return
    }

    this.handleGround(this.input)
    this.physics()
  },
}

function makeTeam(battle, side, chars) {
  const team = {
    side, members: [], activeIndex: 0, meter: 0, guard: 100,
    tagCooldown: 0, assistCooldown: 0, wins: 0, swapTimer: 0, pendingSwap: false,
    koHandled: false, roundsWon: 0, cpu: false, cpuMem: createCpuMemory(),
    stats: { damage: 0, maxCombo: 0, hits: 0, tags: 0, assists: 0, supers: 0 },
  }
  team.members = chars.map((entry, i) => {
    const char = typeof entry === 'string' ? ROSTER_BY_ID[entry] : (ROSTER_BY_ID[entry.id] || entry)
    const f = makeFighter(battle, side, i, char)
    f.team = team
    return f
  })
  team.active = team.members[0]
  return team
}

export class Battle {
  constructor(options = {}) {
    this.mode = options.mode || '1v1'
    this.training = this.mode === 'training'
    this.roundsToWin = options.roundsToWin || 2
    this.seed = options.seed ?? ((Date.now() & 0xffffff) ^ 0x5f3759df)
    this.rng = mulberry32(this.seed >>> 0)
    this.frame = 0
    this.freeze = 0
    this.phase = 'intro'
    this.phaseTimer = 110
    this.banner = null
    this.bannerQueue = []
    this.events = []
    this.round = 1
    this.timerFrames = ROUND_FRAMES
    this.projectiles = []
    this.assists = []
    this.projectileSeq = 0
    this.assistSeq = 0
    this.stage = stageById(options.stage || 'neon')
    this.camera = { x: 0, y: 0, zoom: 1, shake: 0, targetX: 0, targetZoom: 1, focus: null }
    this.combo = [
      { hits: 0, damage: 0, timer: 0, maxHits: 0, moves: [] },
      { hits: 0, damage: 0, timer: 0, maxHits: 0, moves: [] },
    ]
    this.matchOver = false
    this.winner = -1
    this.reason = ''
    this.pendingMatchEnd = false
    this.trainingOptions = {
      dummy: options.dummy || 'stand',
      infiniteMeter: true,
      infiniteHealth: true,
      hitboxes: false,
    }
    this.teams = [
      makeTeam(this, 0, options.teamA || ['kaze']),
      makeTeam(this, 1, options.teamB || ['blaze']),
    ]
    this.teams[0].cpu = !!options.cpuA
    this.teams[1].cpu = options.cpuB !== false
    this.difficulty = options.difficulty || 'normal'
    this.resetPositions(true)
    this.setBanner(this.training ? 'TRAINING' : 'ROUND 1', this.training ? 'Press START to spar' : 'FIGHTERS READY', 'intro', 96)
    if (this.training) {
      this.phase = 'fight'
      this.phaseTimer = 0
    }
    this.updateCamera(true)
  }

  active(side) {
    return this.teams[side].active
  }

  opponent(fighterOrSide) {
    const side = typeof fighterOrSide === 'number' ? fighterOrSide : fighterOrSide.side
    return this.teams[1 - side].active
  }

  setBanner(text, sub = '', style = '', frames = 90) {
    this.banner = { text, sub, style, timer: frames, max: frames }
  }

  emit(event) {
    this.events.push({ frame: this.frame, ...event })
  }

  drainEvents() {
    const out = this.events
    this.events = []
    return out
  }

  resetFighter(f, x, facing, full = true) {
    f.x = x
    f.y = 0
    f.vx = 0
    f.vy = 0
    f.facing = facing
    f.state = 'idle'
    f.stateTime = 0
    f.airborne = false
    f.crouching = false
    f.move = null
    f.moveFrame = 0
    f.hitTargets.clear()
    f.multiTick = 0
    f.finalHit = false
    f.connected = false
    f.chainWindow = 0
    f.hitstun = 0
    f.blockstun = 0
    f.invuln = 0
    f.moveInvuln = false
    f.juggle = 0
    f.airTechUsed = false
    f.pendingKnockdown = false
    f.hardKnockdown = false
    f.throwVictim = null
    f.throwTimer = 0
    f.grabbedBy = null
    f.grabbedTimer = 0
    f.buffer = []
    f.dashCooldown = 0
    f.dodgeCooldown = 0
    f.airDashUsed = false
    f.doubleJumpUsed = false
    f.slowFrames = 0
    f.slowFactor = 1
    f.blockStance = false
    f.ko = false
    f.alive = f.health > 0
    f.koHandled = false
    f.tagTimer = 0
    f.tagAttackDone = false
    f.trail = []
    f.landingLag = 0
    f.hitFlash = 0
    if (full) {
      f.health = f.maxHealth
      f.guard = 100
      f.awakening = 0
    }
  }

  resetPositions(full = false) {
    const startX = 250
    for (const team of this.teams) {
      for (const f of team.members) {
        if (full) {
          f.health = f.maxHealth
          f.guard = 100
          f.awakening = 0
          f.alive = true
          f.ko = false
        }
        f.koHandled = false
        f.state = 'idle'
        f.stateTime = 0
        f.move = null
        f.hitstun = 0
        f.blockstun = 0
        f.invuln = 0
        f.airborne = false
        f.y = 0
        f.vx = 0
        f.vy = 0
        f.buffer = []
        f.trail = []
      }
      team.activeIndex = 0
      team.active = team.members[0]
      team.tagCooldown = 0
      team.assistCooldown = 0
      team.swapTimer = 0
      team.pendingSwap = false
      team.koHandled = false
      team.guard = 100
      if (full) team.meter = 0
    }
    const a = this.teams[0].active
    const b = this.teams[1].active
    this.resetFighter(a, -startX, 1, false)
    this.resetFighter(b, startX, -1, false)
    if (full) {
      a.health = a.maxHealth
      b.health = b.maxHealth
    }
    this.projectiles = []
    this.assists = []
    this.combo = [
      { hits: 0, damage: 0, timer: 0, maxHits: 0, moves: [] },
      { hits: 0, damage: 0, timer: 0, maxHits: 0, moves: [] },
    ]
  }

  startRound() {
    this.round++
    this.timerFrames = ROUND_FRAMES
    for (const team of this.teams) {
      for (const m of team.members) {
        m.health = m.maxHealth
        m.alive = true
        m.ko = false
        m.koHandled = false
      }
      team.activeIndex = 0
      team.active = team.members[0]
      team.meter = 0
      team.guard = 100
      team.tagCooldown = 0
      team.assistCooldown = 0
      team.swapTimer = 0
      team.pendingSwap = false
      team.koHandled = false
    }
    this.resetPositions(false)
    this.phase = 'intro'
    this.phaseTimer = 116
    this.setBanner(`ROUND ${this.round}`, this.round === 1 ? 'FIGHTERS READY' : 'RESET', 'intro', 92)
    this.emit({ type: 'round', round: this.round })
  }

  step(rawInputs = [null, null]) {
    this.frame++
    if (this.banner) {
      this.banner.timer--
      if (this.banner.timer <= 0) {
        this.banner = this.bannerQueue.shift() || null
      }
    }

    if (this.phase === 'matchEnd') {
      this.updateCamera()
      return
    }

    if (this.phase === 'intro') {
      this.phaseTimer--
      for (const team of this.teams) {
        const f = team.active
        if (f) f.stateTime++
      }
      if (this.phaseTimer <= 0) {
        this.phase = 'fight'
        this.setBanner('FIGHT!', '', 'fight', 55)
        this.emit({ type: 'fight', round: this.round })
      }
      this.updateCamera()
      return
    }

    if (this.phase === 'roundEnd') {
      this.phaseTimer--
      if (this.phaseTimer <= 0) {
        if (this.pendingMatchEnd) {
          this.phase = 'matchEnd'
          this.matchOver = true
          this.winner = this.winsLeader()
          this.setBanner(this.winner === 0 ? 'PLAYER 1 WINS' : this.winner === 1 ? 'PLAYER 2 WINS' : 'DRAW', 'MATCH COMPLETE', 'victory', 240)
          this.emit({ type: 'matchEnd', winner: this.winner })
        } else {
          this.startRound()
        }
      }
      this.updateCamera()
      return
    }

    if (this.freeze > 0) {
      const frozenInputs = [normalizeInput(rawInputs[0]), normalizeInput(rawInputs[1])]
      for (const team of this.teams) {
        const f = team.active
        if (f && !team.cpu) f.ingestInput(frozenInputs[team.side])
      }
      this.freeze--
      this.decodeVisualTimers()
      this.updateCamera()
      return
    }

    const inputs = [normalizeInput(rawInputs[0]), normalizeInput(rawInputs[1])]
    for (const team of this.teams) {
      if (team.cpu) {
        inputs[team.side] = cpuInput(this, team.side, this.difficulty, team.cpuMem)
      }
      const f = team.active
      if (f && this.training && team.side === 1) this.applyTrainingDummy(f, inputs[team.side])
    }

    if (!this.training) {
      this.timerFrames = Math.max(0, this.timerFrames - 1)
      if (this.timerFrames <= 0) {
        const ratioA = this.totalHealthRatio(0)
        const ratioB = this.totalHealthRatio(1)
        const winner = ratioA > ratioB + 0.0001 ? 0 : ratioB > ratioA + 0.0001 ? 1 : -1
        this.endRound(winner, 'TIME OVER')
        return
      }
    } else if (this.trainingOptions.infiniteMeter) {
      for (const t of this.teams) t.meter = 300
    }

    for (const team of this.teams) {
      const f = team.active
      if (f) f.update(inputs[team.side])
    }
    this.updateProjectiles()
    this.updateAssists()
    this.resolveMelee()
    this.resolveAssistHits()
    this.separate()
    this.updateCombos()
    this.checkKO()
    this.processSwaps()
    this.updateCamera()
  }

  winsLeader() {
    if (this.teams[0].wins > this.teams[1].wins) return 0
    if (this.teams[1].wins > this.teams[0].wins) return 1
    return -1
  }

  totalHealthRatio(side) {
    const team = this.teams[side]
    let cur = 0
    let max = 0
    for (const m of team.members) {
      cur += Math.max(0, m.health)
      max += m.maxHealth
    }
    return max ? cur / max : 0
  }

  endRound(winner, reason) {
    if (this.phase === 'roundEnd' || this.phase === 'matchEnd') return
    this.phase = 'roundEnd'
    this.phaseTimer = 165
    this.reason = reason
    if (winner >= 0) {
      this.teams[winner].wins++
      this.teams[winner].roundsWon++
    }
    if (this.teams[0].wins >= this.roundsToWin || this.teams[1].wins >= this.roundsToWin) {
      this.pendingMatchEnd = true
    }
    let text = reason === 'TIME OVER' ? 'TIME OVER' : 'K.O.'
    let sub = winner === 0 ? `${this.teams[0].active.name} TAKES THE ROUND` : winner === 1 ? `${this.teams[1].active.name} TAKES THE ROUND` : 'DOUBLE K.O.'
    if (reason === 'PERFECT') text = 'PERFECT!'
    this.setBanner(text, sub, 'ko', 130)
    this.emit({ type: 'roundEnd', winner, reason, text })
    this.camera.shake = Math.max(this.camera.shake, 8)
  }

  updateCamera(instant = false) {
    const a = this.teams[0].active
    const b = this.teams[1].active
    if (!a || !b) return
    const mid = (a.x + b.x) / 2
    const distance = Math.abs(a.x - b.x)
    const height = Math.max(a.y, b.y)
    let zoom = clamp(1.33 - distance / 2300, 0.86, 1.28)
    if (this.phase === 'roundEnd') zoom = clamp(zoom + 0.08, 0.9, 1.4)
    const targetY = clamp(height * 0.32, 0, 160)
    const cam = this.camera
    if (instant) {
      cam.x = mid
      cam.y = targetY
      cam.zoom = zoom
    } else {
      cam.x += (mid - cam.x) * 0.09
      cam.y += (targetY - cam.y) * 0.06
      cam.zoom += (zoom - cam.zoom) * 0.05
    }
    cam.targetX = mid
    cam.targetY = targetY
    cam.targetZoom = zoom
    cam.shake *= 0.86
  }

  addShake(amount) {
    this.camera.shake = Math.min(24, Math.max(this.camera.shake, amount))
  }

  updateCombos() {
    for (const c of this.combo) {
      if (c.timer > 0) {
        c.timer--
        if (c.timer === 0) {
          c.hits = 0
          c.damage = 0
          c.moves = []
        }
      }
    }
  }

  decodeVisualTimers() {
    for (const team of this.teams) {
      const f = team.active
      if (f) {
        f.hitFlash = Math.max(0, f.hitFlash - 1)
        f.superFlash = Math.max(0, f.superFlash - 1)
      }
    }
    for (const p of this.projectiles) p.spin = (p.spin || 0) + 0.14
  }

  applyTrainingDummy(f, input) {
    const opt = this.trainingOptions.dummy
    if (opt === 'block') {
      f.autoBlock = true
      input.block = true
      if (f.opponent) {
        const opp = this.teams[1 - f.side].active
        input[f.facing > 0 ? 'left' : 'right'] = false
        input[f.facing > 0 ? 'right' : 'left'] = false
        if (opp && opp.state === 'attack' && opp.move && opp.move.guard === 'low') input.down = true
      }
    } else if (opt === 'crouch') {
      input.down = true
      input.block = true
      f.autoBlock = true
    } else if (opt === 'jump') {
      if (!f.airborne && this.frame % 80 === 0) input.pressed.up = true
    } else if (opt === 'stand') {
      f.autoBlock = false
    } else if (opt === 'cpu') {
      f.autoBlock = false
      const ai = cpuInput(this, f.side, 'normal', f.team.cpuMem)
      for (const k of Object.keys(ai.pressed || {})) input.pressed[k] = ai.pressed[k]
      for (const k of ['left', 'right', 'up', 'down', 'block']) input[k] = ai[k]
    }
    if (this.trainingOptions.infiniteMeter) f.team.meter = 300
  }

  resolveMelee() {
    for (const side of [0, 1]) {
      const attacker = this.teams[side].active
      const defender = this.teams[1 - side].active
      if (!attacker || !defender) continue
      if (attacker.state !== 'attack' || !attacker.move) continue
      const move = attacker.move
      if (move.projectile && !move.allowMelee) continue
      const f = attacker.moveFrame
      if (!isActiveFrame(move, f)) continue
      const hb = worldHitbox(attacker, move)
      const hurt = hurtbox(defender)
      if (!hurt) continue
      if (!overlap(hb, hurt)) continue
      if (attacker.hitTargets.has(defender.index)) continue
      const hitMove = attacker.finalHit && move.multi && move.multi.final ? { ...move, ...move.multi.final, id: move.id, type: move.type, guard: move.guard, super: move.super } : move
      attacker.hitTargets.add(defender.index)
      this.resolveContact(attacker, defender, hitMove, { x: hb.x + hb.w / 2, y: hb.y + hb.h / 2, source: 'melee' })
    }
  }

  resolveAssistHits() {
    for (const a of this.assists) {
      if (a.state !== 'attack' || !a.move) continue
      if (!isActiveFrame(a.move, a.moveFrame)) continue
      const defender = this.teams[1 - a.side].active
      if (!defender) continue
      const hb = worldHitbox(a, a.move)
      const hurt = hurtbox(defender)
      if (!hurt) continue
      if (!overlap(hb, hurt)) continue
      if (a.hitTargets.has(defender.index)) continue
      a.hitTargets.add(defender.index)
      const attacker = this.teams[a.side].active
      this.resolveContact(attacker, defender, a.move, { x: hb.x + hb.w / 2, y: hb.y + hb.h / 2, source: 'assist', assist: a })
    }
  }

  isBlocking(defender, move, attacker) {
    if (defender.autoBlock) return true
    if (move.guard === 'unblockable') return false
    if (defender.state === 'attack' || defender.state === 'hitstun' || defender.state === 'knockdown' || defender.state === 'grabbed' || defender.state === 'defeat') return false
    if (defender.state === 'dodge' || defender.state === 'tag' || defender.state === 'parry') return false
    const away = attacker.x > defender.x ? 'left' : 'right'
    const holdingGuard = defender.input.block || !!defender.input[away]
    if (!holdingGuard) return false
    if (defender.airborne) return true
    if (move.guard === 'low' && !defender.crouching) return false
    if (move.guard === 'overhead' && defender.crouching) return false
    return true
  }

  resolveContact(attacker, defender, move, point) {
    if (!defender || !defender.alive || defender.ko) return false
    if (defender.state === 'defeat') return false
    if (defender.invuln > 0) return false
    if (defender.state === 'dodge' && defender.stateTime <= 16) return false
    if (defender.state === 'tag' && defender.stateTime < 20) return false
    if (defender.isMoveInvuln && defender.isMoveInvuln()) return false

    if (defender.state === 'parry' && defender.stateTime <= 8 && move.guard !== 'unblockable' && !move.throw) {
      this.onParry(attacker, defender, move, point)
      return true
    }

    if (move.throw) {
      if (defender.airborne || defender.state === 'knockdown') return false
      if (!move.commandGrab && defender.bufferRecent('throw', 6)) {
        defender.state = 'idle'
        defender.stateTime = 0
        attacker.state = 'idle'
        attacker.stateTime = 0
        attacker.move = null
        attacker.vx = -attacker.facing * 4.5
        defender.vx = defender.facing * 4.5
        this.freeze = Math.max(this.freeze, 12)
        this.emit({ type: 'throwTech', x: point.x, y: point.y })
        this.addShake(5)
        return true
      }
      defender.state = 'grabbed'
      defender.stateTime = 0
      defender.grabbedBy = attacker
      defender.grabbedTimer = 25
      defender.vx = 0
      defender.vy = 0
      defender.airborne = false
      defender.hitTargets.clear()
      attacker.throwVictim = defender
      attacker.throwTimer = 22
      attacker.connected = true
      this.freeze = Math.max(this.freeze, 7)
      this.emit({ type: 'grab', x: point.x, y: point.y })
      return true
    }

    const blocked = this.isBlocking(defender, move, attacker)
    const counter = (defender.state === 'attack' && defender.moveFrame <= (defender.move ? defender.move.startup + defender.move.active : 0)) ||
      (defender.state === 'dodge' && defender.stateTime > 16)

    if (blocked) {
      this.onBlock(attacker, defender, move, point)
    } else {
      this.onHit(attacker, defender, move, point, { counter, source: point.source || 'melee' })
    }
    return true
  }

  onParry(attacker, defender, move, point) {
    defender.team.meter = clamp(defender.team.meter + 20, 0, 300)
    defender.state = 'parry'
    defender.stateTime = 0
    defender.parryWindow = 12
    defender.hitFlash = 8
    attacker.state = 'hitstun'
    attacker.stateTime = 0
    attacker.hitstun = 20
    attacker.move = null
    attacker.connected = false
    attacker.vx = -attacker.facing * 3
    this.freeze = Math.max(this.freeze, 13)
    this.emit({ type: 'parry', x: point.x, y: point.y, side: defender.side })
    this.setBanner('PARRY!', 'PERFECT DEFENSE', 'parry', 55)
    this.addShake(4)
  }

  onBlock(attacker, defender, move, point) {
    const chip = this.training ? 0 : Math.max(0, move.chip || 0)
    if (chip > 0) defender.health = Math.max(this.training ? 1 : 0, defender.health - chip)
    const guardDamage = move.damage * 0.26 + 4
    defender.guard -= guardDamage
    defender.team.meter = clamp(defender.team.meter + move.damage * 0.08, 0, 300)
    attacker.team.meter = clamp(attacker.team.meter + move.damage * 0.05, 0, 300)
    const guardBreak = defender.guard <= 0
    if (guardBreak) {
      defender.guard = 100
      defender.state = 'hitstun'
      defender.hitstun = 68
      defender.stateTime = 0
      defender.blockstun = 0
      defender.move = null
      defender.vx = attacker.facing * 5
      defender.airborne = false
      defender.y = 0
      this.freeze = Math.max(this.freeze, 12)
      this.emit({ type: 'guardBreak', x: point.x, y: point.y, side: defender.side })
      this.setBanner('GUARD BREAK', '', 'break', 70)
      this.addShake(7)
    } else {
      defender.state = 'blockstun'
      defender.blockstun = move.blockstun
      defender.stateTime = 0
      defender.vx = attacker.facing * (move.kbx * 0.55)
      this.freeze = Math.max(this.freeze, Math.max(3, move.hitstop - 1))
      this.emit({ type: 'block', x: point.x, y: point.y, move: move.id, side: defender.side })
      this.addShake(1.2)
    }
    attacker.connected = true
    attacker.chainWindow = 14
    if (move.type === 'super' || move.type === 'special') this.addShake(2)
  }

  onHit(attacker, defender, move, point, opts = {}) {
    const side = attacker.side
    const combo = this.combo[side]
    const hitsBefore = combo.hits
    let scale = clamp(1 - 0.052 * hitsBefore, 0.32, 1)
    if (move.super) scale = Math.max(scale, 0.46)
    const recent = combo.moves.slice(-4)
    const stale = recent.filter((id) => id === move.id).length >= 2 ? 0.72 : 1
    const counter = !!opts.counter
    const awaken = attacker.awakening > 0 ? attacker.char.awakening.damage : 1
    const defense = defender.awakening > 0 ? defender.char.awakening.defense : 1
    let damage = move.damage * scale * stale * (counter ? 1.2 : 1) * awaken * defense
    if (this.training) damage = Math.max(1, damage)
    damage = Math.round(damage)

    const wasAirborne = defender.airborne
    const launch = !!(move.launch || move.kby > 0)
    const airborneHit = defender.airborne

    if (this.training && this.trainingOptions.infiniteHealth) {
      defender.health = Math.max(1, defender.health - damage)
    } else {
      defender.health = Math.max(0, defender.health - damage)
    }
    attacker.team.stats.damage += damage
    attacker.team.stats.hits++

    combo.hits++
    combo.damage += damage
    combo.timer = 96
    combo.maxHits = Math.max(combo.maxHits, combo.hits)
    combo.moves.push(move.id)
    if (combo.moves.length > 10) combo.moves.shift()
    attacker.team.stats.maxCombo = Math.max(attacker.team.stats.maxCombo, combo.hits)

    attacker.team.meter = clamp(attacker.team.meter + (move.meterGain || damage * 0.13), 0, 300)
    defender.team.meter = clamp(defender.team.meter + damage * 0.09, 0, 300)
    attacker.connected = true
    attacker.chainWindow = 14
    defender.hitFlash = 6
    defender.state = 'hitstun'
    defender.stateTime = 0
    defender.move = null
    defender.connected = false
    defender.blockStance = false
    defender.pendingKnockdown = !!(move.knockdown || move.hardKnockdown)
    defender.hardKnockdown = !!move.hardKnockdown
    let hitstun = move.hitstun + (counter ? 5 : 0)
    if (hitsBefore >= 16) hitstun *= 0.62
    if (hitsBefore >= 26) hitstun *= 0.5
    defender.hitstun = Math.max(8, Math.round(hitstun))
    defender.facing = attacker.x > defender.x ? 1 : -1

    if (launch || airborneHit) {
      defender.airborne = true
      defender.y = Math.max(defender.y, 2)
      defender.vy = move.kby || (move.launch ? 8.5 : Math.max(2, defender.vy))
      defender.juggle++
      if (defender.juggle > MAX_JUGGLE) {
        defender.vy = -8
        defender.pendingKnockdown = true
        defender.hardKnockdown = true
        this.emit({ type: 'juggleLimit', x: defender.x, y: defender.y + 60 })
      }
      defender.vx = attacker.facing * (move.kbx * 0.9)
    } else {
      defender.vx = attacker.facing * move.kbx
      if (move.kby < 0) {
        defender.airborne = true
        defender.vy = move.kby
        defender.y = Math.max(defender.y, 2)
      }
    }

    this.freeze = Math.max(this.freeze, move.hitstop + (move.super ? 2 : 0))
    this.addShake(move.shake || (move.type === 'heavy' ? 5 : move.type === 'super' ? 7 : 3))
    this.emit({
      type: 'hit', x: point.x, y: point.y, damage, blocked: false, counter,
      side, move: move.id, big: move.type === 'heavy' || !!move.super, super: !!move.super,
      source: opts.source || 'melee', charId: attacker.char.id,
      color: attacker.char.color, hits: combo.hits,
    })
    if (counter) this.emit({ type: 'text', text: 'COUNTER', x: defender.x, y: defender.y + 130, color: '#ffd25e', life: 40 })

    if (move.slow) {
      defender.slowFrames = move.slowFrames || 80
      defender.slowFactor = move.slow
      this.emit({ type: 'slow', x: defender.x, y: defender.y + 60, color: '#a5e8ff' })
    }

    if (attacker.throwVictim && attacker.throwTimer > 0) {
      this.resolveThrowDamage(attacker)
    }
  }

  resolveThrowDamage(attacker) {
    const victim = attacker.throwVictim
    if (!victim || !victim.alive) {
      attacker.throwVictim = null
      return
    }
    const move = attacker.moves.throw
    const team = attacker.team
    const combo = this.combo[attacker.side]
    const damage = Math.round(move.damage * (attacker.awakening > 0 ? attacker.char.awakening.damage : 1))
    victim.health = Math.max(this.training ? 1 : 0, victim.health - damage)
    team.meter = clamp(team.meter + 18, 0, 300)
    combo.hits++
    combo.damage += damage
    combo.timer = 96
    combo.maxHits = Math.max(combo.maxHits, combo.hits)
    combo.moves.push('throw')
    victim.state = 'knockdown'
    victim.stateTime = 0
    victim.hitstun = 42
    victim.airborne = true
    victim.vy = 8
    victim.vx = attacker.facing * 7
    victim.pendingKnockdown = true
    victim.hardKnockdown = true
    victim.juggle = 0
    victim.health = Math.max(this.training ? 1 : 0, victim.health)
    attacker.throwVictim = null
    attacker.throwTimer = 0
    this.freeze = Math.max(this.freeze, 11)
    this.emit({ type: 'throw', x: victim.x, y: victim.y + 60, damage, side: attacker.side })
    this.addShake(6)
  }

  updateProjectiles() {
    const activeProjectiles = []
    for (const p of this.projectiles) {
      if (p.dead) continue
      p.life--
      p.spin = (p.spin || 0) + 0.16
      p.x += p.vx
      if (p.life <= 0 || Math.abs(p.x) > STAGE_LIMIT + 220) {
        p.dead = true
        continue
      }
      for (const other of this.projectiles) {
        if (other === p || other.dead || other.side === p.side) continue
        if (overlap(projectileBox(p), projectileBox(other))) {
          p.dead = true
          other.dead = true
          this.emit({ type: 'clash', x: (p.x + other.x) / 2, y: p.y, color: p.color })
          this.addShake(3)
          break
        }
      }
      if (p.dead) continue
      const defender = this.teams[1 - p.side].active
      if (defender && defender.alive && !defender.ko) {
        const hurt = hurtbox(defender)
        if (hurt && overlap(projectileBox(p), hurt)) {
          const attacker = this.teams[p.side].active
          const move = { ...p.move, ...p.hitProps }
          const hit = this.resolveContact(attacker, defender, move, { x: p.x, y: p.y, source: 'projectile' })
          if (hit) {
            p.dead = true
            this.emit({ type: 'projectileHit', x: p.x, y: p.y, color: p.color, type: p.type })
          }
        }
      }
      if (!p.dead) {
        for (const a of this.assists) {
          if (a.dead || a.side === p.side) continue
          if (overlap(projectileBox(p), assistHurtbox(a))) {
            a.dead = true
            p.dead = true
            this.teams[p.side].meter = clamp(this.teams[p.side].meter + 10, 0, 300)
            this.emit({ type: 'assistHit', x: a.x, y: a.y + 60 })
            break
          }
        }
      }
      if (!p.dead) activeProjectiles.push(p)
    }
    this.projectiles = activeProjectiles
  }

  updateAssists() {
    const alive = []
    for (const a of this.assists) {
      if (a.dead) continue
      a.timer++
      if (a.state === 'enter') {
        const opponent = this.teams[1 - a.side].active
        const targetX = opponent ? opponent.x - a.facing * 74 : a.x + a.facing * 140
        a.x += clamp(targetX - a.x, -9, 9)
        if (a.timer > 17) {
          a.state = 'attack'
          a.move = a.char.assist
          a.moveFrame = 0
          a.hitTargets.clear()
        }
      } else {
        a.moveFrame++
        if (a.move && a.move.dash) a.x += a.facing * a.move.dash * 0.45
        if (a.move && a.moveFrame >= a.move.startup + a.move.active + a.move.recovery + 8) {
          a.state = 'leave'
          a.leaveTimer = 18
        }
        if (a.move && a.moveFrame === a.move.startup && a.move.sfx) {
          this.emit({ type: 'sfx', name: a.move.sfx, x: a.x, y: a.y })
        }
      }
      if (a.state === 'leave') {
        a.leaveTimer--
        a.x -= a.facing * 7
        if (a.leaveTimer <= 0) a.dead = true
      }
      if (!a.dead) alive.push(a)
    }
    this.assists = alive
  }

  separate() {
    const a = this.teams[0].active
    const b = this.teams[1].active
    if (!a || !b || a.ko || b.ko) return
    if (a.state === 'grabbed' || b.state === 'grabbed') return
    const dx = b.x - a.x
    const min = (a.crouching ? 48 : 44) + (b.crouching ? 48 : 44)
    if (Math.abs(dx) < min) {
      const push = (min - Math.abs(dx)) / 2
      const dir = dx >= 0 ? 1 : -1
      a.x -= dir * push
      b.x += dir * push
    }
    for (const f of [a, b]) {
      f.x = clamp(f.x, -STAGE_LIMIT, STAGE_LIMIT)
    }
    if (Math.abs(a.x - b.x) > 6) {
      const faceA = a.x < b.x ? 1 : -1
      if (a.state !== 'attack' && a.state !== 'hitstun' && a.state !== 'grabbed' && a.state !== 'dodge') a.facing = faceA
      if (b.state !== 'attack' && b.state !== 'hitstun' && b.state !== 'grabbed' && b.state !== 'dodge') b.facing = -faceA
    }
  }

  checkKO() {
    for (const side of [0, 1]) {
      const team = this.teams[side]
      const f = team.active
      if (!f || f.health > 0 || f.ko || f.state === 'defeat') continue
      f.health = 0
      f.ko = true
      f.alive = false
      f.state = 'defeat'
      f.stateTime = 0
      f.airborne = true
      f.vy = 7
      f.vx = -f.facing * 5
      f.move = null
      f.hitstun = 0
      f.awakening = 0
      this.freeze = Math.max(this.freeze, 18)
      this.emit({ type: 'ko', side, x: f.x, y: f.y + 60, charId: f.char.id })
      this.addShake(12)
      this.setBanner('K.O.', `${f.name} IS DOWN`, 'ko', 110)
      team.koHandled = true
      const bench = team.members.filter((m) => m !== f && m.health > 0 && m.alive && !m.ko)
      if (this.training) {
        team.swapTimer = 80
        team.pendingSwap = true
      } else if (this.mode === '3v3' && bench.length > 0) {
        team.swapTimer = 86
        team.pendingSwap = true
      } else {
        this.endRound(1 - side, 'K.O.')
      }
    }
  }

  processSwaps() {
    for (const side of [0, 1]) {
      const team = this.teams[side]
      if (!team.pendingSwap) continue
      team.swapTimer--
      if (team.swapTimer > 0) continue
      const bench = team.members.filter((m) => m !== team.active && m.health > 0 && m.alive && !m.ko)
      if (this.training) {
        team.active.health = team.active.maxHealth
        this.resetFighter(team.active, team.active.x, team.active.facing, false)
        team.pendingSwap = false
        team.koHandled = false
        this.emit({ type: 'trainingReset' })
        continue
      }
      if (!bench.length) {
        team.pendingSwap = false
        continue
      }
      const outgoing = team.active
      const incoming = bench[0]
      const idx = team.members.indexOf(incoming)
      team.activeIndex = idx
      team.active = incoming
      incoming.x = side === 0 ? -260 : 260
      incoming.y = 0
      incoming.vx = 0
      incoming.vy = 0
      incoming.facing = side === 0 ? 1 : -1
      incoming.state = 'idle'
      incoming.stateTime = 0
      incoming.airborne = false
      incoming.crouching = false
      incoming.move = null
      incoming.hitstun = 0
      incoming.blockstun = 0
      incoming.invuln = 80
      incoming.health = Math.max(1, incoming.health)
      incoming.ko = false
      incoming.alive = true
      incoming.koHandled = false
      incoming.juggle = 0
      incoming.buffer = []
      incoming.trail = []
      team.pendingSwap = false
      team.koHandled = false
      team.swapTimer = 0
      this.setBanner('TAG IN', incoming.name, 'tag', 60)
      this.emit({ type: 'tagIn', side, x: incoming.x, charId: incoming.id })
      this.freeze = Math.max(this.freeze, 20)
    }
  }

  spawnProjectile(fighter, move) {
    const spec = move.projectile
    if (!spec) return
    const p = {
      id: ++this.projectileSeq, side: fighter.side, x: fighter.x + fighter.facing * (spec.x ?? 44),
      y: fighter.y + (spec.y ?? 60), vx: fighter.facing * spec.speed, life: spec.life || 90,
      w: spec.w || 60, h: spec.h || 44, type: spec.type || 'orb', color: fighter.char.color,
      energy: fighter.char.energy, move, hitProps: { slow: spec.slow, slowFrames: spec.slowFrames, guard: spec.low ? 'low' : 'mid' },
      dead: false, spin: 0, facing: fighter.facing, charId: fighter.char.id,
    }
    this.projectiles.push(p)
    this.emit({ type: 'projectile', x: p.x, y: p.y, color: p.color, type: p.type, side: fighter.side })
    this.addShake(1.2)
  }

  spawnAssist(team) {
    const f = team.active
    if (!f) return false
    if (team.assistCooldown > 0) return false
    if (team.meter < 50) return false
    const bench = team.members.filter((m) => m !== f && m.health > 0 && m.alive && !m.ko)
    if (!bench.length) return false
    const char = bench[0].char
    const a = {
      id: ++this.assistSeq, side: team.side, char, x: f.x - f.facing * 130, y: 0,
      facing: f.facing, timer: 0, state: 'enter', move: null, moveFrame: 0,
      hitTargets: new Set(), dead: false,
    }
    this.assists.push(a)
    team.meter = clamp(team.meter - 50, 0, 300)
    team.assistCooldown = 360
    team.stats.assists++
    this.emit({ type: 'assistCall', side: team.side, x: a.x, y: 0, charId: char.id })
    return true
  }

  tryTag(team) {
    if (this.mode !== '3v3') return false
    if (team.tagCooldown > 0) return false
    const f = team.active
    if (!f) return false
    if (['attack', 'hitstun', 'blockstun', 'knockdown', 'tag', 'dodge', 'parry', 'grabbed', 'defeat'].includes(f.state)) return false
    const bench = team.members.filter((m) => m !== f && m.health > 0 && m.alive && !m.ko)
    if (!bench.length) return false
    const incoming = bench[0]
    const outgoingX = f.x
    f.state = 'idle'
    f.stateTime = 0
    const idx = team.members.indexOf(incoming)
    team.activeIndex = idx
    team.active = incoming
    incoming.x = outgoingX
    incoming.y = 0
    incoming.vx = 0
    incoming.vy = 0
    incoming.facing = f.facing
    incoming.airborne = false
    incoming.state = 'tag'
    incoming.stateTime = 0
    incoming.tagTimer = 26
    incoming.tagAttackDone = false
    incoming.invuln = 26
    incoming.move = null
    incoming.hitstun = 0
    incoming.blockstun = 0
    incoming.buffer = []
    incoming.trail = []
    team.tagCooldown = 300
    team.stats.tags++
    this.emit({ type: 'tag', side: team.side, x: outgoingX, charId: incoming.id, outgoing: f.char.id })
    this.setBanner('TAG', incoming.name, 'tag', 52)
    this.freeze = Math.max(this.freeze, 5)
    return true
  }

  startAwakening(f) {
    if (f.team.meter < 300) return false
    if (f.awakening > 0) return false
    if (!['idle', 'walk', 'crouch', 'air', 'blockstun'].includes(f.state)) return false
    f.team.meter = 0
    f.awakening = f.char.awakening.duration
    f.superFlash = 40
    f.invuln = Math.max(f.invuln, 24)
    this.freeze = Math.max(this.freeze, 10)
    this.emit({ type: 'awaken', side: f.side, x: f.x, y: f.y, charId: f.char.id })
    this.setBanner('AWAKENING', f.char.awakening.name, 'awaken', 90)
    this.addShake(6)
    return true
  }

  executeMove(f, key) {
    const move = f.moves[key]
    if (!move) return false
    if (move.type === 'super' && f.airborne) return false
    if (move.cost && f.team.meter < move.cost) return false
    if (move.cost) f.team.meter = clamp(f.team.meter - move.cost, 0, 300)
    f.state = 'attack'
    f.stateTime = 0
    f.move = move
    f.moveFrame = 0
    f.hitTargets.clear()
    f.multiTick = 0
    f.finalHit = false
    f.connected = false
    f.chainWindow = 0
    f.crouching = false
    f.tagAttackDone = true
    if (move.super) {
      f.superFlash = 34
      f.team.stats.supers++
      this.emit({ type: 'super', side: f.side, x: f.x, y: f.y, charId: f.char.id, name: move.name })
      this.setBanner('SUPER', move.name, 'super', 76)
      this.addShake(5)
    } else if (move.type === 'special') {
      this.emit({ type: 'special', side: f.side, x: f.x, y: f.y, charId: f.char.id, name: move.name })
    }
    if (move.sfx) this.emit({ type: 'sfx', name: move.sfx, x: f.x, y: f.y })
    return true
  }
}

function isActiveFrame(move, frame) {
  if (!move) return false
  const start = move.startup
  const end = move.startup + move.active
  if (frame < start || frame >= end) return false
  if (move.multi) {
    const interval = move.multi.interval
    return (frame - start) % interval === 0
  }
  return true
}

export function worldHitbox(f, move = f.move) {
  if (!move) return { x: 0, y: 0, w: 0, h: 0 }
  const hb = move.hitbox
  const x = f.facing > 0 ? f.x + hb.x : f.x - hb.x - hb.w
  return { x, y: f.y + hb.y, w: hb.w, h: hb.h }
}

export function hurtbox(f) {
  if (!f || f.ko || f.state === 'defeat') return null
  if (f.invuln > 0) return null
  if (f.state === 'dodge' && f.stateTime <= 16) return null
  if (f.state === 'tag' && f.stateTime < 20) return null
  if (f.state === 'knockdown') return { x: f.x - 44, y: f.y + 2, w: 88, h: 32 }
  if (f.airborne) return { x: f.x - 24, y: f.y + 4, w: 48, h: 104 }
  if (f.crouching) return { x: f.x - 27, y: f.y + 2, w: 54, h: 74 }
  return { x: f.x - 23, y: f.y + 4, w: 46, h: 116 }
}

export function projectileBox(p) {
  return { x: p.x - p.w / 2, y: p.y - p.h / 2, w: p.w, h: p.h }
}

export function assistHurtbox(a) {
  return { x: a.x - 24, y: a.y + 4, w: 48, h: 112 }
}

export function stateLabel(f) {
  if (!f) return ''
  if (f.state === 'attack' && f.move) return f.move.name
  return f.state
}

export function createBattle(options) {
  return new Battle(options)
}
