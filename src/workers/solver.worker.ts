/// <reference lib="webworker" />

import { solveMoves } from '../domain/solver'
import { CompactTrie } from '../domain/trie'
import type { SolverRequest, SolverResponse } from '../domain/types'

let baseTrie: CompactTrie | null = null
let dictionarySize = 0
let loadedUrl = ''

function send(message: SolverResponse) {
  self.postMessage(message)
}

self.addEventListener('message', async (event: MessageEvent<SolverRequest>) => {
  const request = event.data
  if (request.type === 'cancel') return
  const started = performance.now()

  try {
    if (!baseTrie || loadedUrl !== request.dictionaryUrl) {
      send({ type: 'progress', requestId: request.requestId, message: 'Loading the word list…', progress: 0.12 })
      const response = await fetch(request.dictionaryUrl)
      if (!response.ok) throw new Error(`Could not load dictionary (${response.status})`)
      const text = await response.text()
      const words = text.split(/\r?\n/)
      send({ type: 'progress', requestId: request.requestId, message: 'Indexing 173,000 words…', progress: 0.32 })
      baseTrie = CompactTrie.fromWords(words)
      dictionarySize = baseTrie.wordCount
      loadedUrl = request.dictionaryUrl
    }

    send({ type: 'progress', requestId: request.requestId, message: 'Checking every legal placement…', progress: 0.58 })
    const moves = solveMoves({
      baseTrie,
      board: request.board,
      rack: request.rack,
      overrides: request.overrides,
      limit: request.limit ?? 10,
    })
    send({
      type: 'result',
      requestId: request.requestId,
      moves,
      dictionarySize,
      elapsedMs: performance.now() - started,
    })
  } catch (error) {
    send({
      type: 'error',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'The solver stopped unexpectedly.',
    })
  }
})

export {}
