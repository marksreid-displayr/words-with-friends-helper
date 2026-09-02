import { describe, expect, it } from 'vitest'
import { CompactTrie } from './trie'

describe('CompactTrie', () => {
  it('normalizes, deduplicates, and looks up words', () => {
    const trie = CompactTrie.fromWords(['cat', 'car', 'CAR', 'dog', 'a', 'not-a-word'])
    expect(trie.wordCount).toBe(3)
    expect(trie.has('CAT')).toBe(true)
    expect(trie.has('car')).toBe(true)
    expect(trie.has('can')).toBe(false)
    expect(trie.has('A')).toBe(false)
  })
})
