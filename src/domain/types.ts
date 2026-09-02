export const BOARD_SIZE = 15

export type Direction = 'horizontal' | 'vertical'
export type Premium = 'DL' | 'TL' | 'DW' | 'TW' | null

export interface BoardCell {
  letter: string | null
  isBlank: boolean
}

export type Board = BoardCell[][]

export interface RackTile {
  letter: string
  isBlank: boolean
}

export interface CellConfidence {
  row: number
  col: number
  confidence: number
  reason?: string
}

export interface ScreenProfile {
  id: string
  sourceWidth: number
  sourceHeight: number
  boardRect: { x: number; y: number; size: number }
  rackRect: { x: number; y: number; width: number; height: number }
}

export interface ParsedGame {
  board: Board
  rack: RackTile[]
  confidence: CellConfidence[]
  profile: ScreenProfile | null
  warnings: string[]
}

export interface PlacedTile {
  row: number
  col: number
  letter: string
  isBlank: boolean
  premium: Premium
}

export interface FormedWord {
  word: string
  score: number
  kind: 'main' | 'cross'
}

export interface ScoreBreakdown {
  mainWord: number
  crossWords: number
  bingo: number
  total: number
}

export interface Move {
  word: string
  score: number
  row: number
  col: number
  direction: Direction
  placements: PlacedTile[]
  formedWords: FormedWord[]
  breakdown: ScoreBreakdown
}

export interface DictionaryOverrides {
  allow: string[]
  block: string[]
}

export type SolverRequest =
  | {
      type: 'solve'
      requestId: number
      board: Board
      rack: RackTile[]
      dictionaryUrl: string
      overrides: DictionaryOverrides
      limit?: number
    }
  | { type: 'cancel'; requestId: number }

export type SolverResponse =
  | { type: 'progress'; requestId: number; message: string; progress: number }
  | { type: 'result'; requestId: number; moves: Move[]; dictionarySize: number; elapsedMs: number }
  | { type: 'error'; requestId: number; message: string }

export function emptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, (): BoardCell => ({ letter: null, isBlank: false })),
  )
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell })))
}
