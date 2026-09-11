import type { Family } from './palette.ts'
import { laneAt } from './programs.ts'
import {
  feeNorm,
  pressureFee,
  RpcPool,
  rpcEndpoints,
  sampleTps,
  wireName,
  type AddressSig,
} from './rpc.ts'

export type CutJob = {
  family: Family
  failed: boolean
  slot: number
  sig: string
}

export type Engine = {
  rpc: RpcPool
  slot: number
  slotAt: number
  slotMs: number
  tps: number | null
  feeMicro: number | null
  fee: number
  wire: string
  live: boolean
  held: boolean
  queue: CutJob[]
  reduced: boolean
  platter: number
  drag: { active: boolean; last: number } | null
}

const SLOTS_PER_REV = 8
const SEEN_CAP = 900

export function slotsPerRev(): number {
  return SLOTS_PER_REV
}

export function createEngine(reduced: boolean): Engine {
  const rpc = new RpcPool(rpcEndpoints())
  return {
    rpc,
    slot: 0,
    slotAt: performance.now(),
    slotMs: 400,
    tps: null,
    feeMicro: null,
    fee: 0.08,
    wire: wireName(rpc.url),
    live: false,
    held: false,
    queue: [],
    reduced,
    platter: 0,
    drag: null,
  }
}

export function displayedSlot(eng: Engine, now: number): number {
  if (eng.held || !eng.slot) return eng.slot
  const coast = Math.min((now - eng.slotAt) / eng.slotMs, 1.4)
  return eng.slot + coast
}

export function syncPlatter(eng: Engine, now: number): void {
  if (eng.held) return
  const slot = displayedSlot(eng, now)
  const turns = (slot / SLOTS_PER_REV) * Math.PI * 2
  eng.platter = eng.reduced ? turns * 0.08 : turns
}

const seen = new Set<string>()
const seenOrder: string[] = []

function remember(sig: string): boolean {
  if (seen.has(sig)) return false
  seen.add(sig)
  seenOrder.push(sig)
  if (seenOrder.length > SEEN_CAP) {
    const old = seenOrder.shift()
    if (old) seen.delete(old)
  }
  return true
}

function enqueue(eng: Engine, sigs: AddressSig[], family: Family): void {
  for (const s of sigs) {
    if (!remember(s.signature)) continue
    eng.queue.push({
      family,
      failed: s.err != null,
      slot: s.slot,
      sig: s.signature,
    })
  }
  if (eng.queue.length > 240) eng.queue.splice(0, eng.queue.length - 240)
}

export async function pollSlot(eng: Engine, signal: AbortSignal): Promise<void> {
  try {
    const slot = await eng.rpc.getSlot(signal)
    eng.wire = wireName(eng.rpc.url)
    eng.live = true
    if (slot > eng.slot) {
      eng.slot = slot
      eng.slotAt = performance.now()
    }
  } catch {
    eng.live = false
    eng.wire = `${wireName(eng.rpc.url)} · cold`
  }
}

export async function pollMeter(eng: Engine, signal: AbortSignal): Promise<void> {
  try {
    const [perf, fees] = await Promise.all([eng.rpc.getPerf(signal), eng.rpc.getFees(signal)])
    const t = sampleTps(perf)
    if (t) {
      eng.tps = t.tps
      eng.slotMs = Math.min(800, Math.max(280, t.slotMs))
    }
    const med = pressureFee(fees)
    if (med != null) {
      eng.feeMicro = med
      eng.fee = feeNorm(med)
    }
    eng.live = true
    eng.wire = wireName(eng.rpc.url)
  } catch {
    eng.live = false
  }
}

let lane = 0
let blockFails = 0

export async function pollCuts(eng: Engine, signal: AbortSignal): Promise<void> {
  if (eng.held) return
  const laneDef = laneAt(lane++)
  try {
    const sigs = await eng.rpc.getSigs(laneDef.id, signal)
    enqueue(eng, sigs, laneDef.family)
    eng.live = true
    eng.wire = wireName(eng.rpc.url)
  } catch {
    eng.live = false
  }

  if (blockFails < 6 && eng.slot > 0 && lane % 4 === 0) {
    try {
      const block = await eng.rpc.getBlockSigs(Math.max(0, eng.slot - 2), signal)
      const n = block.signatures?.length ?? 0
      const extra = Math.min(18, Math.floor(n / 220))
      for (let i = 0; i < extra; i++) {
        eng.queue.push({
          family: 'other',
          failed: false,
          slot: eng.slot,
          sig: `blk-${eng.slot}-${i}`,
        })
      }
    } catch {
      blockFails += 1
    }
  }
}

export function takeCut(eng: Engine): CutJob | null {
  if (eng.held) return null
  return eng.queue.shift() ?? null
}

export function formatFee(micro: number | null, norm: number): string {
  if (micro == null) return norm > 0.2 ? 'inferred' : 'idle'
  if (micro <= 0) return 'idle · 0 µL'
  if (micro >= 1_000_000) return `${(micro / 1_000_000).toFixed(1)}M µL`
  if (micro >= 1000) return `${(micro / 1000).toFixed(1)}k µL`
  return `${Math.round(micro)} µL`
}

export function formatTps(tps: number | null): string {
  if (tps == null) return '— tx/s'
  if (tps >= 1000) return `${(tps / 1000).toFixed(1)}k tx/s`
  return `${Math.round(tps)} tx/s`
}

export function formatSlot(slot: number): string {
  if (!slot) return '—'
  return slot.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
