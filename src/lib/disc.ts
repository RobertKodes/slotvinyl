import { familyColor, ink, type Family } from './palette.ts'

export type Groove = {
  theta: number
  span: number
  radius: number
  family: Family
  failed: boolean
  blank: boolean
}

export type DiscModel = {
  grooves: Groove[]
  cutRadius: number
  outerR: number
  innerR: number
  labelR: number
  side: number
  catalog: string
  size: number
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
}

const MAX_GROOVES = 3600

export function createDisc(pixelSize: number): DiscModel {
  const canvas = document.createElement('canvas')
  canvas.width = pixelSize
  canvas.height = pixelSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('disc canvas')
  const half = pixelSize / 2
  const outerR = half * 0.96
  const labelR = half * 0.28
  const innerR = labelR + half * 0.04
  const disc: DiscModel = {
    grooves: [],
    cutRadius: outerR,
    outerR,
    innerR,
    labelR,
    side: 1,
    catalog: '000000',
    size: pixelSize,
    canvas,
    ctx,
  }
  paintDisc(disc)
  return disc
}

export function resizeDisc(disc: DiscModel, pixelSize: number): void {
  if (pixelSize === disc.size) return
  const scale = pixelSize / disc.size
  disc.size = pixelSize
  disc.canvas.width = pixelSize
  disc.canvas.height = pixelSize
  disc.outerR *= scale
  disc.innerR *= scale
  disc.labelR *= scale
  disc.cutRadius *= scale
  for (const g of disc.grooves) {
    g.radius *= scale
  }
  paintDisc(disc)
}

export function stampCatalog(disc: DiscModel, slot: number): void {
  if (disc.catalog !== '000000' || !slot) return
  disc.catalog = String(slot).slice(-6).padStart(6, '0')
  paintLabel(disc)
}

export function resetSide(disc: DiscModel, slot: number): void {
  disc.grooves.length = 0
  disc.cutRadius = disc.outerR
  disc.side += 1
  disc.catalog = String(slot).slice(-6).padStart(6, '0')
  paintDisc(disc)
}

export function addGroove(disc: DiscModel, groove: Groove): void {
  disc.grooves.push(groove)
  if (disc.grooves.length > MAX_GROOVES) disc.grooves.splice(0, disc.grooves.length - MAX_GROOVES)
  if (disc.grooves.length > 0 && disc.grooves.length % 90 === 0) {
    paintDisc(disc)
    return
  }
  strokeGroove(disc, groove)
}

/** Full rebuild — resize, new side, or first paint. */
export function paintDisc(disc: DiscModel): void {
  const { ctx, size, outerR, innerR, cutRadius } = disc
  const cx = size / 2
  const cy = size / 2
  ctx.clearRect(0, 0, size, size)

  ctx.beginPath()
  ctx.arc(cx, cy, outerR + 1, 0, Math.PI * 2)
  ctx.fillStyle = ink.lacquer
  ctx.fill()

  const lacquer = ctx.createRadialGradient(cx - outerR * 0.2, cy - outerR * 0.25, outerR * 0.1, cx, cy, outerR)
  lacquer.addColorStop(0, '#1A1512')
  lacquer.addColorStop(0.45, '#100D0B')
  lacquer.addColorStop(1, '#070605')
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.fillStyle = lacquer
  ctx.fill()

  // Micro-rings on the whole blank so uncut lacquer still reads as acetate.
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.028)'
  ctx.lineWidth = 0.8
  const step = Math.max(2.2, size / 280)
  for (let r = innerR; r < outerR; r += step) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  // Cut region sits outside cutRadius (lathe works outside → in).
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, outerR, 0, Math.PI * 2)
  ctx.arc(cx, cy, Math.max(cutRadius, innerR), 0, Math.PI * 2, true)
  ctx.clip()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 1
  for (let r = cutRadius; r < outerR; r += step * 0.7) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.restore()

  for (const g of disc.grooves) strokeGroove(disc, g)
  paintLabel(disc)
}

function strokeGroove(disc: DiscModel, g: Groove): void {
  const { ctx, size } = disc
  const cx = size / 2
  const cy = size / 2
  const a0 = g.theta - g.span * 0.5
  const a1 = g.theta + g.span * 0.5
  ctx.save()
  if (g.blank && !g.failed) {
    ctx.strokeStyle = 'rgba(18,12,8,0.7)'
    ctx.globalAlpha = 1
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(cx, cy, g.radius, a0, a1)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(232,210,170,0.28)'
    ctx.lineWidth = 1.1
    ctx.beginPath()
    ctx.arc(cx, cy, g.radius + 0.9, a0, a1)
    ctx.stroke()
    ctx.restore()
    return
  }
  ctx.strokeStyle = familyColor[g.family]
  ctx.globalAlpha = g.failed ? 0.95 : 0.92
  ctx.lineWidth = g.failed ? 3.1 : 2.35
  ctx.lineCap = 'round'
  ctx.beginPath()
  if (g.failed) {
    ctx.arc(cx, cy, g.radius, a0, a0 + g.span * 0.28)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, g.radius, a1 - g.span * 0.28, a1)
    ctx.stroke()
    ctx.strokeStyle = ink.oxbloodBright
    ctx.globalAlpha = 0.9
    ctx.lineWidth = 1.6
    ctx.beginPath()
    const mid = g.theta
    ctx.moveTo(cx + Math.cos(mid) * (g.radius - 5), cy + Math.sin(mid) * (g.radius - 5))
    ctx.lineTo(cx + Math.cos(mid) * (g.radius + 7), cy + Math.sin(mid) * (g.radius + 8))
    ctx.stroke()
  } else {
    ctx.arc(cx, cy, g.radius, a0, a1)
    ctx.stroke()
  }
  ctx.restore()
}

function paintLabel(disc: DiscModel): void {
  const { ctx, size, labelR, side, catalog } = disc
  const cx = size / 2
  const cy = size / 2
  ctx.beginPath()
  ctx.arc(cx, cy, labelR, 0, Math.PI * 2)
  ctx.fillStyle = ink.cream
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, labelR * 0.92, 0, Math.PI * 2)
  ctx.strokeStyle = '#C4B7A0'
  ctx.lineWidth = 1.2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy, labelR * 0.18, 0, Math.PI * 2)
  ctx.fillStyle = ink.lacquer
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx, cy, labelR * 0.08, 0, Math.PI * 2)
  ctx.fillStyle = ink.aluminum
  ctx.fill()

  ctx.fillStyle = '#2A2218'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `italic ${Math.max(11, labelR * 0.22)}px "Instrument Serif", serif`
  ctx.fillText('slotvinyl', cx, cy - labelR * 0.42)
  ctx.font = `${Math.max(8, labelR * 0.12)}px "IBM Plex Mono", monospace`
  ctx.fillStyle = ink.oxblood
  ctx.fillText('MAINNET', cx, cy - labelR * 0.18)
  ctx.fillStyle = '#5A4E40'
  ctx.fillText(`SIDE ${roman(side)}`, cx, cy + labelR * 0.28)
  ctx.fillText(catalog, cx, cy + labelR * 0.48)
  ctx.font = `${Math.max(7, labelR * 0.1)}px "IBM Plex Mono", monospace`
  ctx.fillText('33⅓ SLOT', cx, cy + labelR * 0.64)
}

function roman(n: number): string {
  const v = ((n - 1) % 20) + 1
  const map: [number, string][] = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ]
  let left = v
  let out = ''
  for (const [k, s] of map) {
    while (left >= k) {
      out += s
      left -= k
    }
  }
  return out
}
