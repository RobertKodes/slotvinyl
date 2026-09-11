import type { Family } from './palette.ts'

export type ProgramLane = {
  id: string
  family: Family
  callsign: string
}

/** Well-known program accounts we sample. Vote is omitted on purpose — it would flood the lacquer. */
export const LANES: ProgramLane[] = [
  { id: '11111111111111111111111111111111', family: 'system', callsign: 'SYS' },
  { id: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', family: 'token', callsign: 'TKN' },
  { id: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', family: 'token', callsign: 'T22' },
  { id: 'ComputeBudget111111111111111111111111111111', family: 'compute', callsign: 'CU' },
  { id: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', family: 'dex', callsign: 'JUP' },
  { id: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', family: 'dex', callsign: 'RAY' },
  { id: 'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', family: 'dex', callsign: 'ORC' },
  { id: 'Stake11111111111111111111111111111111111111', family: 'stake', callsign: 'STK' },
]

export function laneAt(i: number): ProgramLane {
  return LANES[i % LANES.length]!
}
