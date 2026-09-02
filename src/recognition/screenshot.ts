import { createWorker, OEM, PSM, type LoggerMessage, type Page, type Symbol as OcrSymbol, type Worker as OcrWorker } from 'tesseract.js'
import { getPremium, LETTER_VALUES } from '../domain/rules'
import { BOARD_SIZE, emptyBoard, type ParsedGame, type RackTile, type ScreenProfile } from '../domain/types'
import { classifyBoardGlyph, classifyRackGlyph } from './glyphClassifier'

type ProgressCallback = (message: string, progress: number) => void

interface LocatedBoard {
  x: number
  y: number
  size: number
  confidence: number
}

let activeProgress: ProgressCallback | null = null
let workerPromise: ReturnType<typeof createWorker> | null = null

function assetUrl(path: string): string {
  return new URL(`${import.meta.env.BASE_URL}${path}`, window.location.origin).href
}

async function getOcrWorker(onProgress: ProgressCallback) {
  activeProgress = onProgress
  if (!workerPromise) {
    workerPromise = createWorker('eng', OEM.LSTM_ONLY, {
      workerPath: assetUrl('tesseract/worker.min.js'),
      corePath: assetUrl('tesseract/'),
      langPath: assetUrl('tesseract/lang/'),
      gzip: true,
      workerBlobURL: false,
      logger: (message: LoggerMessage) => {
        const label = message.status.includes('recognizing') ? 'Reading tile letters…' : 'Preparing offline OCR…'
        activeProgress?.(label, 0.32 + message.progress * 0.42)
      },
    })
  }
  const worker = await workerPromise
  await worker.setParameters({
    tessedit_pageseg_mode: PSM.SPARSE_TEXT,
    tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    preserve_interword_spaces: '1',
    user_defined_dpi: '300',
  })
  return worker
}

async function decodeImage(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      // Safari can reject some Photos-backed blobs; the image element path is more forgiving.
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.decoding = 'async'
    image.src = url
    await image.decode()
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

function imageDimensions(image: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return image instanceof ImageBitmap
    ? { width: image.width, height: image.height }
    : { width: image.naturalWidth, height: image.naturalHeight }
}

function locateBoard(source: HTMLCanvasElement): LocatedBoard {
  const calibratedRatio = 1320 / 2868
  if (Math.abs(source.width / source.height - calibratedRatio) <= 0.025) {
    return {
      x: source.width * (21 / 1320),
      y: source.height * (795 / 2868),
      size: source.width * (1278 / 1320),
      confidence: 1,
    }
  }
  const sampleWidth = 330
  const scale = sampleWidth / source.width
  const sampleHeight = Math.round(source.height * scale)
  const sample = document.createElement('canvas')
  sample.width = sampleWidth
  sample.height = sampleHeight
  const context = sample.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas is unavailable in this browser.')
  context.drawImage(source, 0, 0, sampleWidth, sampleHeight)
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight).data
  const gridX = sampleWidth * 0.016
  const gridSize = sampleWidth * 0.968
  const cellSize = gridSize / BOARD_SIZE

  const edge = new Float32Array(sampleHeight)
  for (let y = 3; y < sampleHeight - 3; y += 1) {
    let sum = 0
    let count = 0
    for (let x = Math.ceil(gridX); x < gridX + gridSize; x += 3) {
      const top = ((y - 2) * sampleWidth + x) * 4
      const bottom = ((y + 2) * sampleWidth + x) * 4
      const topLight = pixels[top] * 0.299 + pixels[top + 1] * 0.587 + pixels[top + 2] * 0.114
      const bottomLight = pixels[bottom] * 0.299 + pixels[bottom + 1] * 0.587 + pixels[bottom + 2] * 0.114
      sum += Math.abs(topLight - bottomLight)
      count += 1
    }
    edge[y] = sum / Math.max(1, count)
  }

  const minTop = Math.floor(sampleHeight * 0.18)
  const maxTop = Math.min(Math.floor(sampleHeight * 0.38), Math.floor(sampleHeight - gridSize - 2))
  let bestTop = minTop
  let bestScore = -1
  for (let candidate = minTop; candidate <= maxTop; candidate += 1) {
    let score = 0
    for (let line = 0; line <= BOARD_SIZE; line += 1) {
      const expected = Math.round(candidate + line * cellSize)
      let local = 0
      for (let offset = -2; offset <= 2; offset += 1) local = Math.max(local, edge[expected + offset] ?? 0)
      score += local * (line === 0 || line === BOARD_SIZE ? 1.35 : 1)
    }
    if (score > bestScore) {
      bestScore = score
      bestTop = candidate
    }
  }

  return {
    x: source.width * 0.016,
    y: bestTop / scale,
    size: source.width * 0.968,
    confidence: Math.min(1, bestScore / 360),
  }
}

function cropCanvas(source: HTMLCanvasElement, x: number, y: number, width: number, height: number): HTMLCanvasElement {
  const output = document.createElement('canvas')
  output.width = Math.max(1, Math.round(width))
  output.height = Math.max(1, Math.round(height))
  const context = output.getContext('2d')
  if (!context) throw new Error('Canvas is unavailable in this browser.')
  context.drawImage(source, x, y, width, height, 0, 0, output.width, output.height)
  return output
}

function symbolsFromPage(page: Page): OcrSymbol[] {
  if (!page.blocks) return []
  return page.blocks.flatMap((block) =>
    block.paragraphs.flatMap((paragraph) =>
      paragraph.lines.flatMap((line) => line.words.flatMap((word) => word.symbols)),
    ),
  )
}

function saturation(red: number, green: number, blue: number): number {
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  return max === 0 ? 0 : (max - min) / max
}

function visualTileScore(canvas: HTMLCanvasElement, row: number, col: number): number {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return 0
  const cell = canvas.width / BOARD_SIZE
  const x = Math.round((col + 0.18) * cell)
  const y = Math.round((row + 0.16) * cell)
  const width = Math.max(1, Math.round(cell * 0.64))
  const height = Math.max(1, Math.round(cell * 0.7))
  const data = context.getImageData(x, y, width, height).data
  let saturationTotal = 0
  let dark = 0
  let lightTotal = 0
  let lightSquared = 0
  let samples = 0
  for (let index = 0; index < data.length; index += 16) {
    const red = data[index]
    const green = data[index + 1]
    const blue = data[index + 2]
    const light = red * 0.299 + green * 0.587 + blue * 0.114
    saturationTotal += saturation(red, green, blue)
    lightTotal += light
    lightSquared += light * light
    if (light < 95) dark += 1
    samples += 1
  }
  const averageLight = lightTotal / samples
  const deviation = Math.sqrt(Math.max(0, lightSquared / samples - averageLight * averageLight))
  const averageSaturation = saturationTotal / samples
  return Math.min(1, averageSaturation * 1.8 + deviation / 90 + (dark / samples) * 3)
}

const PREMIUM_COLORS: Record<Exclude<ReturnType<typeof getPremium>, null>, [number, number, number]> = {
  DL: [95, 175, 222],
  TL: [171, 199, 103],
  DW: [242, 131, 118],
  TW: [252, 165, 113],
}

function looksLikeVisiblePremium(canvas: HTMLCanvasElement, row: number, col: number): boolean {
  const premium = getPremium(row, col)
  if (!premium) return false
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return false
  const cell = canvas.width / BOARD_SIZE
  const fractions = [0.12, 0.22, 0.78, 0.88]
  const total = [0, 0, 0]
  let count = 0
  for (const yFraction of fractions) {
    for (const xFraction of fractions) {
      const pixel = context.getImageData(
        Math.floor((col + xFraction) * cell),
        Math.floor((row + yFraction) * cell),
        1,
        1,
      ).data
      total[0] += pixel[0]
      total[1] += pixel[1]
      total[2] += pixel[2]
      count += 1
    }
  }
  const expected = PREMIUM_COLORS[premium]
  const distance = Math.hypot(
    total[0] / count - expected[0],
    total[1] / count - expected[1],
    total[2] / count - expected[2],
  )
  return distance < 24
}

function parseBoardSymbols(boardCanvas: HTMLCanvasElement, symbols: OcrSymbol[]): Pick<ParsedGame, 'board' | 'confidence'> {
  const board = emptyBoard()
  const confidence: ParsedGame['confidence'] = []
  const cellSize = boardCanvas.width / BOARD_SIZE
  const byCell = new Map<number, OcrSymbol[]>()

  for (const symbol of symbols) {
    const letter = symbol.text.toUpperCase().replace(/[^A-Z]/g, '')
    if (letter.length !== 1) continue
    const centerX = (symbol.bbox.x0 + symbol.bbox.x1) / 2
    const centerY = (symbol.bbox.y0 + symbol.bbox.y1) / 2
    const col = Math.floor(centerX / cellSize)
    const row = Math.floor(centerY / cellSize)
    if (row < 0 || row >= BOARD_SIZE || col < 0 || col >= BOARD_SIZE) continue
    const key = row * BOARD_SIZE + col
    byCell.set(key, [...(byCell.get(key) ?? []), { ...symbol, text: letter }])
  }

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const candidates = (byCell.get(row * BOARD_SIZE + col) ?? []).sort(
        (a, b) => b.bbox.y1 - b.bbox.y0 - (a.bbox.y1 - a.bbox.y0),
      )
      const largest = candidates[0]
      const largestHeight = largest ? largest.bbox.y1 - largest.bbox.y0 : 0
      const premium = getPremium(row, col)
      const recognized = candidates.map((candidate) => candidate.text).join('')
      const isVisiblePremium = premium !== null && (
        looksLikeVisiblePremium(boardCanvas, row, col) ||
        (recognized.includes(premium[0]) && recognized.includes(premium[1]))
      )
      const tileScore = visualTileScore(boardCanvas, row, col)
      const isLargeGlyph = largestHeight >= cellSize * 0.46
      const template = classifyBoardGlyph(boardCanvas, row, col)

      const templateLooksLikeTile = template && template.confidence >= 0.5

      if (template && templateLooksLikeTile && !(isVisiblePremium && template.polarity === 'light')) {
        board[row][col] = { letter: template.letter, isBlank: false }
        confidence.push({
          row,
          col,
          confidence: template.confidence,
          reason: template.confidence < 0.7 ? 'The tile shape was not a close match. Check this letter.' : undefined,
        })
      } else if (largest && isLargeGlyph && !isVisiblePremium) {
        board[row][col] = { letter: largest.text, isBlank: false }
        confidence.push({
          row,
          col,
          confidence: Math.max(0, Math.min(1, largest.confidence / 100)),
          reason: largest.confidence < 75 ? 'OCR was unsure about this letter.' : undefined,
        })
      } else if (!isVisiblePremium && tileScore > 0.64) {
        confidence.push({ row, col, confidence: 0, reason: 'This looks occupied, but its letter was not recognized.' })
      }
    }
  }
  return { board, confidence }
}

function parseRackSymbols(symbols: OcrSymbol[], rackCanvas: HTMLCanvasElement): RackTile[] {
  const candidates = symbols
    .map((symbol) => ({ ...symbol, text: symbol.text.toUpperCase().replace(/[^A-Z]/g, '') }))
    .filter((symbol) => symbol.text.length === 1)
  const maxHeight = Math.max(0, ...candidates.map((symbol) => symbol.bbox.y1 - symbol.bbox.y0))
  const large = candidates
    .filter((symbol) => symbol.bbox.y1 - symbol.bbox.y0 >= Math.max(rackCanvas.width * 0.052, maxHeight * 0.64))
    .sort((a, b) => a.bbox.x0 - b.bbox.x0)

  const deDuplicated: typeof large = []
  for (const symbol of large) {
    const center = (symbol.bbox.x0 + symbol.bbox.x1) / 2
    if (deDuplicated.some((other) => Math.abs((other.bbox.x0 + other.bbox.x1) / 2 - center) < rackCanvas.width / 20)) continue
    deDuplicated.push(symbol)
  }
  return deDuplicated.slice(0, 7).map((symbol) => ({ letter: symbol.text, isBlank: false }))
}

async function recognizeRackTiles(
  worker: OcrWorker,
  rackCanvas: HTMLCanvasElement,
  fallbackSymbols: OcrSymbol[],
  onProgress: ProgressCallback,
): Promise<RackTile[]> {
  const slotWidth = rackCanvas.width / 7
  const tileTop = rackCanvas.width * 0.105
  const tileHeight = rackCanvas.width * 0.155
  const result: RackTile[] = []
  for (let index = 0; index < 7; index += 1) {
    onProgress(`Reading rack tile ${index + 1} of 7…`, 0.81 + index * 0.022)
    const directTemplate = classifyRackGlyph(rackCanvas, index)
    if (directTemplate && directTemplate.confidence >= 0.78) {
      result.push({ letter: directTemplate.letter, isBlank: false })
      continue
    }
    const scoreCanvas = cropCanvas(
      rackCanvas,
      index * slotWidth + slotWidth * 0.67,
      tileTop,
      slotWidth * 0.27,
      tileHeight * 0.31,
    )
    const enlargedScore = document.createElement('canvas')
    enlargedScore.width = scoreCanvas.width * 3
    enlargedScore.height = scoreCanvas.height * 3
    const scoreContext = enlargedScore.getContext('2d')
    scoreContext?.drawImage(scoreCanvas, 0, 0, enlargedScore.width, enlargedScore.height)
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: '0123456789' })
    const scoreResult = await worker.recognize(enlargedScore, {}, { text: true, blocks: false })
    const pointValue = Number.parseInt(scoreResult.data.text.replace(/[^0-9]/g, ''), 10)
    const allowedLetters = Number.isFinite(pointValue)
      ? new Set(Object.entries(LETTER_VALUES).filter(([, value]) => value === pointValue).map(([letter]) => letter))
      : undefined
    const template = classifyRackGlyph(rackCanvas, index, allowedLetters)
    if (template && template.confidence >= 0.46) {
      result.push({ letter: template.letter, isBlank: false })
      continue
    }
    const tile = cropCanvas(
      rackCanvas,
      index * slotWidth + slotWidth * 0.12,
      tileTop + tileHeight * 0.12,
      slotWidth * 0.76,
      tileHeight * 0.76,
    )
    const whitelist = allowedLetters?.size ? [...allowedLetters].join('') : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_CHAR, tessedit_char_whitelist: whitelist })
    const recognized = await worker.recognize(tile, {}, { text: true, blocks: false })
    const letter = recognized.data.text.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1)
    if (letter) result.push({ letter, isBlank: false })
  }
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' })
  return result.length >= 5 ? result : parseRackSymbols(fallbackSymbols, rackCanvas)
}

export async function parseScreenshot(file: File, onProgress: ProgressCallback = () => undefined): Promise<ParsedGame> {
  onProgress('Opening screenshot…', 0.04)
  const decoded = await decodeImage(file)
  const { width, height } = imageDimensions(decoded)
  const source = document.createElement('canvas')
  source.width = width
  source.height = height
  const sourceContext = source.getContext('2d')
  if (!sourceContext) throw new Error('Canvas is unavailable in this browser.')
  sourceContext.drawImage(decoded, 0, 0)
  if (decoded instanceof ImageBitmap) decoded.close()

  onProgress('Finding the 15 × 15 board…', 0.12)
  const located = locateBoard(source)
  const boardCanvas = cropCanvas(source, located.x, located.y, located.size, located.size)
  const rackY = located.y + located.size + width * 0.025
  const rackHeight = Math.min(height - rackY, width * 0.46)
  const rackCanvas = cropCanvas(source, 0, rackY, width, rackHeight)
  const warnings: string[] = []
  const expectedRatio = 1320 / 2868
  if (Math.abs(width / height - expectedRatio) > 0.025) {
    warnings.push('This screenshot has a different shape from the calibrated iPhone layout. Check every cell carefully.')
  }
  if (located.confidence < 0.45) warnings.push('The board boundary was uncertain. Manual corrections may be needed.')

  let parsedBoard = emptyBoard()
  let confidence: ParsedGame['confidence'] = []
  let rack: RackTile[] = []
  try {
    const worker = await getOcrWorker(onProgress)
    const boardResult = await worker.recognize(boardCanvas, {}, { text: true, blocks: true })
    const parsed = parseBoardSymbols(boardCanvas, symbolsFromPage(boardResult.data))
    parsedBoard = parsed.board
    confidence = parsed.confidence
    onProgress('Reading your rack…', 0.8)
    const rackResult = await worker.recognize(rackCanvas, {}, { text: true, blocks: true })
    const rackSymbols = symbolsFromPage(rackResult.data)
    rack = await recognizeRackTiles(worker, rackCanvas, rackSymbols, onProgress)
    if (rack.length === 0) warnings.push('The rack could not be read. Enter your tiles below.')
    else if (rack.length < 7) warnings.push(`Only ${rack.length} rack tile${rack.length === 1 ? '' : 's'} were recognized. Check the rack.`)
  } catch (error) {
    warnings.push(`Automatic letter recognition was unavailable: ${error instanceof Error ? error.message : 'unknown error'}`)
  }

  const profile: ScreenProfile = {
    id: 'iphone-1320x2868-v1',
    sourceWidth: width,
    sourceHeight: height,
    boardRect: { x: located.x, y: located.y, size: located.size },
    rackRect: { x: 0, y: rackY, width, height: rackHeight },
  }
  onProgress('Ready to review.', 1)
  return { board: parsedBoard, rack, confidence, profile, warnings }
}
