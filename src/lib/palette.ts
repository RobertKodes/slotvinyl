/** Named tokens — keep in sync with README. */

export const ink = {
  lacquer: '#0B0908',
  room: '#14110E',
  cream: '#EDE4D0',
  creamDim: '#C9BBA6',
  aluminum: '#A9A297',
  aluminumDark: '#6E6860',
  aluminumDeep: '#3A3530',
  amber: '#E8A03A',
  amberHot: '#F3C56B',
  oxblood: '#7A1E28',
  oxbloodBright: '#A32A38',
  cyan: '#6AA8B0',
  brass: '#B08A4A',
  brassDeep: '#6E5428',
  copper: '#C56A3C',
  oak: '#3C2A1C',
} as const

export type Family = 'system' | 'token' | 'compute' | 'dex' | 'stake' | 'other'

export const familyColor: Record<Family, string> = {
  system: ink.creamDim,
  token: ink.cyan,
  compute: ink.amber,
  dex: ink.copper,
  stake: '#8A7A58',
  other: ink.aluminumDark,
}

export const familyLabel: Record<Family, string> = {
  system: 'system',
  token: 'token',
  compute: 'cu',
  dex: 'dex',
  stake: 'stake',
  other: 'other',
}
