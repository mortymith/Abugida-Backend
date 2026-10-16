/**
 * Spec 11 § Localization & Formatting: Ge'ez 2-syllable n-gram search.
 *
 * Ethiopic script (Ge'ez) uses a syllabary where each glyph is a
 * consonant+vowel syllable. A Latin prefix search fails because a
 * syllable boundary does not align with a prefix boundary. The spec
 * mandates a 2-syllable n-gram tokenizer so እንግሊዝ matches እንግሊዝኛ.
 *
 * Algorithm:
 * 1. Segment into syllables (Ethiopic code points are each one syllable;
 *    non-Ethiopic runs are split per-character so mixed-language titles
 *    still match).
 * 2. Generate overlapping 2-syllable bigrams.
 * 3. Index: tokenize every row title into a set of bigrams + single
 *    syllables.
 * 4. Query: tokenize the query; a row matches when every query bigram
 *    is present in the row's set (AND semantics, like tsvector).
 */

// Ethiopic code point range (U+1200–U+137F). Used for reference; the
// tokenizer segments by character (each Ethiopic code point is one syllable).
// const ETHIOPIC_START = 0x1200
// const ETHIOPIC_END = 0x137f

// function isEthiopic(codePoint: number): boolean {
//   return codePoint >= ETHIOPIC_START && codePoint <= ETHIOPIC_END
// }

export function segmentSyllables(text: string): string[] {
  const syllables: string[] = []
  for (const char of text) {
    if (/\s/.test(char)) continue
    syllables.push(char)
  }
  return syllables
}

export function generateNgrams(syllables: readonly string[]): string[] {
  if (syllables.length === 0) return []
  if (syllables.length === 1) return [syllables[0]]
  const ngrams: string[] = []
  for (let i = 0; i < syllables.length - 1; i++) {
    ngrams.push(syllables[i] + syllables[i + 1])
  }
  return ngrams
}

export function tokenizeForIndex(text: string): Set<string> {
  const syllables = segmentSyllables(text)
  const tokens = new Set<string>(syllables)
  for (const ngram of generateNgrams(syllables)) {
    tokens.add(ngram)
  }
  return tokens
}

export function tokenizeQuery(query: string): string[] | null {
  const ngrams = generateNgrams(segmentSyllables(query))
  if (ngrams.length === 0) return null
  return ngrams
}

export function matchesQuery(rowTitle: string, query: string): boolean {
  const queryNgrams = tokenizeQuery(query)
  if (queryNgrams === null) return true
  const rowNgrams = tokenizeForIndex(rowTitle)
  return queryNgrams.every((ng) => rowNgrams.has(ng))
}

export interface HighlightSegment {
  readonly text: string
  readonly highlighted: boolean
}

export function highlightMatches(rowTitle: string, query: string): HighlightSegment[] {
  const queryNgrams = tokenizeQuery(query)
  if (queryNgrams === null) return [{ text: rowTitle, highlighted: false }]
  const syllables = segmentSyllables(rowTitle)
  if (syllables.length === 0) return [{ text: rowTitle, highlighted: false }]

  const querySet = new Set(queryNgrams)
  const participates = new Array<boolean>(syllables.length).fill(false)
  for (let i = 0; i < syllables.length; i++) {
    const forward = syllables[i] + (syllables[i + 1] ?? '')
    const backward = (syllables[i - 1] ?? '') + syllables[i]
    if (forward.length === 2 && querySet.has(forward)) {
      participates[i] = true
      if (i + 1 < syllables.length) participates[i + 1] = true
    }
    if (backward.length === 2 && querySet.has(backward)) {
      participates[i] = true
      if (i - 1 >= 0) participates[i - 1] = true
    }
  }

  const segments: HighlightSegment[] = []
  let currentText = ''
  let currentHighlighted = false
  for (let i = 0; i < syllables.length; i++) {
    const highlighted = participates[i]
    if (currentText && currentHighlighted === highlighted) {
      currentText += syllables[i]
    } else {
      if (currentText) segments.push({ text: currentText, highlighted: currentHighlighted })
      currentText = syllables[i]!
      currentHighlighted = highlighted
    }
  }
  if (currentText) segments.push({ text: currentText, highlighted: currentHighlighted })
  return segments
}
