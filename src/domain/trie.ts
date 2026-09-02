const A_CODE = 'A'.charCodeAt(0)

export class CompactTrie {
  private readonly firstChild: Int32Array
  private readonly nextSibling: Int32Array
  private readonly character: Uint8Array
  private readonly terminal: Uint8Array

  readonly wordCount: number

  private constructor(
    firstChild: Int32Array,
    nextSibling: Int32Array,
    character: Uint8Array,
    terminal: Uint8Array,
    wordCount: number,
  ) {
    this.firstChild = firstChild
    this.nextSibling = nextSibling
    this.character = character
    this.terminal = terminal
    this.wordCount = wordCount
  }

  static fromWords(input: Iterable<string>): CompactTrie {
    const words = [...input]
      .map((word) => word.trim().toUpperCase())
      .filter((word) => /^[A-Z]{2,15}$/.test(word))
      .sort()
      .filter((word, index, values) => index === 0 || word !== values[index - 1])

    const firstChild: number[] = [-1]
    const nextSibling: number[] = [-1]
    const lastChild: number[] = [-1]
    const character: number[] = [0]
    const terminal: number[] = [0]
    let previous = ''
    let path = [0]

    for (const word of words) {
      let common = 0
      while (common < previous.length && common < word.length && previous[common] === word[common]) {
        common += 1
      }
      path = path.slice(0, common + 1)
      for (let index = common; index < word.length; index += 1) {
        const parent = path[index]
        const node = firstChild.length
        firstChild.push(-1)
        nextSibling.push(-1)
        lastChild.push(-1)
        character.push(word.charCodeAt(index) - A_CODE)
        terminal.push(0)
        if (firstChild[parent] === -1) firstChild[parent] = node
        else nextSibling[lastChild[parent]] = node
        lastChild[parent] = node
        path.push(node)
      }
      terminal[path[word.length]] = 1
      previous = word
    }

    return new CompactTrie(
      Int32Array.from(firstChild),
      Int32Array.from(nextSibling),
      Uint8Array.from(character),
      Uint8Array.from(terminal),
      words.length,
    )
  }

  child(node: number, letter: string): number {
    const wanted = letter.charCodeAt(0) - A_CODE
    let child = this.firstChild[node]
    while (child !== -1) {
      const code = this.character[child]
      if (code === wanted) return child
      if (code > wanted) return -1
      child = this.nextSibling[child]
    }
    return -1
  }

  children(node: number): Array<{ node: number; letter: string }> {
    const result: Array<{ node: number; letter: string }> = []
    let child = this.firstChild[node]
    while (child !== -1) {
      result.push({ node: child, letter: String.fromCharCode(A_CODE + this.character[child]) })
      child = this.nextSibling[child]
    }
    return result
  }

  isTerminal(node: number): boolean {
    return this.terminal[node] === 1
  }

  has(word: string): boolean {
    let node = 0
    for (const letter of word.toUpperCase()) {
      node = this.child(node, letter)
      if (node === -1) return false
    }
    return this.isTerminal(node)
  }
}
