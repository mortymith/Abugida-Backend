/**
 * Ge'ez 2-syllable n-gram search tokenizer (spec 04 § S-2.17 → Curriculum
 * sidebar search, spec 11 § Localization & Formatting → Ge'ez search).
 *
 * The spec mandates a 2-syllable n-gram tokenizer for Ethiopic text. Amharic
 * and Tigrinya write in a Ge'ez (Ethiopic) syllabary where each glyph is a
 * consonant+vowel syllable. A Latin prefix search (`LIKE 'እን%'`) fails
 * because a syllable boundary does not align with a prefix boundary: the
 * query `እንግሊዝ` (the word "English") should match a tree row titled
 * `እንግሊዝኛ` (the word "English-language"), but only if the tokenizer
 * produces overlapping 2-syllable n-grams from both.
 *
 * The algorithm:
 *
 * 1. **Syllable segmentation.** Split the input into Ethiopic syllables using
 *    the Unicode Ethiopic block (`\u1200`–`\u137C`). Non-Ethiopic runs
 *    (Latin, digits, punctuation) are treated as single "syllables" per
 *    character so mixed-language titles still match.
 * 2. **2-syllable n-gram generation.** For a syllable sequence
 *    `[s0, s1, s2, s3, ...]`, produce the n-grams
 *    `[s0s1, s1s2, s2s3, ...]`. A single-syllable term produces `[s0]`.
 * 3. **Index tokenization.** The indexer tokenizes every tree row's title
 *    into n-grams and stores them in the search index.
 * 4. **Query tokenization.** The query is tokenized the same way; a row
 *    matches if every query n-gram is present in the row's n-gram set
 *    (AND semantics, like tsvector).
 *
 * This module is framework-free: it owns the tokenizer. The server function
 * (`courses.curriculum.impl.server.ts`) uses it to build and query the
 * search index.
 */

/**
 * The Unicode Ethiopic block range. Characters in this range are treated
 * as syllables; characters outside it are treated as single-character
 * tokens.
 */
const ETHIOPIC_START = 0x1200
const ETHIOPIC_END = 0x137f // inclusive end of the core Ethiopic block

function isEthiopic(codePoint: number): boolean {
  return codePoint >= ETHIOPIC_START && codePoint <= ETHIOPIC_END
}

/**
 * Segment `text` into syllables. Ethiopic characters are each one
 * syllable; non-Ethiopic runs are split per-character so a Latin word
 * like "TOEFL" produces 5 tokens, not 1.
 *
 * Whitespace and punctuation are dropped — they are not syllables and
 * should not participate in n-gram matching.
 */
export function segmentSyllables(text: string): string[] {
  const syllables: string[] = []
  // Use the spread operator to iterate by code point (not UTF-16 unit),
  // so supplementary plane characters are handled correctly.
  for (const char of text) {
    const codePoint = char.codePointAt(0)
    if (codePoint === undefined) continue
    // Whitespace and control characters are dropped.
    if (/\s/.test(char)) continue
    if (isEthiopic(codePoint)) {
      syllables.push(char)
    } else {
      // Non-Ethiopic: treat each character as a syllable. This means a
      // Latin word "TOEFL" produces ['T', 'O', 'E', 'F', 'L'], and its
      // 2-grams are ['TO', 'OE', 'EF', 'FL']. A query "TOE" matches
      // because 'TO' and 'OE' are both in the index set.
      syllables.push(char)
    }
  }
  return syllables
}

/**
 * Generate 2-syllable n-grams from a syllable sequence.
 *
 * For `[s0, s1, s2, s3]`, produces `[s0s1, s1s2, s2s3]`. A sequence of
 * length 0 produces `[]`; length 1 produces `[s0]` (a single syllable is
 * its own token — a one-syllable query like `እ` should still match).
 */
export function generateNgrams(syllables: readonly string[]): string[] {
  if (syllables.length === 0) return []
  if (syllables.length === 1) return [syllables[0]]

  const ngrams: string[] = []
  for (let i = 0; i < syllables.length - 1; i++) {
    ngrams.push(syllables[i] + syllables[i + 1])
  }
  return ngrams
}

/**
 * Tokenize `text` into a set of 2-syllable n-grams PLUS single syllables.
 * The set is deduplicated so the indexer stores each token once per row.
 *
 * Single syllables are included so a one-syllable query (e.g. `እ`) can
 * match — a 2-gram-only index would not contain `እ` by itself, only
 * `እን`, `እን`-containing bigrams.
 */
export function tokenizeForIndex(text: string): Set<string> {
  const syllables = segmentSyllables(text)
  const tokens = new Set<string>(syllables)
  for (const ngram of generateNgrams(syllables)) {
    tokens.add(ngram)
  }
  return tokens
}

/**
 * Tokenize `query` into a list of 2-syllable n-grams. The query n-grams
 * are NOT deduplicated — a repeated n-gram in the query is still a single
 * search constraint (AND semantics), but the caller may want to know the
 * original count for ranking.
 *
 * Returns `null` when the query produces no n-grams (empty or
 * whitespace-only query). The caller treats `null` as "no filter" —
 * return all rows.
 */
export function tokenizeQuery(query: string): string[] | null {
  const ngrams = generateNgrams(segmentSyllables(query))
  if (ngrams.length === 0) return null
  return ngrams
}

/**
 * Whether `rowTitle` matches `query` under the 2-syllable n-gram model.
 *
 * A row matches when every query n-gram is present in the row's n-gram
 * set (AND semantics). This mirrors `tsvector @@ tsquery` semantics.
 *
 * The spec example: `እንግሊዝ` (query, "English") matches `እንግሊዝኛ` (row
 * title, "English-language") because:
 * - query n-grams: `እን`, `ንግ`, `ግሊ`, `ሊዝ`
 * - row n-grams: `እን`, `ንግ`, `ግሊ`, `ሊዝ`, `ዝኛ`
 * - every query n-gram is in the row set → match.
 */
export function matchesQuery(rowTitle: string, query: string): boolean {
  const queryNgrams = tokenizeQuery(query)
  if (queryNgrams === null) return true // no filter
  const rowNgrams = tokenizeForIndex(rowTitle)
  return queryNgrams.every((ng) => rowNgrams.has(ng))
}

/**
 * Highlight the matching syllable groups in `rowTitle` for the given
 * query. Returns an array of segments so the renderer can wrap matching
 * runs in a `<mark>` element.
 *
 * The spec calls for "highlighted syllable groups in tree rows" — the
 * highlight is at the syllable-group level (2-syllable n-gram), not the
 * character level, so the reader sees which part of the title matched.
 */
export interface HighlightSegment {
  readonly text: string
  readonly highlighted: boolean
}

export function highlightMatches(rowTitle: string, query: string): HighlightSegment[] {
  const queryNgrams = tokenizeQuery(query)
  if (queryNgrams === null) {
    return [{ text: rowTitle, highlighted: false }]
  }

  const querySet = new Set(queryNgrams)
  const syllables = segmentSyllables(rowTitle)
  if (syllables.length === 0) {
    return [{ text: rowTitle, highlighted: false }]
  }

  // Mark each syllable position by whether it participates in a matching
  // 2-gram. Syllable `i` participates if the 2-gram `syllables[i] +
  // syllables[i+1]` is in the query set, OR the 2-gram `syllables[i-1] +
  // syllables[i]` is in the query set.
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

  // Reconstruct the original text (with whitespace/punctuation preserved)
  // by walking the original string and mapping each character to its
  // syllable index. This is simpler than tracking offsets during
  // segmentation and handles mixed Ethiopic/Latin correctly.
  const segments: HighlightSegment[] = []
  let currentText = ''
  let currentHighlighted = false
  let syllableIdx = 0

  for (const char of rowTitle) {
    if (/\s/.test(char)) {
      // Whitespace: flush current segment, then add whitespace as
      // non-highlighted.
      if (currentText) {
        segments.push({ text: currentText, highlighted: currentHighlighted })
        currentText = ''
      }
      // Preserve whitespace in the output by attaching it to the next
      // segment. Simpler: push it as its own non-highlighted segment.
      segments.push({ text: char, highlighted: false })
      continue
    }
    // This character is a syllable. Look up its participation flag.
    const highlighted = syllableIdx < participates.length && participates[syllableIdx]
    syllableIdx += 1
    if (currentText && currentHighlighted === highlighted) {
      currentText += char
    } else {
      if (currentText) {
        segments.push({ text: currentText, highlighted: currentHighlighted })
      }
      currentText = char
      currentHighlighted = highlighted
    }
  }
  if (currentText) {
    segments.push({ text: currentText, highlighted: currentHighlighted })
  }

  return segments
}
