import { describe, expect, it } from 'vitest'
import { PREMIUMS, getPremium, LETTER_VALUES } from './rules'

describe('Words With Friends rules', () => {
  it('defines a complete 15 by 15 premium board', () => {
    expect(PREMIUMS).toHaveLength(15)
    for (const row of PREMIUMS) expect(row).toHaveLength(15)
    expect(getPremium(0, 3)).toBe('TW')
    expect(getPremium(0, 6)).toBe('TL')
    expect(getPremium(1, 5)).toBe('DW')
    expect(getPremium(4, 6)).toBe('DL')
    expect(getPremium(7, 7)).toBe('DW')
  })

  it('uses Words With Friends rather than Scrabble tile values', () => {
    expect(LETTER_VALUES.B).toBe(4)
    expect(LETTER_VALUES.G).toBe(3)
    expect(LETTER_VALUES.J).toBe(10)
    expect(LETTER_VALUES.L).toBe(2)
    expect(LETTER_VALUES.X).toBe(8)
  })
})
