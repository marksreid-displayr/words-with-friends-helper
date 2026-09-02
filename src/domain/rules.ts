import { BOARD_SIZE, type Premium } from './types'

export const LETTER_VALUES: Readonly<Record<string, number>> = Object.freeze({
  A: 1,
  B: 4,
  C: 4,
  D: 2,
  E: 1,
  F: 4,
  G: 3,
  H: 3,
  I: 1,
  J: 10,
  K: 5,
  L: 2,
  M: 4,
  N: 2,
  O: 1,
  P: 4,
  Q: 10,
  R: 1,
  S: 1,
  T: 1,
  U: 2,
  V: 5,
  W: 4,
  X: 8,
  Y: 3,
  Z: 10,
})

const PREMIUM_ROWS = [
  '...TW..TL.TL..TW...',
  '..DL..DW...DW..DL..',
  '.DL..DL.....DL..DL.',
  'TW..TL.......TL..TW',
  '..DL...DL.DL...DL..',
  '.DW...TL...TL...DW.',
  'TL...DL.....DL...TL',
  '...DW...DW...DW...',
  'TL...DL.....DL...TL',
  '.DW...TL...TL...DW.',
  '..DL...DL.DL...DL..',
  'TW..TL.......TL..TW',
  '.DL..DL.....DL..DL.',
  '..DL..DW...DW..DL..',
  '...TW..TL.TL..TW...',
] as const

function parsePremiumRow(row: string): Premium[] {
  const values: Premium[] = []
  for (let index = 0; index < row.length; ) {
    if (row[index] === '.') {
      values.push(null)
      index += 1
    } else {
      values.push(row.slice(index, index + 2) as Exclude<Premium, null>)
      index += 2
    }
  }
  if (values.length !== BOARD_SIZE) {
    throw new Error(`Invalid premium row: ${row} (${values.length} cells)`)
  }
  return values
}

export const PREMIUMS: ReadonlyArray<ReadonlyArray<Premium>> = PREMIUM_ROWS.map(parsePremiumRow)

export function getPremium(row: number, col: number): Premium {
  return PREMIUMS[row]?.[col] ?? null
}

export function letterMultiplier(premium: Premium): number {
  if (premium === 'DL') return 2
  if (premium === 'TL') return 3
  return 1
}

export function wordMultiplier(premium: Premium): number {
  if (premium === 'DW') return 2
  if (premium === 'TW') return 3
  return 1
}

export function displayCoordinate(row: number, col: number): string {
  return `${String.fromCharCode(65 + col)}${row + 1}`
}
