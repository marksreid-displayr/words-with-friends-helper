import { LETTER_VALUES } from '../domain/rules'
import type { RackTile } from '../domain/types'

interface RackEditorProps {
  rack: RackTile[]
  onChange: (rack: RackTile[]) => void
}

export function RackEditor({ rack, onChange }: RackEditorProps) {
  const slots = Array.from({ length: 7 }, (_, index) => rack[index] ?? null)

  const update = (index: number, value: string) => {
    const normalized = value.toUpperCase().replace(/[^A-Z?]/g, '').slice(-1)
    const values = slots.map((slot) => slot?.letter ?? '')
    values[index] = normalized
    onChange(values.filter(Boolean).map((letter) => ({ letter, isBlank: letter === '?' })))
  }

  return (
    <div className="rack-section">
      <div className="section-heading compact-heading">
        <div>
          <p className="eyebrow">Your rack</p>
          <h2>Confirm your tiles</h2>
        </div>
        <span className="rack-help">Use ? for a blank</span>
      </div>
      <div className="rack-editor" aria-label="Rack letters">
        {slots.map((tile, index) => (
          <label className="rack-tile" key={index}>
            <span className="visually-hidden">Rack tile {index + 1}</span>
            <input
              value={tile?.letter ?? ''}
              maxLength={1}
              inputMode="text"
              autoCapitalize="characters"
              onChange={(event) => update(index, event.target.value)}
            />
            {tile && <small>{tile.isBlank ? 0 : LETTER_VALUES[tile.letter]}</small>}
          </label>
        ))}
      </div>
    </div>
  )
}
