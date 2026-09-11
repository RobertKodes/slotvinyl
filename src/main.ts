import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './style.css'

import {
  createEngine,
  formatFee,
  formatSlot,
  formatTps,
  pollCuts,
  pollMeter,
  pollSlot,
  syncPlatter,
  takeCut,
} from './lib/engine.ts'
import {
  angleAt,
  createView,
  cutOne,
  drawFrame,
  hitCutter,
  hitDisc,
  makeLayout,
  stepChips,
  syncViewSize,
  stampView,
  type Layout,
} from './lib/lathe.ts'

const canvas = document.querySelector<HTMLCanvasElement>('#lathe')!
const holdBtn = document.querySelector<HTMLButtonElement>('#hold')!
const readSlot = document.querySelector('#read-slot')!
const readTps = document.querySelector('#read-tps')!
const readFee = document.querySelector('#read-fee')!
const readWire = document.querySelector('#read-wire')!
const desk = document.querySelector('#desk')!

function require2d(target: HTMLCanvasElement): CanvasRenderingContext2D {
  const c = target.getContext('2d')
  if (!c) throw new Error('2d')
  return c
}

const reducedMq = window.matchMedia('(prefers-reduced-motion: reduce)')
const eng = createEngine(reducedMq.matches)
reducedMq.addEventListener('change', () => {
  eng.reduced = reducedMq.matches
})

const view = createView(512)
let layout: Layout = makeLayout(800, 600)
let dpr = 1
let ctx = require2d(canvas)

function fit(): void {
  const rect = canvas.getBoundingClientRect()
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.max(1, Math.floor(rect.width * dpr))
  canvas.height = Math.max(1, Math.floor(rect.height * dpr))
  ctx = require2d(canvas)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  layout = makeLayout(rect.width, rect.height)
  const discPx = Math.round(layout.discR * 2 * dpr)
  syncViewSize(view, Math.max(280, discPx))
}

fit()
window.addEventListener('resize', fit)

function setHeld(next: boolean): void {
  eng.held = next
  holdBtn.setAttribute('aria-pressed', String(next))
  holdBtn.classList.toggle('is-held', next)
  holdBtn.innerHTML = next
    ? '<span class="hold-lamp" aria-hidden="true"></span>HELD · cutter up'
    : '<span class="hold-lamp" aria-hidden="true"></span>HOLD · lift cutter'
}

holdBtn.addEventListener('click', () => setHeld(!eng.held))
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || e.repeat) return
  const tag = (e.target as HTMLElement | null)?.tagName
  if (tag === 'INPUT' || tag === 'BUTTON' || tag === 'TEXTAREA') return
  e.preventDefault()
  setHeld(!eng.held)
})

canvas.addEventListener('pointerdown', (e) => {
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const scale = view.disc.size / (layout.discR * 2)
  const cutCss = view.disc.cutRadius / scale
  if (hitCutter(layout, cutCss, x, y, eng.held)) {
    setHeld(!eng.held)
    return
  }
  if (eng.held && hitDisc(layout, x, y)) {
    canvas.setPointerCapture(e.pointerId)
    eng.drag = { active: true, last: angleAt(layout, x, y) }
  }
})

canvas.addEventListener('pointermove', (e) => {
  if (!eng.drag?.active) {
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const scale = view.disc.size / (layout.discR * 2)
    const cutCss = view.disc.cutRadius / scale
    const over =
      hitCutter(layout, cutCss, x, y, eng.held) || (eng.held && hitDisc(layout, x, y))
    canvas.style.cursor = over ? 'pointer' : 'default'
    return
  }
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const a = angleAt(layout, x, y)
  let d = a - eng.drag.last
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  eng.platter += d * 0.92
  eng.drag.last = a
})

canvas.addEventListener('pointerup', () => {
  eng.drag = null
})
canvas.addEventListener('pointercancel', () => {
  eng.drag = null
})

const abort = new AbortController()

async function loopSlot(): Promise<void> {
  while (!abort.signal.aborted) {
    await pollSlot(eng, abort.signal)
    await sleep(900)
  }
}
async function loopMeter(): Promise<void> {
  while (!abort.signal.aborted) {
    await pollMeter(eng, abort.signal)
    await sleep(2800)
  }
}
async function loopCuts(): Promise<void> {
  while (!abort.signal.aborted) {
    await pollCuts(eng, abort.signal)
    await sleep(2100)
  }
}

void loopSlot()
void loopMeter()
void loopCuts()

let lastCut = 0
let lastPaint = performance.now()
let lastHud = 0

function frame(now: number): void {
  const dt = Math.min(0.05, (now - lastPaint) / 1000)
  lastPaint = now
  syncPlatter(eng, now)
  stampView(view, eng.slot)
  if (!eng.held && now - lastCut > 32) {
    const job = takeCut(eng)
    if (job) {
      cutOne(view, layout, eng.platter, job.family, job.failed, job.slot || eng.slot)
      lastCut = now
    }
  }
  stepChips(view, dt, eng.reduced)
  drawFrame(ctx, layout, view, eng.platter, eng.held, eng.fee, eng.reduced, eng.live)

  if (now - lastHud > 200) {
    lastHud = now
    readSlot.textContent = formatSlot(eng.slot)
    readTps.textContent = formatTps(eng.tps)
    readFee.textContent = formatFee(eng.feeMicro, eng.fee)
    readWire.textContent = eng.held ? 'held' : eng.wire
    desk.classList.toggle('is-cold', !eng.live && !eng.held)
    desk.classList.toggle('is-held', eng.held)
  }
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

function sleep(ms: number): Promise<void> {
  return new Promise((r) => window.setTimeout(r, ms))
}
