import { clamp, lerp, easeOut, easeInOut, rad } from './utils.mjs'

export const TAU = Math.PI * 2

function blendPair(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
}

export function blendSpec(a, b, t) {
  return {
    lean: lerp(a.lean, b.lean, t),
    pelvisY: lerp(a.pelvisY, b.pelvisY, t),
    lunge: lerp(a.lunge, b.lunge, t),
    headTilt: lerp(a.headTilt || 0, b.headTilt || 0, t),
    bodyRot: lerp(a.bodyRot || 0, b.bodyRot || 0, t),
    armF: blendPair(a.armF, b.armF, t),
    armB: blendPair(a.armB, b.armB, t),
    footF: [lerp(a.footF[0], b.footF[0], t), lerp(a.footF[1], b.footF[1], t)],
    footB: [lerp(a.footB[0], b.footB[0], t), lerp(a.footB[1], b.footB[1], t)],
    shoulder: lerp(a.shoulder || 0, b.shoulder || 0, t),
    torso: lerp(a.torso || 1, b.torso || 1, t),
    glow: b.glow || a.glow,
  }
}

export function mergeSpec(base, p) {
  const out = { ...base, ...p }
  if (p.footF) out.footF = p.footF.slice()
  if (p.footB) out.footB = p.footB.slice()
  if (p.armF) out.armF = p.armF.slice()
  if (p.armB) out.armB = p.armB.slice()
  return out
}

function legIK(pelvis, foot, l1 = 30, l2 = 30) {
  const dx = foot[0] - pelvis.x
  const dy = foot[1] - pelvis.y
  let d = Math.hypot(dx, dy)
  d = clamp(d, Math.abs(l1 - l2) + 0.5, l1 + l2 - 0.2)
  const base = Math.atan2(dy, dx)
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)
  const A = Math.acos(cosA)
  const kneeAngle = base + A
  const kx = pelvis.x + Math.cos(kneeAngle) * l1
  const ky = pelvis.y + Math.sin(kneeAngle) * l1
  return { knee: { x: kx, y: ky }, foot: { x: foot[0], y: foot[1] } }
}

export function computeJoints(spec) {
  const pelvis = { x: spec.lunge || 0, y: spec.pelvisY }
  const torsoTilt = rad(spec.lean)
  const torsoLen = 38 * (spec.torso || 1)
  const chest = {
    x: pelvis.x + Math.sin(torsoTilt) * torsoLen,
    y: pelvis.y + Math.cos(torsoTilt) * torsoLen,
  }
  const neck = {
    x: chest.x + Math.sin(torsoTilt) * 9,
    y: chest.y + Math.cos(torsoTilt) * 9,
  }
  const headTilt = rad((spec.headTilt || 0) + spec.lean * 0.5)
  const head = {
    x: neck.x + Math.sin(headTilt) * 12,
    y: neck.y + Math.cos(headTilt) * 12,
  }
  const shoulder = { x: chest.x - Math.sin(torsoTilt) * 2, y: chest.y - 2 }
  const arm = (angles) => {
    const upper = 21
    const fore = 20
    const a1 = rad(angles[0])
    const elbow = { x: shoulder.x + Math.cos(a1) * upper, y: shoulder.y + Math.sin(a1) * upper }
    const a2 = rad(angles[0] + angles[1])
    const hand = { x: elbow.x + Math.cos(a2) * fore, y: elbow.y + Math.sin(a2) * fore }
    return { elbow, hand }
  }
  const armF = arm(spec.armF)
  const armB = arm(spec.armB)
  const legF = legIK(pelvis, spec.footF)
  const legB = legIK(pelvis, spec.footB)
  const joints = { pelvis, chest, neck, head, shoulder, armF, armB, legF, legB, spec }
  if (spec.bodyRot) {
    const rot = spec.bodyRot
    const cos = Math.cos(rot)
    const sin = Math.sin(rot)
    const pivot = { x: pelvis.x, y: spec.pelvisY }
    const rotP = (pt) => {
      const dx = pt.x - pivot.x
      const dy = pt.y - pivot.y
      pt.x = pivot.x + dx * cos - dy * sin
      pt.y = pivot.y + dx * sin + dy * cos
    }
    rotP(chest); rotP(neck); rotP(head); rotP(shoulder)
    for (const k of ['elbow', 'hand']) { rotP(armF[k]); rotP(armB[k]) }
    for (const k of ['knee', 'foot']) { rotP(legF[k]); rotP(legB[k]) }
  }
  return joints
}

export function baseSpec(f, t) {
  const id = (f.index || 0) + (f.side || 0) * 3
  const breath = Math.sin(t * 2.4 + id) * 1.2
  const state = f.state
  const crouch = state === 'crouch' ? 1 : 0
  const walking = state === 'walk' || state === 'dash'
  const phase = (f.x || 0) * 0.11 + t * (state === 'dash' ? 20 : 10)
  const run = state === 'dash'
  const swing = walking ? Math.sin(phase) : 0
  const swing2 = walking ? Math.sin(phase + Math.PI) : 0
  const liftF = walking ? Math.max(0, Math.sin(phase)) * (run ? 15 : 8) : 0
  const liftB = walking ? Math.max(0, Math.sin(phase + Math.PI)) * (run ? 15 : 8) : 0
  let lean = 4 + breath * 0.1
  let pelvisY = 58 + breath * 0.25
  let footF = [16 + swing * (run ? 21 : 15), liftF]
  let footB = [-16 + swing2 * (run ? 21 : 15), liftB]
  let armF = [50 + swing2 * 10, 78]
  let armB = [-8 + swing * 10, 100]
  let headTilt = 0
  let bodyRot = 0

  if (crouch) {
    pelvisY = 40
    footF = [23, 0]
    footB = [-21, 0]
    lean = 14
    armF = [56, 88]
    armB = [5, 102]
  }

  if (state === 'dash') {
    lean = 29 + swing * 3
    pelvisY = 54
    footF = [22 + swing * 26, Math.max(0, swing) * 14]
    footB = [-22 + swing2 * 26, Math.max(0, swing2) * 14]
    armF = [-28 + swing2 * 18, 30]
    armB = [-60 + swing * 18, 24]
  }

  if (state === 'air' || (state === 'attack' && f.airborne)) {
    lean = clamp((f.vy || 0) * 0.7, -16, 22)
    pelvisY = 61
    footF = [20, 24 + Math.sin(t * 8 + id) * 3]
    footB = [-15, 34]
    armF = [40, 50]
    armB = [-40, 70]
    bodyRot = clamp(-(f.vy || 0) * 0.012, -0.18, 0.2)
  }

  if (state === 'hitstun') {
    lean = -24 + Math.sin(t * 22) * 2
    headTilt = -24
    armF = [28, 12]
    armB = [-42, 20]
    footF = [10, 0]
    footB = [-20, 4]
    bodyRot = f.airborne ? 0.16 : 0
  }

  if (state === 'blockstun') {
    lean = -8
    armF = [76, 92]
    armB = [53, 104]
    footF = [13, 0]
    footB = [-20, 0]
  }

  if (state === 'knockdown' || state === 'getup' || state === 'defeat') {
    const defeat = state === 'defeat'
    pelvisY = defeat ? 18 : 24
    lean = -20
    footF = [20, defeat ? 4 : 10]
    footB = [-18, 0]
    armF = [75, 20]
    armB = [-50, 10]
    bodyRot = defeat ? 1.48 : state === 'getup' ? 1.12 : 1.34
    headTilt = -12
  }

  if (state === 'dodge') {
    lean = -28
    pelvisY = 48
    footF = [-2, 12]
    footB = [-26, 0]
    armF = [-40, 40]
    armB = [-60, 40]
    bodyRot = 0.08
  }

  if (state === 'parry') {
    lean = -2
    armF = [86, 100]
    armB = [66, 112]
    footF = [16, 0]
    footB = [-18, 0]
  }

  if (state === 'tag' || state === 'grabbed') {
    if (state === 'tag') {
      pelvisY = 66
      lean = 22
      footF = [24, 28]
      footB = [-14, 40]
      armF = [-10, 28]
      armB = [-46, 40]
      bodyRot = 0.12
    } else {
      lean = 14
      armF = [30, 20]
      armB = [-30, 30]
      footF = [12, 6]
      footB = [-14, 6]
      headTilt = 10
    }
  }

  return {
    lean, pelvisY, lunge: 0, headTilt, bodyRot,
    armF, armB, footF, footB, shoulder: 0, torso: 1, glow: null,
  }
}

const ATTACK_POSES = {
  punch: {
    wind: { lean: -7, armF: [-155, 45], armB: [25, 80], footF: [10, 0], footB: [-20, 0], lunge: -2 },
    strike: { lean: 15, armF: [0, 2], armB: [-18, 98], footF: [25, 0], footB: [-21, 0], lunge: 8 },
  },
  kick: {
    wind: { lean: -12, footF: [-8, 18], footB: [-18, 0], armF: [38, 70], armB: [-42, 60], lunge: -3 },
    strike: { lean: -15, footF: [62, 56], footB: [-4, 0], armF: [20, 70], armB: [-58, 42], lunge: 4 },
  },
  heavy: {
    wind: { lean: -16, armF: [118, 24], armB: [88, 30], footF: [8, 0], footB: [-24, 0], lunge: -4 },
    strike: { lean: 31, armF: [-4, 6], armB: [-80, 16], footF: [30, 0], footB: [-28, 0], lunge: 12 },
  },
  lowpunch: {
    wind: { lean: 2, armF: [-130, 40], armB: [18, 80], lunge: -2 },
    strike: { lean: 22, armF: [-12, 2], armB: [-36, 76], lunge: 7 },
  },
  sweep: {
    wind: { lean: -2, footF: [-12, 12], armF: [42, 66], armB: [-30, 50], lunge: -2 },
    strike: { lean: -12, footF: [57, 6], footB: [-24, 0], armF: [26, 46], armB: [-50, 32], lunge: 5 },
  },
  launcher: {
    wind: { lean: 20, armF: [-80, 42], armB: [10, 70], lunge: -2 },
    strike: { lean: 7, armF: [83, 2], armB: [-42, 76], footF: [20, 0], footB: [-22, 0], lunge: 5 },
  },
  airpunch: {
    wind: { lean: -4, armF: [-120, 30], armB: [20, 60], lunge: -2 },
    strike: { lean: 20, armF: [-4, 0], armB: [-34, 70], footF: [20, 22], footB: [-12, 32], lunge: 5 },
  },
  airkick: {
    wind: { lean: -6, footF: [-8, 26], armF: [30, 50], armB: [-30, 50], lunge: -2 },
    strike: { lean: -12, footF: [60, 30], footB: [-6, 28], armF: [18, 50], armB: [-56, 30], lunge: 5 },
  },
  divekick: {
    wind: { lean: 12, footF: [4, 44], footB: [-10, 44], armF: [80, 20], armB: [50, 40], lunge: -2 },
    strike: { lean: 46, footF: [44, 6], footB: [-4, 10], armF: [-60, 20], armB: [-90, 20], lunge: 8, bodyRot: 0.18 },
  },
  throw: {
    wind: { lean: 4, armF: [-30, 70], armB: [-60, 60], lunge: -2 },
    strike: { lean: 24, armF: [-4, 20], armB: [-24, 30], footF: [24, 0], footB: [-20, 0], lunge: 8 },
  },
  uppercut: {
    wind: { lean: -12, armF: [-100, 30], armB: [0, 80], lunge: -3 },
    strike: { lean: 6, armF: [86, 0], armB: [-30, 90], footF: [18, 0], footB: [-20, 0], lunge: 5 },
  },
  slam: {
    wind: { lean: -18, armF: [116, 20], armB: [96, 20], lunge: -4 },
    strike: { lean: 38, armF: [-86, 4], armB: [-70, 10], footF: [28, 0], footB: [-25, 0], lunge: 10, bodyRot: 0.1 },
  },
  cast: {
    wind: { lean: -10, armF: [-155, 20], armB: [-120, 30], lunge: -2 },
    strike: { lean: 9, armF: [8, 0], armB: [-32, 100], footF: [18, 0], footB: [-20, 0], lunge: 4 },
  },
  slash: {
    wind: { lean: -10, armF: [-145, 40], armB: [10, 80], lunge: -2 },
    strike: { lean: 23, armF: [26, 8], armB: [-46, 74], footF: [26, 0], footB: [-24, 0], lunge: 9 },
  },
  flykick: {
    wind: { lean: -8, footF: [-16, 30], footB: [-24, 20], armF: [30, 40], armB: [-30, 40], lunge: -2 },
    strike: { lean: 54, footF: [58, 26], footB: [-20, 34], armF: [-60, 20], armB: [-90, 12], lunge: 12, bodyRot: -0.12 },
  },
  shadowstep: {
    wind: { lean: 18, armF: [-120, 30], armB: [0, 60], lunge: -2 },
    strike: { lean: 26, armF: [18, 12], armB: [-54, 50], footF: [30, 0], footB: [-25, 0], lunge: 10 },
  },
  superrush: {
    wind: { lean: -14, armF: [140, 20], armB: [100, 20], lunge: -4 },
    strike: { lean: 35, armF: [-2, 0], armB: [-12, 8], footF: [28, 0], footB: [-28, 0], lunge: 14 },
  },
  superslash: {
    wind: { lean: -14, armF: [-150, 30], armB: [20, 70], lunge: -4 },
    strike: { lean: 27, armF: [18, 0], armB: [-40, 60], footF: [30, 8], footB: [-24, 0], lunge: 12 },
  },
  superstorm: {
    wind: { lean: -12, armF: [-140, 20], armB: [-125, 30], lunge: 0 },
    strike: { lean: -2, armF: [88, 40], armB: [72, 50], footF: [18, 26], footB: [-18, 26], lunge: 0, bodyRot: 0.05 },
  },
  superfreeze: {
    wind: { lean: -4, armF: [-130, 20], armB: [-110, 20], lunge: 0 },
    strike: { lean: 2, armF: [80, 16], armB: [66, 20], footF: [20, 8], footB: [-20, 8], lunge: 0 },
  },
  supertitan: {
    wind: { lean: 6, armF: [-60, 40], armB: [-70, 40], lunge: -2 },
    strike: { lean: 22, armF: [-2, 18], armB: [-6, 18], footF: [26, 0], footB: [-26, 0], lunge: 10 },
  },
  superexecute: {
    wind: { lean: -8, armF: [-140, 30], armB: [0, 60], lunge: -3 },
    strike: { lean: 30, armF: [15, 6], armB: [-35, 40], footF: [30, 0], footB: [-24, 0], lunge: 13 },
  },
  tag: {
    wind: { lean: -6, armF: [-110, 40], armB: [20, 60], lunge: -2 },
    strike: { lean: 22, armF: [5, 10], armB: [-30, 70], footF: [26, 0], footB: [-22, 0], lunge: 10 },
  },
}

export function attackSpec(f, t) {
  const move = f.move
  if (!move) return baseSpec(f, t)
  const anim = move.anim || 'punch'
  const set = ATTACK_POSES[anim] || ATTACK_POSES.punch
  let baseFix = baseSpec(f, t)
  if (f.airborne) {
    baseFix = mergeSpec(baseFix, { armF: [40, 60], armB: [-30, 70] })
  }
  if (move.id && move.id.startsWith('crouch')) {
    baseFix = mergeSpec(baseFix, { pelvisY: 40, lean: 16, footF: [23, 0], footB: [-21, 0] })
  }
  const wind = mergeSpec(baseFix, set.wind)
  const strike = mergeSpec(baseFix, set.strike)
  const frame = f.moveFrame
  if (frame < move.startup) {
    const p = clamp(frame / Math.max(1, move.startup), 0, 1)
    if (p < 0.62) return blendSpec(baseFix, wind, easeOut(p / 0.62))
    const snap = (p - 0.62) / 0.38
    if (snap < 0.72) return wind
    return blendSpec(wind, strike, easeOut((snap - 0.72) / 0.28))
  }
  if (frame < move.startup + move.active) {
    const out = blendSpec(strike, strike, 1)
    const jitter = move.super ? Math.sin(t * 55) * 1.6 : 0
    out.lunge += jitter
    if (jitter > 0) {
      const k = jitter / 2
      out.armF = [out.armF[0] + k, out.armF[1]]
      out.armB = [out.armB[0] - k, out.armB[1]]
    }
    if (move.multi && Math.floor((frame - move.startup) / move.multi.interval) % 2 === 1) {
      out.armF = [out.armF[0] * 0.6 - 12, out.armF[1] * 0.6]
      out.armB = [out.armB[0] + 24, out.armB[1]]
    }
    return out
  }
  const rp = clamp((frame - move.startup - move.active) / Math.max(1, move.recovery), 0, 1)
  return blendSpec(strike, baseFix, easeInOut(clamp((rp - 0.18) / 0.82, 0, 1)))
}

export function fighterSpec(f, t) {
  const base = baseSpec(f, t)
  if (f.state === 'attack' && f.move) return attackSpec(f, t)
  if (f.state === 'blockstun' || (f.blockStance && !f.airborne)) {
    return mergeSpec(base, { lean: base.lean - 9, armF: [77, 94], armB: [58, 102] })
  }
  return base
}
