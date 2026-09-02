import { GLYPH_TEMPLATES, RACK_GLYPH_TEMPLATES } from './glyphTemplates'

export interface GlyphMatch {
  letter: string
  confidence: number
  polarity: 'dark' | 'light'
  componentHeight: number
}

interface Component {
  pixels: number[]
  sourceWidth: number
  minX: number
  minY: number
  width: number
  height: number
  area: number
}

const TEMPLATE_SIZE = 32
const templates = Object.entries(GLYPH_TEMPLATES).map(([letter, bits]) => ({
  letter,
  mask: Uint8Array.from(bits, (bit) => Number(bit)),
}))
const rackTemplates = Object.entries(RACK_GLYPH_TEMPLATES).map(([letter, bits]) => ({
  letter,
  mask: Uint8Array.from(bits, (bit) => Number(bit)),
}))

export function classifyBoardGlyph(canvas: HTMLCanvasElement, row: number, col: number): GlyphMatch | null {
  const cell = canvas.width / 15
  return classifyRegion(canvas, {
    x: (col + 0.12) * cell,
    y: (row + 0.16) * cell,
    width: cell * 0.76,
    height: cell * 0.72,
  }, 'board', cell * 0.43)
}

export function classifyRackGlyph(canvas: HTMLCanvasElement, index: number, allowedLetters?: ReadonlySet<string>): GlyphMatch | null {
  const slotWidth = canvas.width / 7
  const tileTop = canvas.width * 0.105
  const tileHeight = canvas.width * 0.155
  return classifyRegion(canvas, {
    x: index * slotWidth + slotWidth * 0.12,
    y: tileTop + tileHeight * 0.12,
    width: slotWidth * 0.76,
    height: tileHeight * 0.76,
  }, 'rack', tileHeight * 0.38, allowedLetters)
}

function classifyRegion(
  canvas: HTMLCanvasElement,
  rect: { x: number; y: number; width: number; height: number },
  mode: 'board' | 'rack',
  minimumHeight: number,
  allowedLetters?: ReadonlySet<string>,
): GlyphMatch | null {
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) return null
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const image = context.getImageData(Math.round(rect.x), Math.round(rect.y), width, height)
  let saturationTotal = 0
  let samples = 0
  for (let index = 0; index < image.data.length; index += 16) {
    const red = image.data[index]
    const green = image.data[index + 1]
    const blue = image.data[index + 2]
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    saturationTotal += max ? (max - min) / max : 0
    samples += 1
  }
  const saturatedBackground = saturationTotal / Math.max(1, samples) > 0.12

  const masks: Array<{ data: Uint8Array; polarity: 'dark' | 'light' }> = []
  const dark = new Uint8Array(width * height)
  const light = new Uint8Array(width * height)
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    const red = image.data[offset]
    const green = image.data[offset + 1]
    const blue = image.data[offset + 2]
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114
    const brownLetter = luminance < 115 && red > green * 1.08 && red > blue * 1.12 && red - green > 8
    const generallyDark = luminance < 118
    if (mode === 'board' ? brownLetter : generallyDark) dark[index] = 1
    if (saturatedBackground && red > 218 && green > 218 && blue > 218 && Math.max(red, green, blue) - Math.min(red, green, blue) < 25) {
      light[index] = 1
    }
  }
  masks.push({ data: dark, polarity: 'dark' })
  if (mode === 'board') masks.push({ data: light, polarity: 'light' })

  let best: GlyphMatch | null = null
  const templatePool = mode === 'rack' ? [...rackTemplates, ...templates] : templates
  for (const mask of masks) {
    const components = connectedComponents(mask.data, width, height)
      .filter((component) => component.height >= minimumHeight && component.area >= 35)
      .sort((a, b) => b.area - a.area)
      .slice(0, 5)
    for (const component of components) {
      const normalized = normalize(component)
      for (const template of templatePool) {
        if (allowedLetters && !allowedLetters.has(template.letter)) continue
        const confidence = maskSimilarity(normalized, template.mask)
        if (!best || confidence > best.confidence) {
          best = { letter: template.letter, confidence, polarity: mask.polarity, componentHeight: component.height }
        }
      }
    }
  }
  return best && best.confidence >= 0.38 ? best : null
}

function connectedComponents(data: Uint8Array, width: number, height: number): Component[] {
  const seen = new Uint8Array(data.length)
  const result: Component[] = []
  for (let start = 0; start < data.length; start += 1) {
    if (!data[start] || seen[start]) continue
    const queue = [start]
    seen[start] = 1
    const pixels: number[] = []
    let minX = width
    let maxX = 0
    let minY = height
    let maxY = 0
    while (queue.length) {
      const index = queue.pop() as number
      pixels.push(index)
      const x = index % width
      const y = Math.floor(index / width)
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
      const neighbors = [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
      for (const [nextX, nextY] of neighbors) {
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue
        const next = nextY * width + nextX
        if (data[next] && !seen[next]) {
          seen[next] = 1
          queue.push(next)
        }
      }
    }
    result.push({
      pixels,
      sourceWidth: width,
      minX,
      minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
      area: pixels.length,
    })
  }
  return result
}

function normalize(component: Component): Uint8Array {
  const output = new Uint8Array(TEMPLATE_SIZE * TEMPLATE_SIZE)
  const scale = Math.min((TEMPLATE_SIZE - 4) / component.width, (TEMPLATE_SIZE - 3) / component.height)
  const targetWidth = Math.max(1, Math.round(component.width * scale))
  const targetHeight = Math.max(1, Math.round(component.height * scale))
  const offsetX = Math.floor((TEMPLATE_SIZE - targetWidth) / 2)
  const offsetY = Math.floor((TEMPLATE_SIZE - targetHeight) / 2)
  const sourceSet = new Set(component.pixels)
  for (let y = 0; y < targetHeight; y += 1) {
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = component.minX + Math.min(component.width - 1, Math.floor((x / targetWidth) * component.width))
      const sourceY = component.minY + Math.min(component.height - 1, Math.floor((y / targetHeight) * component.height))
      if (sourceSet.has(sourceY * component.sourceWidth + sourceX)) output[(offsetY + y) * TEMPLATE_SIZE + offsetX + x] = 1
    }
  }
  return output
}

function maskSimilarity(a: Uint8Array, b: Uint8Array): number {
  let aCount = 0
  let bCount = 0
  let aMatched = 0
  let bMatched = 0
  for (let y = 0; y < TEMPLATE_SIZE; y += 1) {
    for (let x = 0; x < TEMPLATE_SIZE; x += 1) {
      const index = y * TEMPLATE_SIZE + x
      if (a[index]) {
        aCount += 1
        if (hasNeighbor(b, x, y)) aMatched += 1
      }
      if (b[index]) {
        bCount += 1
        if (hasNeighbor(a, x, y)) bMatched += 1
      }
    }
  }
  if (!aCount || !bCount) return 0
  return (aMatched / aCount + bMatched / bCount) / 2
}

function hasNeighbor(mask: Uint8Array, x: number, y: number): boolean {
  for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      const nextX = x + offsetX
      const nextY = y + offsetY
      if (nextX >= 0 && nextX < TEMPLATE_SIZE && nextY >= 0 && nextY < TEMPLATE_SIZE && mask[nextY * TEMPLATE_SIZE + nextX]) return true
    }
  }
  return false
}
