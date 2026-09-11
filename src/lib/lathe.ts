import { addGroove, createDisc, resetSide, resizeDisc, stampCatalog, type DiscModel } from './disc.ts'
import { ink, type Family } from './palette.ts'

export type Layout = {
  w: number
  h: number
  cx: number
  cy: number
  discR: number
  stylusAngle: number
}

export type Chip = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  r: number
  color: string
}

export type LatheView = {
  disc: DiscModel
  chips: Chip[]
  pitch: number
}

const STYLUS = 0.18

export function makeLayout(w: number, h: number): Layout {
  const mobile = w < 780
  const discR = Math.min(w, h) * (mobile ? 0.36 : 0.4)
  return {
    w,
    h,
    cx: mobile ? w * 0.5 : Math.min(w * 0.38, w - discR - 48),
    cy: mobile ? h * 0.46 : h * 0.54,
    discR,
    stylusAngle: STYLUS,
  }
}

export function createView(discPixels: number): LatheView {
  return {
    disc: createDisc(discPixels),
    chips: [],
    pitch: Math.max(0.45, discPixels / 900),
  }
}

export function stampView(view: LatheView, slot: number): void {
  if (slot) stampCatalog(view.disc, slot)
}

export function syncViewSize(view: LatheView, discPixels: number): void {
  view.pitch = Math.max(0.45, discPixels / 900)
  resizeDisc(view.disc, discPixels)
}

export function worldStylus(layout: Layout, cutRadiusCss: number): { x: number; y: number } {
  const r = cutRadiusCss
  return {
    x: layout.cx + Math.cos(layout.stylusAngle) * r,
    y: layout.cy + Math.sin(layout.stylusAngle) * r,
  }
}

export function cutOne(
  view: LatheView,
  layout: Layout,
  platterAngle: number,
  family: Family,
  failed: boolean,
  slot: number,
): void {
  const disc = view.disc
  if (disc.cutRadius <= disc.innerR) {
    resetSide(disc, slot)
  }
  const localTheta = layout.stylusAngle - platterAngle
  addGroove(disc, {
    theta: localTheta,
    span: failed ? 0.14 : 0.055 + Math.random() * 0.04,
    radius: disc.cutRadius,
    family,
    failed,
  })
  disc.cutRadius -= view.pitch * (failed ? 1.6 : 1)
  spawnChips(view, layout)
}

function spawnChips(view: LatheView, layout: Layout): void {
  const scale = (view.disc.size / 2) / layout.discR
  const cutCss = view.disc.cutRadius / scale
  const s = worldStylus(layout, cutCss)
  const tang = layout.stylusAngle + Math.PI / 2
  const n = 2 + (Math.random() < 0.4 ? 1 : 0)
  for (let i = 0; i < n; i++) {
    view.chips.push({
      x: s.x + (Math.random() - 0.5) * 4,
      y: s.y + (Math.random() - 0.5) * 4,
      vx: Math.cos(tang) * (0.4 + Math.random() * 1.2) + Math.cos(layout.stylusAngle) * 0.25,
      vy: Math.sin(tang) * (0.4 + Math.random() * 1.2) + 0.2,
      life: 0.7 + Math.random() * 0.5,
      r: 0.7 + Math.random() * 1.1,
      color: Math.random() < 0.25 ? ink.amber : ink.cream,
    })
  }
  if (view.chips.length > 180) view.chips.splice(0, view.chips.length - 180)
}

export function stepChips(view: LatheView, dt: number, reduced: boolean): void {
  if (reduced) {
    view.chips.length = 0
    return
  }
  for (const c of view.chips) {
    c.x += c.vx * dt * 60
    c.y += c.vy * dt * 60
    c.vy += 0.04 * dt * 60
    c.life -= dt
  }
  view.chips = view.chips.filter((c) => c.life > 0)
}

export function drawFrame(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  view: LatheView,
  platterAngle: number,
  held: boolean,
  feeNorm: number,
  reduced: boolean,
  live: boolean,
): void {
  const { w, h, cx, cy, discR } = layout
  ctx.clearRect(0, 0, w, h)
  drawBed(ctx, layout)
  drawWell(ctx, layout)

  const scale = view.disc.size / (discR * 2)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(reduced ? 0 : platterAngle)
  ctx.drawImage(view.disc.canvas, -discR, -discR, discR * 2, discR * 2)
  ctx.restore()

  drawGloss(ctx, layout)
  drawSpindle(ctx, layout)

  const cutCss = view.disc.cutRadius / scale
  drawCarriage(ctx, layout, cutCss, held, feeNorm, live)
  drawChips(ctx, view)
  drawLampCatch(ctx, layout)
}

function drawBed(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { cx, cy, discR, w, h } = layout
  const x = cx - discR * 1.35
  const y = cy - discR * 1.15
  const bw = Math.min(discR * 3.1, w - x - 12)
  const bh = Math.min(discR * 2.25, h - y - 8)
  rounded(ctx, x, y, bw, bh, 18)
  const metal = ctx.createLinearGradient(x, y, x + bw, y + bh)
  metal.addColorStop(0, '#8E877E')
  metal.addColorStop(0.35, '#B4ADA3')
  metal.addColorStop(0.55, '#7A746C')
  metal.addColorStop(1, '#4E4944')
  ctx.fillStyle = metal
  ctx.fill()
  ctx.save()
  ctx.clip()
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  for (let i = -bh; i < bw; i += 4) {
    ctx.beginPath()
    ctx.moveTo(x + i, y)
    ctx.lineTo(x + i + bh, y + bh)
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = 'rgba(20,16,12,0.55)'
  ctx.lineWidth = 1.2
  rounded(ctx, x, y, bw, bh, 18)
  ctx.stroke()

  screw(ctx, x + 22, y + 20, 5)
  screw(ctx, x + bw - 22, y + 20, 5)
  screw(ctx, x + 22, y + bh - 20, 5)
  screw(ctx, x + bw - 22, y + bh - 18, 5)
}

function drawWell(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { cx, cy, discR } = layout
  ctx.beginPath()
  ctx.arc(cx, cy, discR + 16, 0, Math.PI * 2)
  ctx.fillStyle = '#1A1714'
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, discR + 10, 0, Math.PI * 2)
  ctx.strokeStyle = '#5A534C'
  ctx.lineWidth = 6
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx, cy, discR + 3, 0, Math.PI * 2)
  ctx.strokeStyle = '#2E2924'
  ctx.lineWidth = 5
  ctx.stroke()
}

function drawGloss(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { cx, cy, discR } = layout
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, discR, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(
    cx - discR * 0.35,
    cy - discR * 0.4,
    discR * 0.05,
    cx - discR * 0.1,
    cy - discR * 0.15,
    discR * 0.9,
  )
  g.addColorStop(0, 'rgba(255,236,210,0.16)')
  g.addColorStop(0.35, 'rgba(255,220,180,0.04)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(cx - discR, cy - discR, discR * 2, discR * 2)
  ctx.restore()
}

function drawSpindle(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { cx, cy, discR } = layout
  const r = discR * 0.045
  ctx.beginPath()
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2)
  ctx.fillStyle = ink.aluminum
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = ink.aluminumDeep
  ctx.fill()
}

function drawCarriage(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  cutCss: number,
  held: boolean,
  feeNorm: number,
  live: boolean,
): void {
  const { cx, cy, discR, stylusAngle } = layout
  const outer = discR + 28
  const ox = cx + Math.cos(stylusAngle) * outer
  const oy = cy + Math.sin(stylusAngle) * outer
  const lift = held ? -16 : 0
  const sx = cx + Math.cos(stylusAngle) * cutCss
  const sy = cy + Math.sin(stylusAngle) * cutCss + lift
  const hx = ox + Math.cos(stylusAngle) * 54
  const hy = oy + Math.sin(stylusAngle) * 54 + lift * 0.3

  ctx.strokeStyle = '#6A645C'
  ctx.lineWidth = 7
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(cx + Math.cos(stylusAngle) * (discR * 0.2), cy + Math.sin(stylusAngle) * (discR * 0.2))
  ctx.lineTo(hx, hy)
  ctx.stroke()
  ctx.strokeStyle = '#C4BDB4'
  ctx.lineWidth = 2.2
  ctx.beginPath()
  ctx.moveTo(ox, oy + lift * 0.2)
  ctx.lineTo(hx, hy)
  ctx.stroke()

  // Headstock block
  ctx.save()
  ctx.translate(sx, sy)
  ctx.rotate(stylusAngle)
  rounded(ctx, -10, -9, 28, 18, 3)
  const head = ctx.createLinearGradient(-10, -9, 18, 9)
  head.addColorStop(0, '#D0CBC4')
  head.addColorStop(1, '#6E6860')
  ctx.fillStyle = head
  ctx.fill()
  ctx.strokeStyle = '#2E2A26'
  ctx.lineWidth = 0.8
  ctx.stroke()

  const glow = held ? 0.12 : 0.25 + feeNorm * 0.75
  const rad = 6 + feeNorm * 16
  ctx.globalCompositeOperation = 'lighter'
  const blaze = ctx.createRadialGradient(18, 0, 0, 18, 0, rad)
  blaze.addColorStop(0, `rgba(243,197,107,${0.95 * glow})`)
  blaze.addColorStop(0.35, `rgba(232,160,58,${0.55 * glow})`)
  blaze.addColorStop(1, 'rgba(232,160,58,0)')
  ctx.fillStyle = blaze
  ctx.beginPath()
  ctx.arc(18, 0, rad, 0, Math.PI * 2)
  ctx.fill()
  ctx.globalCompositeOperation = 'source-over'
  ctx.fillStyle = held ? '#8A7A58' : live ? ink.amberHot : ink.aluminum
  ctx.beginPath()
  ctx.arc(18, 0, 2.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  if (held) {
    ctx.font = '11px "IBM Plex Mono", monospace'
    ctx.fillStyle = ink.creamDim
    ctx.textAlign = 'left'
    ctx.fillText('CUTTER UP', hx - 12, hy - 16)
  }
}

function drawChips(ctx: CanvasRenderingContext2D, view: LatheView): void {
  for (const c of view.chips) {
    ctx.globalAlpha = Math.max(0, c.life)
    ctx.fillStyle = c.color
    ctx.beginPath()
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.globalAlpha = 1
}

function drawLampCatch(ctx: CanvasRenderingContext2D, layout: Layout): void {
  const { cx, cy, discR } = layout
  ctx.fillStyle = 'rgba(11,9,8,0.35)'
  ctx.beginPath()
  ctx.ellipse(cx + discR * 0.15, cy + discR * 1.08, discR * 0.7, 10, 0, 0, Math.PI * 2)
  ctx.fill()
}

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function screw(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#5A5550'
  ctx.fill()
  ctx.strokeStyle = '#2A2622'
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - r * 0.55, y)
  ctx.lineTo(x + r * 0.55, y)
  ctx.stroke()
}

export function hitCutter(layout: Layout, cutCss: number, x: number, y: number, held: boolean): boolean {
  const s = worldStylus(layout, cutCss)
  const dy = held ? -16 : 0
  const dx = x - s.x
  const ddy = y - (s.y + dy)
  return dx * dx + ddy * ddy < 38 * 38
}

export function hitDisc(layout: Layout, x: number, y: number): boolean {
  const dx = x - layout.cx
  const dy = y - layout.cy
  const d = Math.hypot(dx, dy)
  return d < layout.discR && d > 16
}

export function angleAt(layout: Layout, x: number, y: number): number {
  return Math.atan2(y - layout.cy, x - layout.cx)
}
