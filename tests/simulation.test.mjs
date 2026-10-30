import test from 'node:test'
import assert from 'node:assert/strict'
import { Battle, MAX_JUGGLE, hurtbox } from '../src/simulation.mjs'

function ready(options = {}) {
  const b = new Battle({ mode: '1v1', cpuB: false, seed: 7, ...options })
  for (let i = 0; i < 120; i++) b.step([{}, {}])
  return b
}

function place(b, ax = -40, bx = 40) {
  b.teams[0].active.x = ax
  b.teams[1].active.x = bx
  b.teams[1].active.facing = -1
  b.teams[0].active.facing = 1
}

function press(key) {
  return { pressed: { [key]: true } }
}

function runFrames(b, count, inputs = () => [{}, {}]) {
  for (let i = 0; i < count; i++) b.step(inputs(i, b))
}

test('deterministic simulation with identical inputs', () => {
  const a = new Battle({ mode: '1v1', teamA: ['kaze'], teamB: ['blaze'], cpuB: true, seed: 1234 })
  const b = new Battle({ mode: '1v1', teamA: ['kaze'], teamB: ['blaze'], cpuB: true, seed: 1234 })
  for (let i = 0; i < 900; i++) {
    const input = i % 17 === 0 ? press('medium') : {}
    a.step([input, {}])
    b.step([input, {}])
    if (i === 400) {
      assert.equal(a.active(0).x, b.active(0).x)
      assert.equal(a.active(1).x, b.active(1).x)
    }
  }
  for (const side of [0, 1]) {
    assert.equal(a.active(side).health, b.active(side).health)
    assert.equal(a.active(side).x, b.active(side).x)
    assert.equal(a.active(side).meter, b.active(side).meter)
    assert.equal(a.teams[side].meter, b.teams[side].meter)
  }
  assert.equal(a.phase, b.phase)
})

test('light into buffered medium chains during hitstop', () => {
  const b = ready()
  place(b)
  b.step([press('light'), {}])
  let chained = false
  for (let i = 0; i < 40; i++) {
    const a = b.active(0)
    let input = {}
    if (a.connected && a.chainWindow > 0 && a.move && a.move.id === 'light' && !chained) {
      input = press('medium')
      chained = true
    }
    b.step([input, {}])
  }
  assert.ok(chained, 'attack connected')
  assert.ok(b.combo[0].hits >= 2, `expected a 2 hit combo, got ${b.combo[0].hits}`)
  assert.ok(b.active(1).health < b.active(1).maxHealth)
})

test('blocking prevents damage and drains guard', () => {
  const b = ready()
  place(b)
  const defender = b.active(1)
  b.step([press('medium'), { block: true, left: true }])
  runFrames(b, 45, () => [{}, { block: true, left: true }])
  assert.equal(defender.health, defender.maxHealth)
  assert.ok(defender.guard < 100, 'guard should be chipped')
})

test('low attacks beat standing guard and overheads beat crouch guard', () => {
  const b = ready()
  place(b)
  const defender = b.active(1)
  b.step([{ down: true, pressed: { medium: true } }, { block: true, left: true }])
  runFrames(b, 40, () => [{}, { block: true, left: true }])
  assert.ok(defender.health < defender.maxHealth, 'low should hit a standing blocker')

  const c = ready()
  place(c)
  const d2 = c.active(1)
  c.step([press('heavy'), { down: true, block: true, left: true }])
  runFrames(c, 45, () => [{}, { down: true, block: true, left: true }])
  assert.ok(d2.health < d2.maxHealth, 'overhead should hit a crouching blocker')
})

test('parry negates damage and staggers the attacker', () => {
  const b = ready()
  place(b)
  const defender = b.active(1)
  let parried = false
  for (let i = 0; i < 40; i++) {
    let inp = {}
    if (i === 8) inp = press('parry')
    b.step([i === 0 ? press('heavy') : {}, inp])
    if (b.banner && b.banner.text === 'PARRY!') parried = true
  }
  assert.ok(parried, 'parry happened')
  assert.equal(defender.health, defender.maxHealth)
})

test('throws are unblockable and deal knockdown damage', () => {
  const b = ready()
  place(b, -20, 20)
  const defender = b.active(1)
  b.step([press('throw'), { block: true, left: true }])
  runFrames(b, 80, () => [{}, { block: true, left: true }])
  assert.ok(defender.health < defender.maxHealth)
  assert.ok(b.combo[0].hits >= 1)
})

test('special attacks cost meter and projectiles deal damage', () => {
  const b = ready()
  place(b)
  b.teams[0].meter = 100
  const defender = b.active(1)
  b.step([press('special'), {}])
  assert.equal(b.teams[0].meter, 75)
  runFrames(b, 80)
  assert.ok(defender.health < defender.maxHealth)
  assert.ok(b.combo[0].hits >= 1)
})

test('tag system swaps active fighter and enforces cooldown', () => {
  const b = ready({ mode: '3v3', teamA: ['kaze', 'volt', 'frost'], teamB: ['blaze', 'terra', 'nyx'] })
  const first = b.active(0)
  b.step([press('tag'), {}])
  runFrames(b, 35)
  assert.notEqual(b.active(0), first)
  assert.equal(b.active(0).char.id, 'volt')
  assert.ok(b.teams[0].tagCooldown > 0)
  b.step([press('tag'), {}])
  assert.equal(b.active(0).char.id, 'volt')
})

test('assists are called, cost meter and can hit', () => {
  const b = ready({ teamA: ['kaze', 'volt'], teamB: ['blaze'] })
  place(b)
  b.teams[0].meter = 120
  b.step([press('assist'), {}])
  assert.equal(b.teams[0].meter, 70)
  assert.equal(b.assists.length, 1)
  runFrames(b, 90)
  assert.ok(b.active(1).health < b.active(1).maxHealth)
})

test('awakening consumes three bars and buffs the fighter', () => {
  const b = ready()
  b.teams[0].meter = 300
  const f = b.active(0)
  b.step([press('awaken'), {}])
  assert.equal(b.teams[0].meter, 0)
  assert.ok(f.awakening > 0)
  assert.equal(b.banner.text, 'AWAKENING')
})

test('KO ends a round, awards the win and can finish the match', () => {
  const b = ready({ roundsToWin: 1 })
  const defender = b.active(1)
  b.teams[0].meter = 300
  place(b)
  // Drive a super with enough damage to end the round instantly.
  defender.health = 5
  b.teams[0].meter = 100
  b.step([press('super'), {}])
  runFrames(b, 140)
  assert.equal(defender.health, 0)
  assert.equal(b.teams[0].wins, 1)
  assert.equal(b.phase, 'roundEnd')
  runFrames(b, 170)
  assert.equal(b.phase, 'matchEnd')
  assert.equal(b.matchOver, true)
  assert.equal(b.winner, 0)
})

test('3v3 replaces a KO fighter with the next team member', () => {
  const b = ready({ mode: '3v3', teamA: ['kaze', 'volt', 'frost'], teamB: ['blaze', 'terra', 'nyx'] })
  const first = b.active(0)
  first.health = 1
  b.teams[1].meter = 100
  place(b)
  b.active(1).facing = -1
  b.step([{}, press('super')])
  runFrames(b, 240)
  assert.equal(first.health, 0)
  assert.equal(b.active(0).char.id, 'volt')
  assert.ok(b.active(0).health > 0)
})

test('training mode keeps fighters alive and refills meter', () => {
  const b = new Battle({ mode: 'training', teamA: ['kaze'], teamB: ['blaze'], cpuB: false })
  for (let i = 0; i < 10; i++) b.step([{}, {}])
  assert.equal(b.teams[0].meter, 300)
  b.active(1).health = 1
  place(b)
  b.step([press('heavy'), {}])
  runFrames(b, 60)
  assert.ok(b.active(1).health >= 1)
})

test('hurtboxes shrink while crouching', () => {
  const b = ready()
  const f = b.active(0)
  const stand = hurtbox(f)
  f.crouching = true
  const crouch = hurtbox(f)
  assert.ok(crouch.h < stand.h)
  assert.ok(crouch.w >= stand.w)
})

test('juggle limit forces a knockdown', () => {
  const b = ready()
  place(b)
  const defender = b.active(1)
  defender.juggle = MAX_JUGGLE
  defender.airborne = true
  defender.y = 40
  b.teams[0].meter = 100
  b.step([press('special'), {}])
  runFrames(b, 90)
  assert.ok(defender.health < defender.maxHealth)
  assert.ok(defender.juggle <= MAX_JUGGLE + 1)
})
