/**
 * Merge tags for the Email Template Editor (spec 10 S-8.2) — pure module so
 * validation, suggestions, and preview rendering are unit-testable and can
 * never drift between the editor, the campaign composer, and automations.
 *
 * A tag is written `{{tag_name}}`; unknown or misspelled tags are highlighted
 * with a suggestion list before a template can be published.
 */

export const MERGE_TAGS = [
  'first_name',
  'last_name',
  'email',
  'course_name',
  'start_date',
  'progress_url',
  'unsubscribe_url',
] as const

export type MergeTagName = (typeof MERGE_TAGS)[number]

const TAG_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

/** All tag names appearing in a set of template texts (duplicates removed). */
export function extractMergeTags(texts: Array<string | null | undefined>): string[] {
  const found = new Set<string>()
  for (const text of texts) {
    if (!text) continue
    for (const match of text.matchAll(TAG_PATTERN)) {
      found.add(match[1].toLowerCase())
    }
  }
  return [...found].filter(Boolean)
}

/** Damerau-Levenshtein-lite distance capped for suggestion purposes. */
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)])
  for (let j = 0; j <= b.length; j++) dp[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    }
  }
  return dp[a.length][b.length]
}

/** Nearest known tags within an edit distance of 2 (or 1 for short names). */
export function suggestMergeTag(tag: string): MergeTagName[] {
  const threshold = tag.length <= 5 ? 1 : 2
  return MERGE_TAGS.filter((candidate) => editDistance(tag.toLowerCase(), candidate) <= threshold)
}

export interface MergeTagIssue {
  tag: string
  suggestions: MergeTagName[]
}

/**
 * Validate every tag used in the given texts. Returns one issue per unknown
 * tag — the editor surfaces these with the suggestion list (S-8.2).
 */
export function validateMergeTags(texts: Array<string | null | undefined>): MergeTagIssue[] {
  const known = new Set<string>(MERGE_TAGS)
  return extractMergeTags(texts)
    .filter((tag) => !known.has(tag))
    .map((tag) => ({ tag, suggestions: suggestMergeTag(tag) }))
}

export type MergeTagData = Partial<Record<MergeTagName, string>>

const FALLBACKS: MergeTagData = {
  unsubscribe_url: '#unsubscribe',
}

/** Render `{{tag}}` occurrences with sample/real data; unknown tags stay. */
export function renderMergeTags(text: string, data: MergeTagData): string {
  return text.replace(TAG_PATTERN, (whole, rawName: string) => {
    const name = rawName.toLowerCase() as MergeTagName
    const value = data[name] ?? FALLBACKS[name]
    return value ?? whole
  })
}

/** Whether the text still contains any tag occurrence. */
export function hasUnresolvedTags(text: string): boolean {
  return /\{\{\s*[a-zA-Z0-9_]+\s*\}\}/.test(text)
}
