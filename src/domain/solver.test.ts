import { describe, expect, it } from 'vitest'
import { solveMoves } from './solver'
import { CompactTrie } from './trie'
import { emptyBoard, type Board, type RackTile } from './types'

function rack(letters: string): RackTile[] {
  return [...letters].map((letter) => ({ letter, isBlank: letter === '?' }))
}

function trie(...words: string[]) {
  return CompactTrie.fromWords(words)
}

function set(board: Board, row: number, col: number, letter: string, isBlank = false) {
  board[row][col] = { letter, isBlank }
}

describe('move solver', () => {
  it('places the first word across the center and applies its double-word square', () => {
    const moves = solveMoves({ baseTrie: trie('CAT'), board: emptyBoard(), rack: rack('CAT') })
    expect(moves.length).toBeGreaterThan(0)
    expect(moves[0].word).toBe('CAT')
    expect(moves[0].score).toBe(12)
    expect(moves[0].placements).toHaveLength(3)
    expect(moves[0].placements.some((tile) => tile.row === 7 && tile.col === 7)).toBe(true)
  })

  it('does not reuse a covered premium', () => {
    const board = emptyBoard()
    set(board, 7, 7, 'A')
    const moves = solveMoves({ baseTrie: trie('AB'), board, rack: rack('B') })
    const horizontal = moves.find((move) => move.row === 7 && move.col === 7 && move.direction === 'horizontal')
    expect(horizontal?.score).toBe(5)
  })

  it('validates and scores perpendicular cross words', () => {
    const board = emptyBoard()
    set(board, 7, 7, 'A')
    set(board, 6, 8, 'I')
    const moves = solveMoves({ baseTrie: trie('AT', 'IT'), board, rack: rack('T'), limit: 20 })
    const move = moves.find((candidate) => candidate.word === 'AT' && candidate.row === 7 && candidate.col === 7 && candidate.direction === 'horizontal')
    expect(move?.score).toBe(4)
    expect(move?.formedWords.map((word) => word.word)).toEqual(['AT', 'IT'])
  })

  it('scores rack blanks and existing board blanks as zero', () => {
    const board = emptyBoard()
    set(board, 7, 7, 'A', true)
    const moves = solveMoves({ baseTrie: trie('AT'), board, rack: rack('?'), limit: 20 })
    const move = moves.find((candidate) => candidate.word === 'AT')
    expect(move?.score).toBe(0)
    expect(move?.placements[0].isBlank).toBe(true)
  })

  it('adds the 35 point bonus when all seven rack tiles are played', () => {
    const moves = solveMoves({ baseTrie: trie('NOSTRIL'), board: emptyBoard(), rack: rack('NOSTRIL') })
    expect(moves[0].breakdown.bingo).toBe(35)
    expect(moves[0].score).toBe(moves[0].breakdown.mainWord + 35)
  })

  it('supports local allow and block overrides', () => {
    const blocked = solveMoves({
      baseTrie: trie('CAT'),
      board: emptyBoard(),
      rack: rack('CAT'),
      overrides: { allow: [], block: ['CAT'] },
    })
    expect(blocked).toEqual([])

    const allowed = solveMoves({
      baseTrie: trie('CAT'),
      board: emptyBoard(),
      rack: rack('DOG'),
      overrides: { allow: ['DOG'], block: [] },
    })
    expect(allowed[0].word).toBe('DOG')
  })

  it('returns an empty list when no legal word can be formed', () => {
    expect(solveMoves({ baseTrie: trie('CAT'), board: emptyBoard(), rack: rack('ZZ') })).toEqual([])
  })
})
