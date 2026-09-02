import { useRef, useState, type DragEvent } from 'react'

interface UploadPanelProps {
  busy: boolean
  message: string
  progress: number
  error: string | null
  onFile: (file: File) => void
  onManual: () => void
}

export function UploadPanel({ busy, message, progress, error, onFile, onManual }: UploadPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFiles = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    handleFiles(event.dataTransfer.files)
  }

  return (
    <main className="landing shell">
      <section className="hero-copy">
        <p className="eyebrow">Private. Fast. On your side.</p>
        <h1>Turn a screenshot into your <em>best move.</em></h1>
        <p className="hero-lead">
          Upload your Words With Friends board. Best Move reads the tiles on your device, then checks every legal play.
        </p>
        <div className="trust-row" aria-label="Privacy features">
          <span><i>✓</i> Stays on your device</span>
          <span><i>✓</i> Works offline</span>
          <span><i>✓</i> No account</span>
        </div>
      </section>

      <section className="upload-card" aria-busy={busy}>
        {busy ? (
          <div className="scan-progress">
            <div className="scan-icon" aria-hidden="true">
              <span className="scan-line" />
              <div className="scan-grid">{Array.from({ length: 16 }, (_, index) => <i key={index} />)}</div>
            </div>
            <p className="eyebrow">Reading screenshot</p>
            <h2>{message}</h2>
            <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
              <span style={{ width: `${Math.max(4, progress * 100)}%` }} />
            </div>
            <small>{Math.round(progress * 100)}%</small>
          </div>
        ) : (
          <>
            <div
              className={`drop-zone${dragging ? ' is-dragging' : ''}`}
              onDragOver={(event) => { event.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={drop}
            >
              <div className="upload-glyph" aria-hidden="true">↑</div>
              <h2>Upload your screenshot</h2>
              <p>Use a full portrait screenshot with the board and rack visible.</p>
              <button className="primary-button" type="button" onClick={() => inputRef.current?.click()}>
                Choose screenshot
              </button>
              <input
                ref={inputRef}
                className="visually-hidden"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/*"
                onChange={(event) => handleFiles(event.target.files)}
              />
              <span className="drop-hint">or drop an image here</span>
            </div>
            <button className="text-button manual-link" type="button" onClick={onManual}>Enter a board manually</button>
            {error && <div className="inline-error" role="alert">{error}</div>}
          </>
        )}
      </section>
    </main>
  )
}
