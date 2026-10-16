/**
 * S-5.1 Per-item engagement logic (spec 07 § S-5.1 — Item Engagement).
 *
 * The spec: "one row per non-archived item, ordered as the curriculum is,
 * with reach, completion, time-on-item, and quiz average where a quiz is
 * attached. Unpublished items read unpublished rather than 0%, so
 * absence of data is never mistaken for failure."
 */

import { renderPercentage, shouldSuppress, SUPPRESSED_VALUE } from './analytics.metric-dictionary'

export interface ItemEngagementRow {
  readonly itemId: string
  readonly itemTitle: string
  readonly sectionLabel: string
  readonly itemKind: 'lesson' | 'quiz' | 'assignment'
  readonly visibility: 'published' | 'draft' | 'scheduled'
  readonly reach: number
  readonly completed: number
  readonly completionPct: string
  readonly avgTimeSeconds: number | null
  readonly quizAvgPct: string | null
  readonly n: number
}

export interface ItemEngagementInput {
  readonly itemId: string
  readonly itemTitle: string
  readonly sectionLabel: string
  readonly itemKind: 'lesson' | 'quiz' | 'assignment'
  readonly visibility: 'published' | 'draft' | 'scheduled'
  readonly reach: number
  readonly completed: number
  readonly avgTimeSeconds: number | null
  readonly quizAvgPct: number | null
  readonly quizN: number
}

/**
 * Build item-engagement rows from raw per-item data. Unpublished items
 * read "unpublished" rather than 0%. Below `MIN_SAMPLE_SIZE`, completion
 * and time render `—`.
 */
export function buildItemEngagementRows(
  items: readonly ItemEngagementInput[],
): ItemEngagementRow[] {
  return items.map((item) => {
    // Unpublished items: never 0%, always "unpublished".
    if (item.visibility !== 'published') {
      return {
        itemId: item.itemId,
        itemTitle: item.itemTitle,
        sectionLabel: item.sectionLabel,
        itemKind: item.itemKind,
        visibility: item.visibility,
        reach: 0,
        completed: 0,
        completionPct: 'unpublished',
        avgTimeSeconds: null,
        quizAvgPct: null,
        n: 0,
      }
    }

    const n = item.reach
    const completionPct = renderPercentage(item.completed, n)

    const avgTimeSeconds = shouldSuppress(n) ? null : item.avgTimeSeconds

    const quizAvgPct =
      item.itemKind === 'quiz' && item.quizAvgPct !== null
        ? shouldSuppress(item.quizN)
          ? SUPPRESSED_VALUE
          : `${Math.round(item.quizAvgPct)}%`
        : null

    return {
      itemId: item.itemId,
      itemTitle: item.itemTitle,
      sectionLabel: item.sectionLabel,
      itemKind: item.itemKind,
      visibility: item.visibility,
      reach: n,
      completed: item.completed,
      completionPct,
      avgTimeSeconds,
      quizAvgPct,
      n,
    }
  })
}

/**
 * Whether an item-engagement row should be flagged for an insight.
 * The spec: items with completion below the quiz-low-correct threshold
 * (50%) and enough `n` are candidates for actionable insights.
 */
export function isItemEngagementFlagged(row: ItemEngagementRow): boolean {
  if (row.visibility !== 'published') return false
  if (shouldSuppress(row.n)) return false
  // Parse the completion percentage to check the threshold.
  if (row.completionPct === SUPPRESSED_VALUE) return false
  const pct = parseInt(row.completionPct, 10)
  if (Number.isNaN(pct)) return false
  return pct < 50
}
