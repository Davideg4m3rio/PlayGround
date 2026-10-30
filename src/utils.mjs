export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v)
export const lerp = (a, b, t) => a + (b - a) * t
export const damp = (a, b, rate, dt) => lerp(a, b, 1 - Math.exp(-rate * dt))
export const sign = (v) => (v < 0 ? -1 : v > 0 ? 1 : 0)
export const approach = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target))
export const easeOut = (t) => 1 - (1 - clamp(t, 0, 1)) ** 3
export const easeInOut = (t) => {
  t = clamp(t, 0, 1)
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}
export const easeBack = (t) => {
  t = clamp(t, 0, 1)
  const c = 1.70158
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}
export const rad = (deg) => (deg * Math.PI) / 180
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1)
export const overlap = (a, b) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
export const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length]
}

export function fmtNumber(n) {
  return Math.round(n).toLocaleString('en-US')
}

export function timeString(frames) {
  const total = Math.max(0, Math.ceil(frames / 60))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export const SIDE_COLORS = [
  { main: '#43d9ff', glow: 'rgba(67,217,255,0.65)', deep: '#0a6c8f' },
  { main: '#ff4d6d', glow: 'rgba(255,77,109,0.65)', deep: '#8f1030' },
]
