import { clamp, lerp, rad } from './utils.mjs'

const TAU = Math.PI * 2

function hash(n) {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

function hexA(hex, a) {
  const h = parseInt(hex.slice(1), 16)
  return `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${a})`
}

function verticalGradient(ctx, W, H, colors) {
  const g = ctx.createLinearGradient(0, 0, 0, H)
  const n = colors.length - 1
  colors.forEach((c, i) => g.addColorStop(i / n, c))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  return g
}

function stars(ctx, W, H, t, count = 100, amount = 1) {
  ctx.save()
  for (let i = 0; i < count; i++) {
    const x = hash(i * 3.1) * W
    const y = hash(i * 7.7) * H * 0.62
    const tw = 0.4 + Math.sin(t * 1.4 + i * 2.2) * 0.3
    ctx.globalAlpha = clamp(tw, 0.05, 0.8) * amount
    ctx.fillStyle = i % 7 === 0 ? '#b9e8ff' : '#ffffff'
    const r = 0.6 + hash(i * 11.3) * 1.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
  }
  ctx.restore()
}

function moon(ctx, x, y, r, color = '#eaf7ff') {
  ctx.save()
  const g = ctx.createRadialGradient(x, y, r * 0.3, x, y, r * 4)
  g.addColorStop(0, hexA(color, 0.5))
  g.addColorStop(0.35, hexA(color, 0.12))
  g.addColorStop(1, hexA(color, 0))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r * 4, 0, TAU)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(x, y, r, 0, TAU)
  ctx.fill()
  ctx.fillStyle = 'rgba(20,35,60,0.12)'
  ctx.beginPath()
  ctx.arc(x - r * 0.3, y - r * 0.2, r * 0.22, 0, TAU)
  ctx.arc(x + r * 0.32, y + r * 0.28, r * 0.15, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function mountains(ctx, W, H, baseY, offset, color, seed, height, count = 9, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(-20, baseY)
  for (let i = 0; i <= count; i++) {
    const x = (i / count) * (W + 80) - 40 + offset
    const h = height * (0.4 + hash(seed + i * 2.7) * 0.9)
    ctx.lineTo(x, baseY - h)
    ctx.lineTo(x + (W / count) * 0.5, baseY - h * 0.45)
  }
  ctx.lineTo(W + 20, baseY)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function cityLayer(ctx, W, H, baseY, offset, color, seed, scale, winColor, density = 1) {
  ctx.save()
  ctx.fillStyle = color
  const unit = 46 * scale
  const start = -unit + ((offset % unit) + unit) % unit
  let x = start
  let i = 0
  while (x < W + unit) {
    const h = (28 + hash(seed + i * 1.7) * 150) * scale
    const w = (24 + hash(seed + i * 3.1) * 34) * scale
    ctx.fillRect(x, baseY - h, w, h + 4)
    if (winColor && hash(seed + i * 5.3) * density > 0.35) {
      ctx.fillStyle = winColor
      const cols = Math.max(1, Math.floor(w / (7 * scale)))
      const rows = Math.max(2, Math.floor(h / (11 * scale)))
      for (let cx = 0; cx < cols; cx++) {
        for (let cy = 0; cy < rows; cy++) {
          if (hash(seed + i * 13.1 + cx * 3.7 + cy * 9.1) > 0.55) {
            ctx.globalAlpha = 0.25 + hash(i + cx + cy) * 0.6
            ctx.fillRect(x + 4 * scale + cx * 7 * scale, baseY - h + 6 * scale + cy * 11 * scale, 2.2 * scale, 3.2 * scale)
          }
        }
      }
      ctx.globalAlpha = 1
      ctx.fillStyle = color
    }
    x += w + 5 * scale
    i++
  }
  ctx.restore()
}

function templeSilhouette(ctx, W, H, baseY, offset, color, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  const cx = W * 0.5 - offset * 0.12
  // torii gate
  ctx.fillRect(cx - 120, baseY - 190, 12, 190)
  ctx.fillRect(cx + 108, baseY - 190, 12, 190)
  ctx.fillRect(cx - 160, baseY - 196, 320, 14)
  ctx.fillRect(cx - 142, baseY - 222, 284, 12)
  ctx.beginPath()
  ctx.moveTo(cx - 166, baseY - 228)
  ctx.quadraticCurveTo(cx, baseY - 260, cx + 166, baseY - 228)
  ctx.lineTo(cx + 152, baseY - 216)
  ctx.quadraticCurveTo(cx, baseY - 242, cx - 152, baseY - 216)
  ctx.closePath()
  ctx.fill()
  // pagoda
  ctx.fillRect(cx - 18, baseY - 260, 36, 260)
  for (let i = 0; i < 4; i++) {
    const y = baseY - 260 + i * 44
    const w = 96 - i * 16
    ctx.beginPath()
    ctx.moveTo(cx - w, y)
    ctx.quadraticCurveTo(cx, y - 24, cx + w, y)
    ctx.lineTo(cx + w * 0.8, y + 8)
    ctx.lineTo(cx - w * 0.8, y + 8)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

function floor(ctx, W, H, groundY, stage, cam, opts = {}) {
  const bottom = H + 10
  const g = ctx.createLinearGradient(0, groundY - 40, 0, bottom)
  g.addColorStop(0, opts.top || stage.floor)
  g.addColorStop(1, opts.bottom || '#05060b')
  ctx.fillStyle = g
  ctx.fillRect(0, groundY, W, bottom - groundY)

  ctx.save()
  ctx.strokeStyle = hexA(stage.accent, opts.gridAlpha ?? 0.16)
  ctx.lineWidth = 1
  const offset = ((cam.camX * cam.scale) % 120 + 120) % 120
  for (let i = -2; i < W / 120 + 3; i++) {
    const x = i * 120 + offset
    ctx.beginPath()
    ctx.moveTo(x, groundY)
    ctx.lineTo(x + (x - W / 2) * 0.75, bottom)
    ctx.stroke()
  }
  for (let i = 1; i < 11; i++) {
    const t = i / 10
    const y = groundY + (bottom - groundY) * t * t
    ctx.globalAlpha = 1 - t
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(W, y)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const glow = ctx.createLinearGradient(0, groundY - 4, 0, groundY + 8)
  glow.addColorStop(0, hexA(stage.accent, 0.55))
  glow.addColorStop(1, hexA(stage.accent, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, groundY - 3, W, 12)
  ctx.restore()
}

function arenaWalls(ctx, W, H, groundY, cam, stage) {
  ctx.save()
  for (const side of [-1, 1]) {
    const x = W / 2 + (side * 1220 - cam.camX) * cam.scale
    if (x < -100 || x > W + 100) continue
    const g = ctx.createLinearGradient(x, 0, x + side * 70, 0)
    g.addColorStop(0, hexA(stage.accent, 0.32))
    g.addColorStop(1, hexA(stage.accent, 0))
    ctx.fillStyle = g
    ctx.fillRect(Math.min(x, x + side * 70), groundY - 420, 70, 430)
    ctx.strokeStyle = hexA(stage.accent, 0.5)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x, groundY - 430)
    ctx.lineTo(x, groundY)
    ctx.stroke()
    for (let i = 0; i < 9; i++) {
      ctx.globalAlpha = 0.15 + hash(i + side * 4) * 0.3
      ctx.beginPath()
      ctx.arc(x, groundY - 30 - i * 46, 2 + hash(i * 3.1) * 3, 0, TAU)
      ctx.fillStyle = stage.accent
      ctx.fill()
    }
  }
  ctx.restore()
}

function neonStage(ctx, W, H, cam, stage, t) {
  verticalGradient(ctx, W, H, [stage.sky[0], stage.sky[1], stage.sky[2]])
  const horizon = cam.groundY
  stars(ctx, W, H, t, 70, 0.6)
  moon(ctx, W * 0.78, H * 0.18, 34, '#d7f2ff')

  const drift = cam.camX * cam.scale
  ctx.save()
  ctx.globalAlpha = 0.2
  for (let i = 0; i < 4; i++) {
    const y = H * 0.22 + i * 30
    const g = ctx.createLinearGradient(0, y, 0, y + 20)
    g.addColorStop(0, 'rgba(140,90,220,0)')
    g.addColorStop(0.5, 'rgba(140,90,220,0.35)')
    g.addColorStop(1, 'rgba(140,90,220,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, y, W, 20)
  }
  ctx.restore()

  cityLayer(ctx, W, H, horizon - 36, drift * 0.08, '#14122c', 11, 0.75, '#5c6bff', 0.7)
  cityLayer(ctx, W, H, horizon - 6, drift * 0.16, '#0e0d22', 29, 1.05, '#ff5ca8', 0.8)
  cityLayer(ctx, W, H, horizon + 28, drift * 0.28, '#090819', 43, 1.35, '#4fe3ff', 0.6)

  // neon signs
  const signX = ((W * 0.24 - drift * 0.2) % (W + 400) + W + 400) % (W + 400) - 200
  ctx.save()
  ctx.translate(signX, H * 0.31)
  ctx.rotate(-0.03)
  ctx.shadowColor = '#ff4d9d'
  ctx.shadowBlur = 24
  ctx.fillStyle = '#ff4d9d'
  ctx.font = '700 34px "Arial Black", Impact, sans-serif'
  ctx.fillText('STICK', 0, 0)
  ctx.font = '700 18px "Arial Narrow", Arial, sans-serif'
  ctx.fillStyle = '#8ff6ff'
  ctx.shadowColor = '#4fe3ff'
  ctx.fillText('NIGHT CIRCUIT', 4, 28)
  ctx.restore()
  ctx.save()
  ctx.translate(W * 0.72 + Math.sin(t * 0.2) * 8, H * 0.25)
  ctx.shadowColor = '#4fe3ff'
  ctx.shadowBlur = 20
  ctx.strokeStyle = '#4fe3ff'
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, 76, 120)
  ctx.font = '700 20px "Arial Narrow", Arial, sans-serif'
  ctx.fillStyle = '#bff8ff'
  ctx.fillText('FIGHT', 13, 40)
  ctx.fillText('CLUB', 20, 66)
  ctx.fillStyle = '#ff4d9d'
  ctx.beginPath()
  ctx.arc(38, 94, 7, 0, TAU)
  ctx.fill()
  ctx.restore()

  floor(ctx, W, H, horizon, stage, cam, { top: '#12142a', bottom: '#07070f', gridAlpha: 0.12 })
  arenaWalls(ctx, W, H, horizon, cam, stage)
}

function templeStage(ctx, W, H, cam, stage, t) {
  verticalGradient(ctx, W, H, ['#22142e', '#7c3350', '#f09565', '#ffd0a3'])
  const horizon = cam.groundY
  const sunX = W * 0.68
  const sunY = H * 0.34
  const sg = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 150)
  sg.addColorStop(0, 'rgba(255,242,205,0.98)')
  sg.addColorStop(0.22, 'rgba(255,190,120,0.85)')
  sg.addColorStop(0.55, 'rgba(255,120,90,0.28)')
  sg.addColorStop(1, 'rgba(255,120,90,0)')
  ctx.fillStyle = sg
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffe6ba'
  ctx.beginPath()
  ctx.arc(sunX, sunY, 48, 0, TAU)
  ctx.fill()

  const drift = cam.camX * cam.scale
  mountains(ctx, W, H, horizon - 36, drift * 0.05, '#492334', 7, 150, 8, 0.9)
  mountains(ctx, W, H, horizon + 12, drift * 0.12, '#2d1826', 19, 96, 7, 1)
  templeSilhouette(ctx, W, H, horizon, drift, '#1b101a', 0.9)

  ctx.save()
  ctx.globalAlpha = 0.55
  for (let i = 0; i < 9; i++) {
    const x = ((i / 9) * (W + 300) - drift * 0.1 + Math.sin(t * 0.08 + i) * 30 + W + 300) % (W + 300) - 150
    const y = H * (0.22 + hash(i * 4.3) * 0.24)
    const r = 60 + hash(i * 9.1) * 90
    const g = ctx.createRadialGradient(x, y, 8, x, y, r)
    g.addColorStop(0, 'rgba(255,214,190,0.5)')
    g.addColorStop(1, 'rgba(255,180,150,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(x, y, r, r * 0.22, 0, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  // birds
  ctx.strokeStyle = 'rgba(40,20,30,0.6)'
  ctx.lineWidth = 2
  for (let i = 0; i < 6; i++) {
    const x = ((t * 32 + i * 70 - drift * 0.05) % (W + 120) + W + 120) % (W + 120) - 60
    const y = H * 0.2 + Math.sin(t * 0.7 + i) * 8 + i * 9
    ctx.beginPath()
    ctx.moveTo(x - 7, y)
    ctx.quadraticCurveTo(x - 3, y - 4, x, y)
    ctx.quadraticCurveTo(x + 3, y - 4, x + 7, y)
    ctx.stroke()
  }

  floor(ctx, W, H, horizon, stage, cam, { top: '#3a2b33', bottom: '#120d12', gridAlpha: 0.1 })
  // stone slabs
  ctx.save()
  ctx.strokeStyle = 'rgba(255,206,150,0.17)'
  ctx.lineWidth = 1.5
  for (let i = -4; i < 9; i++) {
    const x = W / 2 + (i * 220 - cam.camX) * cam.scale * 0.7
    ctx.beginPath()
    ctx.moveTo(x, horizon)
    ctx.lineTo(x + (x - W / 2) * 1.2, H)
    ctx.stroke()
  }
  ctx.restore()
  arenaWalls(ctx, W, H, horizon, cam, stage)
}

function volcanoStage(ctx, W, H, cam, stage, t) {
  verticalGradient(ctx, W, H, ['#12050a', '#3b0a11', '#8e1b18', '#d14722'])
  const horizon = cam.groundY
  const drift = cam.camX * cam.scale
  // volcano
  ctx.save()
  ctx.fillStyle = '#1b080c'
  ctx.beginPath()
  ctx.moveTo(-100, horizon)
  ctx.lineTo(W * 0.24 - drift * 0.04, horizon - 250)
  ctx.lineTo(W * 0.36 - drift * 0.04, horizon - 230)
  ctx.lineTo(W * 0.5 - drift * 0.04, horizon - 90)
  ctx.lineTo(W * 0.68 - drift * 0.04, horizon - 300)
  ctx.lineTo(W * 0.82 - drift * 0.04, horizon - 250)
  ctx.lineTo(W + 100, horizon)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
  // lava glow
  const lg = ctx.createRadialGradient(W * 0.5, horizon, 10, W * 0.5, horizon, 420)
  lg.addColorStop(0, 'rgba(255,120,40,0.5)')
  lg.addColorStop(0.5, 'rgba(255,80,20,0.14)')
  lg.addColorStop(1, 'rgba(255,60,0,0)')
  ctx.fillStyle = lg
  ctx.fillRect(0, horizon - 380, W, 420)

  mountains(ctx, W, H, horizon + 8, drift * 0.12, '#240a0d', 33, 100, 7, 1)
  // lava rivers
  ctx.save()
  ctx.strokeStyle = 'rgba(255,120,30,0.75)'
  ctx.lineWidth = 3
  for (let i = 0; i < 4; i++) {
    const y = horizon - 18 - i * 9
    ctx.globalAlpha = 0.35 - i * 0.06
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= W; x += 30) ctx.lineTo(x, y + Math.sin(x * 0.02 + t * 2 + i) * 3)
    ctx.stroke()
  }
  ctx.restore()

  floor(ctx, W, H, horizon, stage, cam, { top: '#2a1210', bottom: '#0c0506', gridAlpha: 0.18 })
  ctx.save()
  ctx.strokeStyle = 'rgba(255,120,50,0.35)'
  ctx.lineWidth = 2
  for (let i = 0; i < 9; i++) {
    const x = W / 2 + (i * 160 - 700 - cam.camX) * cam.scale * 0.45
    ctx.beginPath()
    ctx.moveTo(x, horizon + 40)
    ctx.lineTo(x + 28, horizon + 70)
    ctx.lineTo(x + 14, horizon + 110)
    ctx.lineTo(x + 36, horizon + 150)
    ctx.stroke()
  }
  ctx.restore()
  arenaWalls(ctx, W, H, horizon, cam, stage)
}

function glacierStage(ctx, W, H, cam, stage, t) {
  verticalGradient(ctx, W, H, ['#040c1b', '#082942', '#12506e', '#3c8fa8'])
  const horizon = cam.groundY
  stars(ctx, W, H, t, 90, 0.8)
  moon(ctx, W * 0.2, H * 0.16, 28, '#dff8ff')
  const drift = cam.camX * cam.scale

  // aurora ribbons
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 4; i++) {
    const g = ctx.createLinearGradient(0, H * 0.1, 0, H * 0.46)
    g.addColorStop(0, i % 2 ? 'rgba(110,255,200,0)' : 'rgba(130,180,255,0)')
    g.addColorStop(0.5, i % 2 ? 'rgba(110,255,200,0.2)' : 'rgba(130,180,255,0.16)')
    g.addColorStop(1, 'rgba(100,200,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.moveTo(0, H * 0.2)
    for (let x = 0; x <= W; x += 24) {
      ctx.lineTo(x, H * 0.2 + Math.sin(x * 0.006 + t * 0.5 + i * 1.7) * 46 + i * 18)
    }
    ctx.lineTo(W, H * 0.46)
    ctx.lineTo(0, H * 0.46)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  mountains(ctx, W, H, horizon - 18, drift * 0.06, '#102f47', 55, 190, 8, 0.95)
  mountains(ctx, W, H, horizon + 22, drift * 0.14, '#0a2133', 77, 120, 7, 1)
  // ice spires
  ctx.save()
  ctx.fillStyle = 'rgba(120,220,255,0.16)'
  for (let i = 0; i < 8; i++) {
    const x = ((i * 190 - drift * 0.2 + W * 1.5) % (W + 300)) - 150
    const h = 70 + hash(i * 5.2) * 140
    ctx.beginPath()
    ctx.moveTo(x - 26, horizon)
    ctx.lineTo(x, horizon - h)
    ctx.lineTo(x + 22, horizon)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  floor(ctx, W, H, horizon, stage, cam, { top: '#0d2a3d', bottom: '#04101a', gridAlpha: 0.2 })
  ctx.save()
  ctx.strokeStyle = 'rgba(180,240,255,0.3)'
  ctx.lineWidth = 1.5
  for (let i = -5; i < 10; i++) {
    const x = W / 2 + (i * 200 - cam.camX) * cam.scale * 0.6
    ctx.beginPath()
    ctx.moveTo(x, horizon + 20)
    ctx.lineTo(x + 40, horizon + 90)
    ctx.lineTo(x + 10, horizon + 170)
    ctx.stroke()
  }
  ctx.restore()
  arenaWalls(ctx, W, H, horizon, cam, stage)
}

function voidStage(ctx, W, H, cam, stage, t) {
  verticalGradient(ctx, W, H, ['#04020c', '#12082b', '#241146', '#0a0618'])
  const horizon = cam.groundY
  stars(ctx, W, H, t, 140, 0.9)
  const drift = cam.camX * cam.scale

  // nebula
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  for (let i = 0; i < 3; i++) {
    const x = W * (0.25 + i * 0.27) - drift * (0.02 + i * 0.01)
    const y = H * (0.32 + i * 0.08)
    const r = 180 + i * 60
    const g = ctx.createRadialGradient(x, y, 10, x, y, r)
    g.addColorStop(0, i === 1 ? 'rgba(80,255,220,0.17)' : 'rgba(140,80,255,0.19)')
    g.addColorStop(0.5, 'rgba(90,40,180,0.08)')
    g.addColorStop(1, 'rgba(30,10,80,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
  }
  ctx.restore()

  // portal ring
  ctx.save()
  const cx = W * 0.5 - drift * 0.08
  const cy = H * 0.36
  ctx.translate(cx, cy)
  for (let i = 0; i < 5; i++) {
    ctx.rotate(t * 0.08 * (i % 2 ? -1 : 1) + i)
    ctx.strokeStyle = hexA(i % 2 ? stage.accent2 : stage.accent, 0.15 + i * 0.04)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.ellipse(0, 0, 140 + i * 26, 40 + i * 10, 0, 0, TAU)
    ctx.stroke()
  }
  ctx.restore()

  // floating rocks
  ctx.save()
  for (let i = 0; i < 9; i++) {
    const x = ((i * 180 - drift * 0.12 + W * 2) % (W + 260)) - 130
    const y = H * (0.25 + hash(i * 7.1) * 0.32) + Math.sin(t * 0.6 + i) * 9
    const r = 12 + hash(i * 3.7) * 26
    ctx.fillStyle = 'rgba(20,12,40,0.9)'
    ctx.strokeStyle = hexA(stage.accent, 0.3)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(x - r, y)
    ctx.lineTo(x - r * 0.3, y - r * 0.7)
    ctx.lineTo(x + r * 0.8, y - r * 0.4)
    ctx.lineTo(x + r, y + r * 0.4)
    ctx.lineTo(x - r * 0.2, y + r * 0.7)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  }
  ctx.restore()

  floor(ctx, W, H, horizon, stage, cam, { top: '#0d0820', bottom: '#04020a', gridAlpha: 0.24 })
  ctx.save()
  ctx.strokeStyle = hexA(stage.accent, 0.25)
  ctx.lineWidth = 1.5
  for (let i = -3; i < 8; i++) {
    ctx.beginPath()
    ctx.arc(W / 2 + (i * 420 - cam.camX) * cam.scale * 0.5, horizon + 80, 180, Math.PI, TAU)
    ctx.stroke()
  }
  ctx.restore()
  arenaWalls(ctx, W, H, horizon, cam, stage)
}

function dojoStage(ctx, W, H, cam, stage, t) {
  verticalGradient(ctx, W, H, ['#090b0e', '#151a20', '#232c35'])
  const horizon = cam.groundY
  const drift = cam.camX * cam.scale
  // wall panels
  ctx.save()
  ctx.strokeStyle = 'rgba(120,140,160,0.08)'
  ctx.lineWidth = 2
  for (let i = 0; i < 14; i++) {
    const x = i * 90 - (drift * 0.05) % 90
    ctx.strokeRect(x, 0, 86, horizon)
  }
  // shoji windows
  for (let i = 0; i < 6; i++) {
    const x = ((i * 260 - drift * 0.12 + W * 2) % (W + 400)) - 200
    const y = H * 0.18
    ctx.fillStyle = 'rgba(255,214,150,0.08)'
    ctx.fillRect(x, y, 150, 150)
    ctx.strokeStyle = 'rgba(255,214,150,0.18)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(x, y, 150, 150)
    ctx.beginPath()
    ctx.moveTo(x + 50, y)
    ctx.lineTo(x + 50, y + 150)
    ctx.moveTo(x + 100, y)
    ctx.lineTo(x + 100, y + 150)
    ctx.moveTo(x, y + 50)
    ctx.lineTo(x + 150, y + 50)
    ctx.moveTo(x, y + 100)
    ctx.lineTo(x + 150, y + 100)
    ctx.stroke()
  }
  ctx.restore()

  // banners
  ctx.save()
  for (let i = 0; i < 3; i++) {
    const x = W * (0.16 + i * 0.32) - drift * 0.08
    const sway = Math.sin(t * 0.8 + i) * 3
    ctx.fillStyle = i === 1 ? 'rgba(180,50,50,0.75)' : 'rgba(38,42,50,0.9)'
    ctx.beginPath()
    ctx.moveTo(x - 18, H * 0.08)
    ctx.lineTo(x + 18, H * 0.08)
    ctx.lineTo(x + 20 + sway, H * 0.46)
    ctx.lineTo(x + sway, H * 0.43)
    ctx.lineTo(x - 18 + sway, H * 0.46)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = 'rgba(235,220,180,0.55)'
    ctx.font = '700 18px "Arial Narrow", Arial, sans-serif'
    ctx.fillText(i === 1 ? '斗' : '道', x - 8 + sway, H * 0.2)
  }
  ctx.restore()

  // lanterns
  for (let i = 0; i < 5; i++) {
    const x = ((i * 260 - drift * 0.14 + W) % (W + 260)) - 130
    const y = H * 0.12 + (i % 2) * 20
    const g = ctx.createRadialGradient(x, y, 2, x, y, 40)
    g.addColorStop(0, 'rgba(255,190,100,0.5)')
    g.addColorStop(1, 'rgba(255,150,60,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(x, y, 40, 0, TAU)
    ctx.fill()
    ctx.fillStyle = '#ffcf8a'
    ctx.beginPath()
    ctx.ellipse(x, y, 8, 12, 0, 0, TAU)
    ctx.fill()
  }

  floor(ctx, W, H, horizon, stage, cam, { top: '#2a2118', bottom: '#0b0806', gridAlpha: 0.17 })
  ctx.save()
  ctx.strokeStyle = 'rgba(255,210,140,0.14)'
  ctx.lineWidth = 1.5
  for (let i = -6; i < 12; i++) {
    const x = W / 2 + (i * 170 - cam.camX) * cam.scale * 0.55
    ctx.beginPath()
    ctx.moveTo(x, horizon)
    ctx.lineTo(x + (x - W / 2) * 0.6, H)
    ctx.stroke()
  }
  ctx.restore()
  arenaWalls(ctx, W, H, horizon, cam, stage)
}

export function drawStage(ctx, stage, cam, W, H, t) {
  switch (stage.style) {
    case 'temple': templeStage(ctx, W, H, cam, stage, t); break
    case 'volcano': volcanoStage(ctx, W, H, cam, stage, t); break
    case 'glacier': glacierStage(ctx, W, H, cam, stage, t); break
    case 'void': voidStage(ctx, W, H, cam, stage, t); break
    case 'dojo': dojoStage(ctx, W, H, cam, stage, t); break
    default: neonStage(ctx, W, H, cam, stage, t); break
  }
}

export function drawAmbient(ctx, ambient, stage, W, H, t) {
  ctx.save()
  const p = stage.particle
  for (const a of ambient) {
    const x = a.x
    const y = a.y
    if (p === 'rain') {
      ctx.strokeStyle = `rgba(150,200,255,${0.12 + a.a * 0.3})`
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x - 3, y + 16 + a.s * 6)
      ctx.stroke()
    } else if (p === 'snow') {
      ctx.fillStyle = `rgba(230,250,255,${0.2 + a.a * 0.55})`
      ctx.beginPath()
      ctx.arc(x, y, a.s * 1.4, 0, TAU)
      ctx.fill()
    } else if (p === 'ember') {
      const pulse = 0.5 + Math.sin(t * 4 + a.p) * 0.4
      ctx.fillStyle = `rgba(255,${120 + a.s * 40},40,${(0.2 + a.a * 0.5) * pulse})`
      ctx.beginPath()
      ctx.arc(x, y, a.s * 1.1, 0, TAU)
      ctx.fill()
    } else if (p === 'petal') {
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(a.rot)
      ctx.fillStyle = `rgba(255,190,200,${0.2 + a.a * 0.5})`
      ctx.beginPath()
      ctx.ellipse(0, 0, a.s * 2.2, a.s * 0.8, 0, 0, TAU)
      ctx.fill()
      ctx.restore()
    } else if (p === 'star') {
      ctx.fillStyle = `rgba(200,220,255,${0.15 + a.a * 0.5})`
      ctx.beginPath()
      ctx.arc(x, y, a.s * 0.8, 0, TAU)
      ctx.fill()
    } else {
      ctx.fillStyle = `rgba(255,230,180,${0.06 + a.a * 0.2})`
      ctx.beginPath()
      ctx.arc(x, y, a.s, 0, TAU)
      ctx.fill()
    }
  }
  ctx.restore()
}
