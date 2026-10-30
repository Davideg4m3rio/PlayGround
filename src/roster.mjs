const move = (o) => ({
  chip: 0,
  guard: 'mid',
  hitstop: 6,
  meterGain: 10,
  kbx: 2.4,
  kby: 0,
  cancels: [],
  anim: 'punch',
  ...o,
  hitbox: { w: 62, h: 36, x: 18, y: 64, ...(o.hitbox || {}) },
})

function normals(opts = {}) {
  const s = opts.speed ?? 1
  const p = opts.power ?? 1
  const f = (v) => Math.round(v / s)
  return {
    light: move({
      id: 'light', name: 'Jab', type: 'light', startup: f(4), active: 3, recovery: f(8),
      damage: Math.round(26 * p), hitstun: 15, blockstun: 10, hitstop: 5,
      hitbox: { x: 20, y: 62, w: 58, h: 36 }, kbx: 1.9,
      cancels: ['medium', 'heavy', 'special', 'super'], meterGain: 8, anim: 'punch',
      sfx: 'light', hitSfx: 'hitLight',
    }),
    medium: move({
      id: 'medium', name: 'Cross', type: 'medium', startup: f(7), active: 4, recovery: f(12),
      damage: Math.round(48 * p), hitstun: 19, blockstun: 13, hitstop: 7,
      hitbox: { x: 18, y: 54, w: 76, h: 48 }, kbx: 3.2,
      cancels: ['heavy', 'special', 'super'], meterGain: 13, anim: 'kick',
      sfx: 'medium', hitSfx: 'hitMedium',
    }),
    heavy: move({
      id: 'heavy', name: 'Breaker', type: 'heavy', startup: f(11), active: 5, recovery: f(19),
      damage: Math.round(82 * p), hitstun: 28, blockstun: 18, hitstop: 11,
      hitbox: { x: 16, y: 42, w: 92, h: 70 }, kbx: 5.2, kby: 0,
      cancels: ['special', 'super'], meterGain: 19, anim: 'heavy', guard: 'overhead',
      sfx: 'heavy', hitSfx: 'hitHeavy', shake: 1,
    }),
    crouchLight: move({
      id: 'crouchLight', name: 'Low Jab', type: 'light', startup: f(5), active: 2, recovery: f(9),
      damage: Math.round(22 * p), hitstun: 14, blockstun: 9, hitstop: 5, guard: 'low',
      hitbox: { x: 18, y: 18, w: 62, h: 36 }, kbx: 1.6,
      cancels: ['crouchMedium', 'crouchHeavy', 'special', 'super'], meterGain: 8, anim: 'lowpunch',
      sfx: 'light', hitSfx: 'hitLight',
    }),
    crouchMedium: move({
      id: 'crouchMedium', name: 'Low Sweep', type: 'medium', startup: f(8), active: 3, recovery: f(14),
      damage: Math.round(42 * p), hitstun: 19, blockstun: 13, hitstop: 7, guard: 'low',
      hitbox: { x: 16, y: 12, w: 84, h: 34 }, kbx: 3,
      cancels: ['crouchHeavy', 'special', 'super'], meterGain: 13, anim: 'sweep',
      sfx: 'medium', hitSfx: 'hitMedium',
    }),
    crouchHeavy: move({
      id: 'crouchHeavy', name: 'Sky Breaker', type: 'heavy', startup: f(12), active: 5, recovery: f(22),
      damage: Math.round(72 * p), hitstun: 30, blockstun: 17, hitstop: 10, guard: 'low',
      hitbox: { x: 14, y: 14, w: 80, h: 76 }, kbx: 3.4, kby: 10.2, launch: true,
      cancels: ['special', 'super'], meterGain: 18, anim: 'launcher',
      sfx: 'heavy', hitSfx: 'hitHeavy', shake: 1,
    }),
    airLight: move({
      id: 'airLight', name: 'Air Jab', type: 'light', startup: f(4), active: 3, recovery: f(10),
      damage: Math.round(26 * p), hitstun: 16, blockstun: 10, hitstop: 5, guard: 'overhead',
      hitbox: { x: 16, y: 22, w: 62, h: 58 }, kbx: 2.2,
      cancels: ['airMedium', 'airHeavy', 'special', 'super'], meterGain: 8, anim: 'airpunch',
      sfx: 'light', hitSfx: 'hitLight',
    }),
    airMedium: move({
      id: 'airMedium', name: 'Air Kick', type: 'medium', startup: f(7), active: 4, recovery: f(13),
      damage: Math.round(46 * p), hitstun: 20, blockstun: 13, hitstop: 7, guard: 'overhead',
      hitbox: { x: 14, y: 14, w: 78, h: 62 }, kbx: 3.4,
      cancels: ['airHeavy', 'special', 'super'], meterGain: 13, anim: 'airkick',
      sfx: 'medium', hitSfx: 'hitMedium',
    }),
    airHeavy: move({
      id: 'airHeavy', name: 'Meteor Strike', type: 'heavy', startup: f(10), active: 6, recovery: f(18),
      damage: Math.round(76 * p), hitstun: 28, blockstun: 17, hitstop: 10, guard: 'overhead',
      hitbox: { x: 12, y: 4, w: 88, h: 72 }, kbx: 4, kby: -8, knockdown: true,
      cancels: ['special', 'super'], meterGain: 18, anim: 'divekick',
      sfx: 'heavy', hitSfx: 'hitHeavy', shake: 1,
    }),
    throw: move({
      id: 'throw', name: 'Throw', type: 'throw', startup: 3, active: 3, recovery: 24,
      damage: Math.round(92 * p), hitstun: 34, blockstun: 0, hitstop: 10,
      hitbox: { x: 12, y: 40, w: 70, h: 78 }, unblockable: true, throw: true,
      kbx: 6, kby: 6, knockdown: true, hardKnockdown: true, meterGain: 16, anim: 'throw',
      guard: 'unblockable', sfx: 'whoosh', hitSfx: 'hitHeavy', shake: 1,
    }),
  }
}

const baseStats = {
  health: 1000, walk: 3.25, run: 6.2, jump: 12.2, air: 3.1,
  weight: 1, power: 1, defense: 1,
}

const accessories = {
  kaze: {
    head: 'slick', scarf: '#9ff6ff', hair: '#d9fbff',
    accent: '#4fe3ff', body: '#f4fbff',
  },
  blaze: {
    head: 'spiky', scarf: '#ff9a4d', hair: '#ffd25e',
    accent: '#ff7a2f', body: '#fff7ef',
  },
  volt: {
    head: 'antenna', scarf: '#ffe66d', hair: '#fdf6b2',
    accent: '#ffe14f', body: '#f8fff0',
  },
  frost: {
    head: 'crystal', scarf: '#b8ecff', hair: '#dff8ff',
    accent: '#7dd3ff', body: '#f2fdff',
  },
  terra: {
    head: 'square', scarf: '#9d8b6f', hair: '#c9b38c',
    accent: '#b7a06a', body: '#fbf6ea',
  },
  nyx: {
    head: 'hood', scarf: '#9d6bff', hair: '#3b235f',
    accent: '#a675ff', body: '#efe8ff',
  },
}

const stages = ['neon', 'temple', 'volcano', 'glacier', 'void', 'dojo']

export const ROSTER = [
  {
    id: 'kaze', name: 'KAZE', title: 'The Gale Blade', archetype: 'Balanced',
    tagline: 'Flow like wind. Cut like glass.',
    color: '#4fe3ff', color2: '#0f7f9e', energy: '#9ff6ff',
    stats: { ...baseStats, health: 1000, walk: 3.5, run: 6.6, jump: 12.5, air: 3.4, power: 1, defense: 1 },
    bars: { power: 3, speed: 4, range: 3, tech: 3 },
    accessory: accessories.kaze,
    normals: normals({ speed: 1.04, power: 1 }),
    special: move({
      id: 'special', name: 'Crescent Wind', type: 'special', startup: 13, active: 4, recovery: 24,
      damage: 58, chip: 6, hitstun: 22, blockstun: 15, hitstop: 8, guard: 'mid',
      hitbox: { x: 34, y: 54, w: 74, h: 52 }, kbx: 3.4, cost: 25, meterGain: 0,
      cancels: ['super'], anim: 'slash', projectile: { type: 'wind', speed: 9.2, life: 92, w: 64, h: 48, y: 66 },
      sfx: 'specialWind', air: true,
    }),
    super: move({
      id: 'super', name: 'Tempest Requiem', type: 'super', startup: 9, active: 39, recovery: 26,
      damage: 21, chip: 12, hitstun: 24, blockstun: 14, hitstop: 4, guard: 'mid',
      hitbox: { x: 12, y: 20, w: 170, h: 120 }, kbx: 2, cost: 100, meterGain: 0,
      multi: { count: 9, interval: 4, final: { damage: 34, kbx: 7, kby: 8, launch: true } },
      dash: 9.5, invuln: [0, 14], anim: 'superslash', super: true, shake: 2,
    }),
    assist: move({
      id: 'assist', name: 'Gale Kick', type: 'assist', startup: 16, active: 6, recovery: 18,
      damage: 54, hitstun: 22, blockstun: 14, hitstop: 8, hitbox: { x: 0, y: 34, w: 118, h: 66 },
      kbx: 5.5, kby: 3, anim: 'flykick', guard: 'mid', assist: true,
    }),
    awakening: { name: 'Eye of the Storm', color: '#6ff3ff', duration: 600, damage: 1.18, speed: 1.15, defense: 0.88 },
    stage: 'neon',
  },
  {
    id: 'blaze', name: 'BLAZE', title: 'Crimson Fist', archetype: 'Rushdown',
    tagline: 'Leave nothing but embers.',
    color: '#ff7a2f', color2: '#a32900', energy: '#ffd25e',
    stats: { ...baseStats, health: 940, walk: 3.8, run: 7.1, jump: 12.8, air: 3.6, power: 1.08, defense: 1.04 },
    bars: { power: 5, speed: 5, range: 2, tech: 3 },
    accessory: accessories.blaze,
    normals: normals({ speed: 1.08, power: 1.06 }),
    special: move({
      id: 'special', name: 'Rising Ember', type: 'special', startup: 8, active: 6, recovery: 23,
      damage: 70, chip: 5, hitstun: 30, blockstun: 15, hitstop: 9, guard: 'mid',
      hitbox: { x: 10, y: 30, w: 76, h: 106 }, kbx: 3.2, kby: 11, launch: true,
      cost: 25, meterGain: 0, invuln: [2, 10], cancels: ['super'], anim: 'uppercut',
      sfx: 'specialFire', air: false, rise: 5.5,
    }),
    super: move({
      id: 'super', name: 'Inferno Rush', type: 'super', startup: 8, active: 43, recovery: 24,
      damage: 19, chip: 11, hitstun: 22, blockstun: 13, hitstop: 3, guard: 'mid',
      hitbox: { x: 12, y: 24, w: 150, h: 112 }, kbx: 1.6, cost: 100, meterGain: 0,
      multi: { count: 10, interval: 4, final: { damage: 30, kbx: 8, kby: 7, launch: true } },
      dash: 8.6, invuln: [0, 12], anim: 'superrush', super: true, shake: 2,
    }),
    assist: move({
      id: 'assist', name: 'Flame Dash', type: 'assist', startup: 15, active: 7, recovery: 20,
      damage: 58, hitstun: 24, blockstun: 14, hitstop: 9, hitbox: { x: 0, y: 26, w: 122, h: 92 },
      kbx: 6, kby: 4, launch: true, anim: 'superrush', guard: 'mid', assist: true,
    }),
    awakening: { name: 'Overburn', color: '#ff8a3d', duration: 600, damage: 1.24, speed: 1.18, defense: 0.9 },
    stage: 'volcano',
  },
  {
    id: 'volt', name: 'VOLT', title: 'Storm Step', archetype: 'Technical',
    tagline: 'One spark is all it takes.',
    color: '#ffe14f', color2: '#a07b00', energy: '#fff5a1',
    stats: { ...baseStats, health: 900, walk: 3.6, run: 6.9, jump: 12.6, air: 3.8, power: 0.96, defense: 1.02 },
    bars: { power: 3, speed: 5, range: 3, tech: 5 },
    accessory: accessories.volt,
    normals: normals({ speed: 1.1, power: 0.96 }),
    special: move({
      id: 'special', name: 'Static Field', type: 'special', startup: 15, active: 4, recovery: 22,
      damage: 38, chip: 4, hitstun: 26, blockstun: 14, hitstop: 7, guard: 'mid',
      hitbox: { x: 30, y: 50, w: 68, h: 60 }, kbx: 2.2, cost: 25, meterGain: 0,
      cancels: ['super'], anim: 'cast', projectile: { type: 'spark', speed: 5.2, life: 120, w: 56, h: 56, y: 60, slow: 0.68, slowFrames: 100 },
      sfx: 'specialSpark', air: true,
    }),
    super: move({
      id: 'super', name: 'Chain Reaction', type: 'super', startup: 11, active: 47, recovery: 26,
      damage: 16, chip: 10, hitstun: 22, blockstun: 12, hitstop: 3, guard: 'mid',
      hitbox: { x: -100, y: 18, w: 330, h: 150 }, kbx: 1.4, cost: 100, meterGain: 0,
      multi: { count: 12, interval: 4, final: { damage: 32, kbx: 7, kby: 9, launch: true } },
      invuln: [0, 18], anim: 'superstorm', super: true, shake: 2,
    }),
    assist: move({
      id: 'assist', name: 'Spark Rush', type: 'assist', startup: 14, active: 6, recovery: 18,
      damage: 50, hitstun: 23, blockstun: 13, hitstop: 8, hitbox: { x: 0, y: 34, w: 116, h: 74 },
      kbx: 5, kby: 3, slow: 0.7, slowFrames: 70, anim: 'flykick', guard: 'mid', assist: true,
    }),
    awakening: { name: 'Overclock', color: '#fff36b', duration: 660, damage: 1.2, speed: 1.22, defense: 0.92 },
    stage: 'glacier',
  },
  {
    id: 'frost', name: 'FROST', title: 'Glacier Fang', archetype: 'Zoner',
    tagline: 'Winter always arrives.',
    color: '#7dd3ff', color2: '#1a5f8f', energy: '#d6f6ff',
    stats: { ...baseStats, health: 1000, walk: 3.1, run: 6.0, jump: 12.0, air: 3.2, power: 1.02, defense: 0.96 },
    bars: { power: 3, speed: 3, range: 5, tech: 4 },
    accessory: accessories.frost,
    normals: normals({ speed: 0.98, power: 1.02 }),
    special: move({
      id: 'special', name: 'Ice Lance', type: 'special', startup: 12, active: 4, recovery: 23,
      damage: 52, chip: 5, hitstun: 23, blockstun: 14, hitstop: 8, guard: 'mid',
      hitbox: { x: 32, y: 52, w: 72, h: 44 }, kbx: 3, cost: 25, meterGain: 0,
      cancels: ['super'], anim: 'cast', projectile: { type: 'ice', speed: 12.5, life: 82, w: 70, h: 34, y: 66, slow: 0.6, slowFrames: 110 },
      sfx: 'specialIce', air: true,
    }),
    super: move({
      id: 'super', name: 'Absolute Zero', type: 'super', startup: 17, active: 12, recovery: 30,
      damage: 190, chip: 24, hitstun: 52, blockstun: 28, hitstop: 14, guard: 'mid',
      hitbox: { x: -220, y: 0, w: 700, h: 220 }, kbx: 7, kby: 6, launch: true,
      cost: 100, meterGain: 0, invuln: [0, 16], anim: 'superfreeze', super: true, shake: 3,
      slow: 0.55, slowFrames: 180, unblockable: false, screen: true,
    }),
    assist: move({
      id: 'assist', name: 'Frost Wall', type: 'assist', startup: 18, active: 5, recovery: 22,
      damage: 48, hitstun: 22, blockstun: 14, hitstop: 8, hitbox: { x: 0, y: 30, w: 108, h: 96 },
      kbx: 4, kby: 3, slow: 0.62, slowFrames: 90, anim: 'cast', guard: 'mid', assist: true,
    }),
    awakening: { name: 'Permafrost', color: '#a5e8ff', duration: 660, damage: 1.16, speed: 1.12, defense: 0.82 },
    stage: 'glacier',
  },
  {
    id: 'terra', name: 'TERRA', title: 'Stone Titan', archetype: 'Grappler',
    tagline: 'The earth answers to me.',
    color: '#b7a06a', color2: '#57462a', energy: '#ffd98a',
    stats: { ...baseStats, health: 1160, walk: 2.8, run: 5.5, jump: 11.0, air: 2.7, power: 1.18, defense: 0.9, weight: 1.35 },
    bars: { power: 5, speed: 2, range: 3, tech: 3 },
    accessory: accessories.terra,
    normals: normals({ speed: 0.9, power: 1.15 }),
    special: move({
      id: 'special', name: 'Seismic Slam', type: 'special', startup: 15, active: 6, recovery: 26,
      damage: 62, chip: 6, hitstun: 26, blockstun: 16, hitstop: 10, guard: 'low',
      hitbox: { x: 20, y: 0, w: 96, h: 60 }, kbx: 4.4, kby: 6, knockdown: true,
      cost: 25, meterGain: 0, cancels: ['super'], anim: 'slam',
      projectile: { type: 'quake', speed: 7.2, life: 86, w: 64, h: 54, y: 10, low: true, knockdown: true },
      sfx: 'specialQuake', air: false, shake: 2,
    }),
    super: move({
      id: 'super', name: 'Worldbreaker', type: 'super', startup: 12, active: 8, recovery: 34,
      damage: 230, chip: 0, hitstun: 40, blockstun: 0, hitstop: 16, guard: 'unblockable',
      hitbox: { x: 8, y: 0, w: 168, h: 150 }, unblockable: true, throw: true, commandGrab: true,
      kbx: 9, kby: 10, cost: 100, meterGain: 0, invuln: [2, 18], anim: 'supertitan',
      super: true, shake: 4, hardKnockdown: true, grappleRange: 160,
    }),
    assist: move({
      id: 'assist', name: 'Boulder Toss', type: 'assist', startup: 20, active: 4, recovery: 22,
      damage: 60, hitstun: 25, blockstun: 15, hitstop: 9, hitbox: { x: 0, y: 46, w: 92, h: 70 },
      kbx: 5.5, kby: 5, anim: 'toss', guard: 'mid', assist: true, knockdown: true,
    }),
    awakening: { name: 'Colossus', color: '#ffd27a', duration: 600, damage: 1.28, speed: 1.1, defense: 0.76 },
    stage: 'temple',
  },
  {
    id: 'nyx', name: 'NYX', title: 'Night Shade', archetype: 'Assassin',
    tagline: 'You will never see the blade.',
    color: '#a675ff', color2: '#3a1a6e', energy: '#d7b8ff',
    stats: { ...baseStats, health: 900, walk: 3.7, run: 7.0, jump: 13.0, air: 3.9, power: 1.04, defense: 1.06 },
    bars: { power: 4, speed: 5, range: 2, tech: 5 },
    accessory: accessories.nyx,
    normals: normals({ speed: 1.08, power: 1.04 }),
    special: move({
      id: 'special', name: 'Shadow Step', type: 'special', startup: 10, active: 6, recovery: 21,
      damage: 64, chip: 5, hitstun: 28, blockstun: 15, hitstop: 9, guard: 'mid',
      hitbox: { x: 6, y: 30, w: 104, h: 92 }, kbx: 5.4, kby: 2, cost: 25, meterGain: 0,
      cancels: ['super'], invuln: [0, 13], anim: 'shadowstep', teleportBehind: true,
      sfx: 'specialShadow', air: false,
    }),
    super: move({
      id: 'super', name: 'Nightfall Execution', type: 'super', startup: 10, active: 38, recovery: 26,
      damage: 20, chip: 9, hitstun: 22, blockstun: 12, hitstop: 3, guard: 'mid',
      hitbox: { x: 2, y: 18, w: 150, h: 120 }, kbx: 1.8, cost: 100, meterGain: 0,
      multi: { count: 9, interval: 4, final: { damage: 38, kbx: 9, kby: 9, launch: true } },
      invuln: [0, 16], anim: 'superexecute', teleportBehind: true, super: true, shake: 2,
    }),
    assist: move({
      id: 'assist', name: 'Umbral Slash', type: 'assist', startup: 14, active: 5, recovery: 17,
      damage: 56, hitstun: 25, blockstun: 14, hitstop: 9, hitbox: { x: 0, y: 30, w: 118, h: 86 },
      kbx: 5.8, kby: 4, anim: 'slash', guard: 'mid', assist: true,
    }),
    awakening: { name: 'Eclipse', color: '#c9a0ff', duration: 600, damage: 1.22, speed: 1.2, defense: 0.9 },
    stage: 'void',
  },
]

export const ROSTER_BY_ID = Object.fromEntries(ROSTER.map((c) => [c.id, c]))

export function getMoves(char) {
  return {
    ...char.normals,
    special: char.special,
    super: char.super,
    assist: char.assist,
    tag: move({
      id: 'tag', name: 'Tag Strike', type: 'tag', startup: 9, active: 4, recovery: 16,
      damage: 48, hitstun: 22, blockstun: 13, hitstop: 8, guard: 'mid',
      hitbox: { x: 12, y: 30, w: 100, h: 88 }, kbx: 5, kby: 2, meterGain: 10, anim: 'tag',
      sfx: 'tag', hitSfx: 'hitMedium',
    }),
  }
}

export const MOVE_LABELS = {
  light: 'L', medium: 'M', heavy: 'H', special: 'Special', super: 'Super',
  crouchLight: 'c.L', crouchMedium: 'c.M', crouchHeavy: 'c.H',
  airLight: 'j.L', airMedium: 'j.M', airHeavy: 'j.H', throw: 'Throw',
}

export function stageFor(char) {
  return char.stage || stages[0]
}
