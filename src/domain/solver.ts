import { BOARD_SIZE, type Board, type Direction, type DictionaryOverrides, type FormedWord, type Move, type RackTile } from './types'
import { getPremium, letterMultiplier, LETTER_VALUES, wordMultiplier } from './rules'
import { CompactTrie } from './trie'

interface CrossInfo {
  valid: boolean
  word: string | null
  existingScore: number
}

interface SolveOptions {
  baseTrie: CompactTrie
  board: Board
  rack: RackTile[]
  overrides?: DictionaryOverrides
  limit?: number
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function inside(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE
}

function cellValue(board: Board, row: number, col: number): number {
  const cell = board[row][col]
  return cell.letter && !cell.isBlank ? LETTER_VALUES[cell.letter] ?? 0 : 0
}

function perpendicularDelta(direction: Direction): [number, number] {
  return direction === 'horizontal' ? [1, 0] : [0, 1]
}

function mainDelta(direction: Direction): [number, number] {
  return direction === 'horizontal' ? [0, 1] : [1, 0]
}

function makeCrossTable(
  board: Board,
  direction: Direction,
  isWord: (word: string) => boolean,
): CrossInfo[][] {
  const result: CrossInfo[][] = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => [])
  const [dr, dc] = perpendicularDelta(direction)

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (board[row][col].letter) continue
      const prefixLetters: string[] = []
      const suffixLetters: string[] = []
      let existingScore = 0
      let rr = row - dr
      let cc = col - dc
      while (inside(rr, cc) && board[rr][cc].letter) {
        prefixLetters.unshift(board[rr][cc].letter as string)
        existingScore += cellValue(board, rr, cc)
        rr -= dr
        cc -= dc
      }
      rr = row + dr
      cc = col + dc
      while (inside(rr, cc) && board[rr][cc].letter) {
        suffixLetters.push(board[rr][cc].letter as string)
        existingScore += cellValue(board, rr, cc)
        rr += dr
        cc += dc
      }

      const prefix = prefixLetters.join('')
      const suffix = suffixLetters.join('')
      const hasCross = prefix.length > 0 || suffix.length > 0
      result[row * BOARD_SIZE + col] = [...LETTERS].map((letter) => {
        const word = hasCross ? `${prefix}${letter}${suffix}` : null
        return { valid: word === null || isWord(word), word, existingScore }
      })
    }
  }
  return result
}

function hasPerpendicularNeighbor(board: Board, row: number, col: number, direction: Direction): boolean {
  const [dr, dc] = perpendicularDelta(direction)
  return (
    (inside(row - dr, col - dc) && Boolean(board[row - dr][col - dc].letter)) ||
    (inside(row + dr, col + dc) && Boolean(board[row + dr][col + dc].letter))
  )
}

export function solveMoves({ baseTrie, board, rack, overrides = { allow: [], block: [] }, limit = 10 }: SolveOptions): Move[] {
  const blocked = new Set(overrides.block.map((word) => word.toUpperCase()))
  const allowed = new Set(overrides.allow.map((word) => word.toUpperCase()))
  const customTrie = allowed.size > 0 ? CompactTrie.fromWords(allowed) : null
  const isWord = (word: string) => allowed.has(word) || (!blocked.has(word) && baseTrie.has(word))
  const boardHasTiles = board.some((row) => row.some((cell) => cell.letter !== null))
  const rackCounts = new Uint8Array(26)
  let blankCount = 0
  for (const tile of rack) {
    if (tile.isBlank || tile.letter === '?') blankCount += 1
    else {
      const index = tile.letter.toUpperCase().charCodeAt(0) - 65
      if (index >= 0 && index < 26) rackCounts[index] += 1
    }
  }

  const moveMap = new Map<string, Move>()

  const generateFromTrie = (trie: CompactTrie) => {
    for (const direction of ['horizontal', 'vertical'] as const) {
      const [dr, dc] = mainDelta(direction)
      const crossTable = makeCrossTable(board, direction, isWord)

      const canReachConnection = (startRow: number, startCol: number): boolean => {
        let emptyUsed = 0
        let row = startRow
        let col = startCol
        while (inside(row, col)) {
          const cell = board[row][col]
          if (cell.letter) {
            if (boardHasTiles) return true
          } else {
            emptyUsed += 1
            if (emptyUsed > rack.length) return false
            if (boardHasTiles && hasPerpendicularNeighbor(board, row, col, direction)) return true
            if (!boardHasTiles && row === 7 && col === 7) return true
          }
          row += dr
          col += dc
        }
        return false
      }

      for (let startRow = 0; startRow < BOARD_SIZE; startRow += 1) {
        for (let startCol = 0; startCol < BOARD_SIZE; startCol += 1) {
          const previousRow = startRow - dr
          const previousCol = startCol - dc
          if (inside(previousRow, previousCol) && board[previousRow][previousCol].letter) continue
          if (!canReachConnection(startRow, startCol)) continue

          const placements: Move['placements'] = []
          const crossWords: FormedWord[] = []

          const visit = (
            node: number,
            row: number,
            col: number,
            word: string,
            placed: number,
            usedBlanks: number,
            mainBase: number,
            mainMultiplier: number,
            crossScore: number,
            connected: boolean,
            coversCenter: boolean,
          ) => {
            if (!inside(row, col)) return
            const cell = board[row][col]

            const continueAfterLetter = (
              nextNode: number,
              letter: string,
              nextPlaced: number,
              nextUsedBlanks: number,
              nextMainBase: number,
              nextMainMultiplier: number,
              nextCrossScore: number,
              nextConnected: boolean,
              nextCoversCenter: boolean,
            ) => {
              const nextWord = `${word}${letter}`
              const nextRow = row + dr
              const nextCol = col + dc
              const nextIsOpen = !inside(nextRow, nextCol) || board[nextRow][nextCol].letter === null
              if (
                trie.isTerminal(nextNode) &&
                nextWord.length >= 2 &&
                nextPlaced > 0 &&
                nextIsOpen &&
                !blocked.has(nextWord) &&
                (boardHasTiles ? nextConnected : nextCoversCenter)
              ) {
                const mainScore = nextMainBase * nextMainMultiplier
                const bingo = nextPlaced === 7 && rack.length === 7 ? 35 : 0
                const total = mainScore + nextCrossScore + bingo
                const move: Move = {
                  word: nextWord,
                  score: total,
                  row: startRow,
                  col: startCol,
                  direction,
                  placements: placements.map((placement) => ({ ...placement })),
                  formedWords: [
                    { word: nextWord, score: mainScore, kind: 'main' },
                    ...crossWords.map((formed) => ({ ...formed })),
                  ],
                  breakdown: { mainWord: mainScore, crossWords: nextCrossScore, bingo, total },
                }
                const key = `${nextWord}:${startRow}:${startCol}:${direction}`
                const current = moveMap.get(key)
                if (!current || current.score < move.score) moveMap.set(key, move)
              }
              if (inside(nextRow, nextCol)) {
                visit(
                  nextNode,
                  nextRow,
                  nextCol,
                  nextWord,
                  nextPlaced,
                  nextUsedBlanks,
                  nextMainBase,
                  nextMainMultiplier,
                  nextCrossScore,
                  nextConnected,
                  nextCoversCenter,
                )
              }
            }

            if (cell.letter) {
              const letter = cell.letter
              const child = trie.child(node, letter)
              if (child === -1) return
              continueAfterLetter(
                child,
                letter,
                placed,
                usedBlanks,
                mainBase + cellValue(board, row, col),
                mainMultiplier,
                crossScore,
                true,
                coversCenter,
              )
              return
            }

            const premium = getPremium(row, col)
            const lm = letterMultiplier(premium)
            const wm = wordMultiplier(premium)
            const infos = crossTable[row * BOARD_SIZE + col]
            for (const childEntry of trie.children(node)) {
              const letterIndex = childEntry.letter.charCodeAt(0) - 65
              const cross = infos[letterIndex]
              if (!cross?.valid) continue
              const nextConnected = connected || cross.word !== null
              const nextCoversCenter = coversCenter || (row === 7 && col === 7)

              const playTile = (isBlank: boolean) => {
                const tileValue = isBlank ? 0 : LETTER_VALUES[childEntry.letter]
                const scoredCross = cross.word ? (cross.existingScore + tileValue * lm) * wm : 0
                placements.push({ row, col, letter: childEntry.letter, isBlank, premium })
                if (cross.word) crossWords.push({ word: cross.word, score: scoredCross, kind: 'cross' })
                continueAfterLetter(
                  childEntry.node,
                  childEntry.letter,
                  placed + 1,
                  usedBlanks + (isBlank ? 1 : 0),
                  mainBase + tileValue * lm,
                  mainMultiplier * wm,
                  crossScore + scoredCross,
                  nextConnected,
                  nextCoversCenter,
                )
                if (cross.word) crossWords.pop()
                placements.pop()
              }

              if (rackCounts[letterIndex] > 0) {
                rackCounts[letterIndex] -= 1
                playTile(false)
                rackCounts[letterIndex] += 1
              }
              if (blankCount - usedBlanks > 0) playTile(true)
            }
          }

          visit(0, startRow, startCol, '', 0, 0, 0, 1, 0, false, false)
        }
      }
    }
  }

  generateFromTrie(baseTrie)
  if (customTrie) generateFromTrie(customTrie)

  return [...moveMap.values()]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.word.localeCompare(b.word) ||
        a.row - b.row ||
        a.col - b.col ||
        (a.direction === 'horizontal' ? -1 : 1),
    )
    .slice(0, limit)
}
