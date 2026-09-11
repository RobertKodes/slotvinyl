const DEFAULTS = [
  'https://solana-rpc.publicnode.com',
  'https://solana.publicnode.com',
  'https://api.mainnet-beta.solana.com',
]

export function rpcEndpoints(): string[] {
  const extra = import.meta.env.VITE_RPC_URL
  const list = extra && extra.startsWith('http') ? [extra, ...DEFAULTS] : DEFAULTS
  return [...new Set(list)]
}

export function wireName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    const short = host.replace(/\.com$|\.org$/, '')
    if (short.includes('publicnode')) return 'publicnode'
    if (short.includes('mainnet-beta')) return 'solana.com'
    if (short.includes('drpc')) return 'drpc'
    if (short.includes('ankr')) return 'ankr'
    if (short.includes('llama')) return 'llamarpc'
    return short
  } catch {
    return 'rpc'
  }
}

type RpcError = { code?: number; message?: string }

async function rpcCall<T>(
  url: string,
  method: string,
  params: unknown[],
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> {
  const ctrl = new AbortController()
  const t = window.setTimeout(() => ctrl.abort(), timeoutMs)
  const onAbort = () => ctrl.abort()
  signal?.addEventListener('abort', onAbort, { once: true })
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const body = (await res.json()) as { result?: T; error?: RpcError }
    if (body.error) throw new Error(body.error.message ?? `rpc ${method} failed`)
    if (body.result === undefined) throw new Error(`rpc ${method} empty`)
    return body.result
  } finally {
    window.clearTimeout(t)
    signal?.removeEventListener('abort', onAbort)
  }
}

export type PerfSample = {
  slot: number
  numSlots: number
  numTransactions: number
  numNonVoteTransactions?: number
  samplePeriodSecs: number
}

export type PrioFee = {
  slot: number
  prioritizationFee: number
}

export type AddressSig = {
  signature: string
  slot: number
  err: unknown
  blockTime: number | null
}

export type BlockSigs = {
  signatures?: string[]
  blockHeight?: number
  blockTime?: number | null
}

export class RpcPool {
  endpoints: string[]
  index = 0

  constructor(endpoints: string[]) {
    this.endpoints = endpoints.length ? endpoints : DEFAULTS
  }

  get url(): string {
    return this.endpoints[this.index % this.endpoints.length]!
  }

  rotate(): string {
    this.index = (this.index + 1) % this.endpoints.length
    return this.url
  }

  async call<T>(
    method: string,
    params: unknown[],
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    let last: unknown
    for (let i = 0; i < this.endpoints.length; i++) {
      try {
        return await rpcCall<T>(this.url, method, params, timeoutMs, signal)
      } catch (err) {
        last = err
        this.rotate()
      }
    }
    throw last instanceof Error ? last : new Error('all rpc endpoints failed')
  }

  getSlot(signal?: AbortSignal): Promise<number> {
    return this.call('getSlot', [{ commitment: 'confirmed' }], 5000, signal)
  }

  getPerf(signal?: AbortSignal): Promise<PerfSample[]> {
    return this.call('getRecentPerformanceSamples', [4], 6000, signal)
  }

  getFees(signal?: AbortSignal): Promise<PrioFee[]> {
    return this.call('getRecentPrioritizationFees', [[]], 6000, signal)
  }

  getSigs(address: string, signal?: AbortSignal): Promise<AddressSig[]> {
    return this.call(
      'getSignaturesForAddress',
      [address, { limit: 10, commitment: 'confirmed' }],
      7000,
      signal,
    )
  }

  getBlockSigs(slot: number, signal?: AbortSignal): Promise<BlockSigs> {
    return this.call(
      'getBlock',
      [
        slot,
        {
          encoding: 'json',
          transactionDetails: 'signatures',
          rewards: false,
          maxSupportedTransactionVersion: 0,
        },
      ],
      8000,
      signal,
    )
  }
}

export function medianFee(fees: PrioFee[]): number | null {
  if (!fees.length) return null
  const vals = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b)
  const mid = Math.floor(vals.length / 2)
  const a = vals[mid]
  const b = vals[mid - 1]
  if (a == null) return null
  if (vals.length % 2 === 0 && b != null) return (a + b) / 2
  return a
}

/** Quiet medians sit at 0; use the hot tail so the stylus can still read congestion. */
export function pressureFee(fees: PrioFee[]): number | null {
  if (!fees.length) return null
  const med = medianFee(fees)
  if (med && med > 0) return med
  const vals = fees.map((f) => f.prioritizationFee).sort((a, b) => a - b)
  return vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.9))] ?? med
}

/** Log-ish 0..1 from micro-lamports per CU. Quiet chain sits low; congestion saturates. */
export function feeNorm(microLamports: number | null): number {
  if (microLamports == null || microLamports <= 0) return 0.08
  return Math.min(1, Math.log10(microLamports + 1) / 6)
}

export function sampleTps(samples: PerfSample[]): { tps: number; slotMs: number } | null {
  const s = samples[0]
  if (!s || s.samplePeriodSecs <= 0 || s.numSlots <= 0) return null
  const tx = s.numNonVoteTransactions ?? s.numTransactions
  return {
    tps: tx / s.samplePeriodSecs,
    slotMs: (s.samplePeriodSecs / s.numSlots) * 1000,
  }
}
