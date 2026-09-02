import { useEffect, useRef, useState } from 'react'
import { BoardEditor } from './components/Board'
import { DictionaryPanel } from './components/DictionaryPanel'
import { Logo } from './components/Logo'
import { RackEditor } from './components/RackEditor'
import { Results } from './components/Results'
import { UploadPanel } from './components/UploadPanel'
import { loadOverrides, saveOverrides } from './domain/storage'
import { emptyBoard, type DictionaryOverrides, type Move, type ParsedGame, type SolverResponse } from './domain/types'
import { parseScreenshot } from './recognition/screenshot'

type Step = 'upload' | 'review' | 'results'

function App() {
  const [step, setStep] = useState<Step>('upload')
  const [game, setGame] = useState<ParsedGame | null>(null)
  const [scanBusy, setScanBusy] = useState(false)
  const [scanMessage, setScanMessage] = useState('Opening screenshot…')
  const [scanProgress, setScanProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [overrides, setOverrides] = useState<DictionaryOverrides>(() => loadOverrides())
  const [solving, setSolving] = useState(false)
  const [solveMessage, setSolveMessage] = useState('Preparing solver…')
  const [solveProgress, setSolveProgress] = useState(0)
  const [moves, setMoves] = useState<Move[]>([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [dictionarySize, setDictionarySize] = useState(0)
  const workerRef = useRef<Worker | null>(null)
  const requestIdRef = useRef(0)

  useEffect(() => () => workerRef.current?.terminate(), [])

  const reset = () => {
    requestIdRef.current += 1
    setStep('upload')
    setGame(null)
    setMoves([])
    setError(null)
    setSolving(false)
  }

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Choose a PNG, JPEG, or WebP screenshot.')
      return
    }
    setError(null)
    setScanBusy(true)
    setScanProgress(0)
    try {
      const parsed = await parseScreenshot(file, (message, progress) => {
        setScanMessage(message)
        setScanProgress(progress)
      })
      setGame(parsed)
      setStep('review')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The screenshot could not be opened.')
    } finally {
      setScanBusy(false)
    }
  }

  const manualBoard = () => {
    setGame({ board: emptyBoard(), rack: [], confidence: [], profile: null, warnings: [] })
    setStep('review')
  }

  const updateOverrides = (next: DictionaryOverrides) => {
    setOverrides(saveOverrides(next))
  }

  const solve = (overrideValue = overrides) => {
    if (!game || game.rack.length === 0) {
      setError('Enter at least one rack tile before solving.')
      return
    }
    setError(null)
    setSolving(true)
    setSolveProgress(0.04)
    setSolveMessage('Preparing solver…')
    const requestId = ++requestIdRef.current
    if (!workerRef.current) {
      workerRef.current = new Worker(new URL('./workers/solver.worker.ts', import.meta.url), { type: 'module' })
    }
    workerRef.current.onmessage = (event: MessageEvent<SolverResponse>) => {
      const response = event.data
      if (response.requestId !== requestIdRef.current) return
      if (response.type === 'progress') {
        setSolveMessage(response.message)
        setSolveProgress(response.progress)
      } else if (response.type === 'result') {
        setMoves(response.moves)
        setElapsedMs(response.elapsedMs)
        setDictionarySize(response.dictionarySize)
        setSolving(false)
        setStep('results')
        window.scrollTo({ top: 0, behavior: 'smooth' })
      } else if (response.type === 'error') {
        setError(response.message)
        setSolving(false)
      }
    }
    workerRef.current.onerror = () => {
      setError('The solver worker stopped unexpectedly. Try again.')
      setSolving(false)
      workerRef.current?.terminate()
      workerRef.current = null
    }
    const dictionaryUrl = new URL(`${import.meta.env.BASE_URL}enable1.txt`, window.location.origin).href
    workerRef.current.postMessage({
      type: 'solve',
      requestId,
      board: game.board,
      rack: game.rack,
      dictionaryUrl,
      overrides: overrideValue,
      limit: 10,
    })
  }

  const blockWord = (word: string) => {
    const next = saveOverrides({
      allow: overrides.allow.filter((item) => item !== word),
      block: [...overrides.block, word],
    })
    setOverrides(next)
    solve(next)
  }

  return (
    <div className="app">
      <header className="site-header">
        <div className="shell header-inner">
          <Logo />
          <div className="header-actions">
            <span className="privacy-pill"><i>●</i> On-device only</span>
            {step !== 'upload' && <button className="text-button" type="button" onClick={reset}>New screenshot</button>}
          </div>
        </div>
      </header>

      {step === 'upload' && (
        <UploadPanel
          busy={scanBusy}
          message={scanMessage}
          progress={scanProgress}
          error={error}
          onFile={handleFile}
          onManual={manualBoard}
        />
      )}

      {step === 'review' && game && (
        <main className="review-page shell">
          <div className="review-heading">
            <div>
              <p className="eyebrow">Step 2 of 2</p>
              <h1>Check the board</h1>
              <p>OCR can be imperfect. Tap any highlighted or incorrect square before solving.</p>
            </div>
            <span className="detected-pill">{game.profile ? 'Screenshot detected' : 'Manual board'}</span>
          </div>

          {game.warnings.length > 0 && (
            <div className="warning-box" role="status">
              <strong>Quick check</strong>
              <ul>{game.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>
          )}

          <BoardEditor
            board={game.board}
            confidence={game.confidence}
            onChange={(board, changedCell) => setGame({
              ...game,
              board,
              confidence: game.confidence.filter((cell) => cell.row !== changedCell.row || cell.col !== changedCell.col),
            })}
          />
          <RackEditor rack={game.rack} onChange={(rack) => setGame({ ...game, rack })} />
          <DictionaryPanel overrides={overrides} onChange={updateOverrides} />

          {error && <div className="inline-error" role="alert">{error}</div>}
          <div className="solve-bar">
            <div><strong>Ready to find your move?</strong><span>The first solve also prepares the offline dictionary.</span></div>
            <button className="primary-button solve-button" type="button" disabled={solving} onClick={() => solve()}>
              {solving ? solveMessage : 'Find top 10 moves'}
              {!solving && <span>→</span>}
            </button>
          </div>
          {solving && (
            <div className="solver-progress" role="progressbar" aria-valuenow={Math.round(solveProgress * 100)}>
              <span style={{ width: `${solveProgress * 100}%` }} />
            </div>
          )}
        </main>
      )}

      {step === 'results' && game && (
        <>
          <Results
            board={game.board}
            moves={moves}
            elapsedMs={elapsedMs}
            dictionarySize={dictionarySize}
            onEdit={() => setStep('review')}
            onBlock={blockWord}
          />
          <div className="shell narrow-shell results-dictionary"><DictionaryPanel overrides={overrides} onChange={updateOverrides} /></div>
        </>
      )}

      <footer>
        <div className="shell"><span>Best Move</span><p>Your screenshots never leave this device.</p></div>
      </footer>
    </div>
  )
}

export default App
