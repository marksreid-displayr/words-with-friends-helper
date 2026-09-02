import { displayCoordinate } from '../domain/rules'
import type { Board, Move } from '../domain/types'
import { MiniBoard } from './Board'

interface ResultsProps {
  board: Board
  moves: Move[]
  elapsedMs: number
  dictionarySize: number
  onEdit: () => void
  onBlock: (word: string) => void
}

export function Results({ board, moves, elapsedMs, dictionarySize, onEdit, onBlock }: ResultsProps) {
  return (
    <main className="results-page shell narrow-shell">
      <div className="results-heading">
        <div>
          <p className="eyebrow">Analysis complete</p>
          <h1>{moves.length ? 'Your best moves' : 'No legal moves found'}</h1>
          <p>{dictionarySize.toLocaleString()} words checked in {(elapsedMs / 1000).toFixed(1)}s.</p>
        </div>
        <button className="secondary-button" type="button" onClick={onEdit}>Edit board</button>
      </div>

      {moves.length === 0 ? (
        <section className="empty-results">
          <span>?</span>
          <h2>Double-check the scan</h2>
          <p>A missing board letter or rack tile can eliminate every move. Return to the editor and check highlighted cells.</p>
          <button className="primary-button" type="button" onClick={onEdit}>Review board</button>
        </section>
      ) : (
        <div className="move-list">
          {moves.map((move, index) => (
            <article className={`move-card${index === 0 ? ' best-move' : ''}`} key={`${move.word}-${move.row}-${move.col}-${move.direction}`}>
              <div className="rank-column">
                <span className="rank">#{index + 1}</span>
                {index === 0 && <span className="best-badge">Best</span>}
              </div>
              <div className="move-copy">
                <div className="move-title">
                  <h2>{move.word}</h2>
                  <div className="score"><strong>{move.score}</strong><span>points</span></div>
                </div>
                <p className="move-location">
                  <span>{move.direction === 'horizontal' ? '→' : '↓'}</span>
                  Start at <strong>{displayCoordinate(move.row, move.col)}</strong> · {move.direction}
                </p>
                <div className="placed-tiles">
                  {move.placements.map((tile) => (
                    <span key={`${tile.row}-${tile.col}`} className={tile.isBlank ? 'blank' : ''}>
                      {tile.letter}<small>{tile.isBlank ? 0 : ''}</small>
                    </span>
                  ))}
                </div>
                <details className="score-details">
                  <summary>Score details</summary>
                  <div>
                    {move.formedWords.map((formed, formedIndex) => (
                      <p key={`${formed.word}-${formedIndex}`}><span>{formed.kind === 'main' ? 'Main word' : 'Cross word'} · {formed.word}</span><strong>{formed.score}</strong></p>
                    ))}
                    {move.breakdown.bingo > 0 && <p><span>All 7 tiles</span><strong>+{move.breakdown.bingo}</strong></p>}
                  </div>
                </details>
                <button className="block-word" type="button" onClick={() => onBlock(move.word)}>Game rejects this word</button>
              </div>
              <MiniBoard board={board} move={move} />
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
