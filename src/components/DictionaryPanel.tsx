import { useState } from 'react'
import type { DictionaryOverrides } from '../domain/types'
import { normalizeOverrides } from '../domain/storage'

interface DictionaryPanelProps {
  overrides: DictionaryOverrides
  onChange: (overrides: DictionaryOverrides) => void
}

export function DictionaryPanel({ overrides, onChange }: DictionaryPanelProps) {
  const [word, setWord] = useState('')
  const normalized = word.trim().toUpperCase()
  const valid = /^[A-Z]{2,15}$/.test(normalized)

  const add = (kind: 'allow' | 'block') => {
    if (!valid) return
    onChange(normalizeOverrides({
      allow: kind === 'allow' ? [...overrides.allow, normalized] : overrides.allow.filter((item) => item !== normalized),
      block: kind === 'block' ? [...overrides.block, normalized] : overrides.block.filter((item) => item !== normalized),
    }))
    setWord('')
  }

  const remove = (kind: 'allow' | 'block', item: string) => {
    onChange({
      allow: kind === 'allow' ? overrides.allow.filter((wordItem) => wordItem !== item) : overrides.allow,
      block: kind === 'block' ? overrides.block.filter((wordItem) => wordItem !== item) : overrides.block,
    })
  }

  return (
    <details className="dictionary-panel">
      <summary>
        <span><strong>Dictionary overrides</strong><small>Fix words that differ from the live game</small></span>
        <i>{overrides.allow.length + overrides.block.length}</i>
      </summary>
      <div className="dictionary-body">
        <p>ENABLE is close to the game dictionary, but not exact. Your changes stay in this browser.</p>
        <div className="dictionary-entry">
          <input
            value={word}
            onChange={(event) => setWord(event.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
            onKeyDown={(event) => { if (event.key === 'Enter') add('allow') }}
            placeholder="WORD"
            aria-label="Dictionary word"
            maxLength={15}
          />
          <button type="button" disabled={!valid} onClick={() => add('allow')}>Allow</button>
          <button type="button" disabled={!valid} onClick={() => add('block')}>Block</button>
        </div>
        {(overrides.allow.length > 0 || overrides.block.length > 0) && (
          <div className="override-lists">
            <OverrideList title="Allowed" words={overrides.allow} onRemove={(item) => remove('allow', item)} />
            <OverrideList title="Blocked" words={overrides.block} onRemove={(item) => remove('block', item)} />
          </div>
        )}
      </div>
    </details>
  )
}

function OverrideList({ title, words, onRemove }: { title: string; words: string[]; onRemove: (word: string) => void }) {
  if (words.length === 0) return null
  return (
    <div><strong>{title}</strong><div className="word-chips">
      {words.map((word) => <button type="button" key={word} onClick={() => onRemove(word)}>{word}<span>×</span></button>)}
    </div></div>
  )
}
