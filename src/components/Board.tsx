import { useEffect, useMemo, useState } from 'react'
import { getPremium, LETTER_VALUES } from '../domain/rules'
import { cloneBoard, type Board as BoardType, type CellConfidence, type Move } from '../domain/types'

interface BoardEditorProps {
  board: BoardType
  confidence: CellConfidence[]
  onChange: (board: BoardType, changedCell: { row: number; col: number }) => void
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function BoardEditor({ board, confidence, onChange }: BoardEditorProps) {
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null)
  const uncertain = useMemo(
    () => new Map(confidence.filter((cell) => cell.confidence < 0.72).map((cell) => [`${cell.row}:${cell.col}`, cell])),
    [confidence],
  )

  const updateSelected = (letter: string | null, blank?: boolean) => {
    if (!selected) return
    const next = cloneBoard(board)
    next[selected.row][selected.col] = { letter, isBlank: letter ? Boolean(blank) : false }
    onChange(next, selected)
  }

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!selected || event.target instanceof HTMLInputElement) return
      const letter = event.key.toUpperCase()
      if (/^[A-Z]$/.test(letter)) updateSelected(letter, board[selected.row][selected.col].isBlank)
      if (event.key === 'Backspace' || event.key === 'Delete') updateSelected(null)
    }
    window.addEventListener('keydown', keyDown)
    return () => window.removeEventListener('keydown', keyDown)
  })

  const selectedCell = selected ? board[selected.row][selected.col] : null

  return (
    <div className="editor-layout">
      <div>
        <div className="board-frame">
          <div className="board-grid" role="grid" aria-label="Words With Friends board">
            {board.flatMap((row, rowIndex) =>
              row.map((cell, colIndex) => {
                const premium = getPremium(rowIndex, colIndex)
                const key = `${rowIndex}:${colIndex}`
                const isSelected = selected?.row === rowIndex && selected.col === colIndex
                const uncertainCell = uncertain.get(key)
                return (
                  <button
                    type="button"
                    role="gridcell"
                    aria-label={`${String.fromCharCode(65 + colIndex)}${rowIndex + 1}: ${cell.letter ?? premium ?? 'empty'}${uncertainCell ? ', check this cell' : ''}`}
                    title={uncertainCell?.reason}
                    className={`board-cell ${cell.letter ? 'has-tile' : premium ? `premium premium-${premium.toLowerCase()}` : ''}${isSelected ? ' is-selected' : ''}${uncertainCell ? ' is-uncertain' : ''}`}
                    key={key}
                    onClick={() => setSelected({ row: rowIndex, col: colIndex })}
                  >
                    {cell.letter ? (
                      <>
                        <strong>{cell.letter}</strong>
                        <small>{cell.isBlank ? 0 : LETTER_VALUES[cell.letter]}</small>
                        {cell.isBlank && <i className="blank-dot" />}
                      </>
                    ) : premium ? <span>{premium}</span> : null}
                  </button>
                )
              }),
            )}
          </div>
        </div>
        <div className="board-legend">
          <span><i className="legend-swatch uncertain" /> Check this cell</span>
          <span>Tap any square to edit</span>
        </div>
      </div>

      <aside className={`cell-editor${selected ? ' is-open' : ''}`}>
        {selected && selectedCell ? (
          <>
            <div className="cell-editor-heading">
              <div>
                <p className="eyebrow">Selected square</p>
                <h3>{String.fromCharCode(65 + selected.col)}{selected.row + 1}</h3>
              </div>
              <button className="icon-button" type="button" aria-label="Close letter picker" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="letter-picker" aria-label="Choose a letter">
              {[...LETTERS].map((letter) => (
                <button
                  type="button"
                  className={selectedCell.letter === letter ? 'is-active' : ''}
                  key={letter}
                  onClick={() => updateSelected(letter, selectedCell.isBlank)}
                >{letter}</button>
              ))}
            </div>
            <div className="cell-actions">
              <label className="check-control">
                <input
                  type="checkbox"
                  checked={selectedCell.isBlank}
                  disabled={!selectedCell.letter}
                  onChange={(event) => updateSelected(selectedCell.letter, event.target.checked)}
                />
                Blank tile <small>(scores 0)</small>
              </label>
              <button className="secondary-button compact" type="button" onClick={() => updateSelected(null)}>Clear square</button>
            </div>
          </>
        ) : (
          <div className="cell-editor-empty">
            <span>ABC</span>
            <h3>Tap a board square</h3>
            <p>Choose its letter here, or clear a mistaken scan.</p>
          </div>
        )}
      </aside>
    </div>
  )
}

interface MiniBoardProps {
  board: BoardType
  move: Move
}

export function MiniBoard({ board, move }: MiniBoardProps) {
  const placements = new Map(move.placements.map((tile) => [`${tile.row}:${tile.col}`, tile]))
  return (
    <div className="mini-board" aria-label={`Preview of ${move.word}`}>
      {board.flatMap((row, rowIndex) => row.map((cell, colIndex) => {
        const placement = placements.get(`${rowIndex}:${colIndex}`)
        const premium = getPremium(rowIndex, colIndex)
        return (
          <span
            key={`${rowIndex}:${colIndex}`}
            className={`${placement ? 'move-tile' : cell.letter ? 'old-tile' : premium ? `mini-${premium.toLowerCase()}` : ''}`}
          >{placement?.letter ?? cell.letter ?? ''}</span>
        )
      }))}
    </div>
  )
}
