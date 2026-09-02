import type { DictionaryOverrides } from './types'

const STORAGE_KEY = 'wwf-helper.dictionary-overrides.v1'

const EMPTY: DictionaryOverrides = { allow: [], block: [] }

export function loadOverrides(): DictionaryOverrides {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '') as Partial<DictionaryOverrides>
    return normalizeOverrides({ allow: parsed.allow ?? [], block: parsed.block ?? [] })
  } catch {
    return { ...EMPTY }
  }
}

export function saveOverrides(overrides: DictionaryOverrides): DictionaryOverrides {
  const normalized = normalizeOverrides(overrides)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
  return normalized
}

export function normalizeOverrides(overrides: DictionaryOverrides): DictionaryOverrides {
  const normalize = (words: string[]) =>
    [...new Set(words.map((word) => word.trim().toUpperCase()).filter((word) => /^[A-Z]{2,15}$/.test(word)))].sort()
  const allow = normalize(overrides.allow)
  const block = normalize(overrides.block).filter((word) => !allow.includes(word))
  return { allow, block }
}
