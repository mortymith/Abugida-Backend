/**
 * S-5.1 Actionable insights logic (spec 07 § S-5.1 — Actionable Insight).
 *
 * The spec: "a row under the weakest items names the item, the metric,
 * the sample size, and the window, and offers Edit item and Preview as
 * student. An insight displays `n` whenever it is displayed at all;
 * below `MIN_INSIGHT_N = 5` it is not rendered rather than rendered
 * without its sample size. An insight never fires on data older than the
 * selected window."
 */

import { shouldRenderInsight } from './analytics.metric-dictionary'
import type { ItemEngagementRow } from './analytics.item-engagement'
import { isItemEngagementFlagged } from './analytics.item-engagement'

export type InsightMetric = 'item_completion' | 'drop_off' | 'quiz_miss_rate'

export type InsightAction = 'edit_item' | 'preview_as_student' | 'append_distractor'

export interface AnalyticsInsight {
  readonly itemId: string
  readonly itemTitle: string
  readonly metric: InsightMetric
  readonly value: string
  readonly n: number
  readonly window: string
  readonly actions: readonly InsightAction[]
  readonly explanation: string
}

export interface InsightInput {
  readonly itemId: string
  readonly itemTitle: string
  readonly metric: InsightMetric
  readonly value: string
  readonly n: number
  readonly window: string
  readonly explanation: string
}

/**
 * Build actionable insights from flagged item-engagement rows. An insight
 * is rendered only when `n >= MIN_INSIGHT_N` (spec: "below
 * `MIN_INSIGHT_N = 5` it is not rendered").
 *
 * The actions depend on the metric:
 * - `item_completion` → Edit item, Preview as student
 * - `drop_off` → Edit item, Preview as student
 * - `quiz_miss_rate` → Edit item, Preview as student, Append a distractor
 */
export function buildInsights(
  rows: readonly ItemEngagementRow[],
  window: string,
  extraInputs: readonly InsightInput[] = [],
): AnalyticsInsight[] {
  const insights: AnalyticsInsight[] = []

  // From item-engagement rows: flag low-completion items.
  for (const row of rows) {
    if (!isItemEngagementFlagged(row)) continue
    if (!shouldRenderInsight(row.n)) continue

    insights.push({
      itemId: row.itemId,
      itemTitle: row.itemTitle,
      metric: 'item_completion',
      value: row.completionPct,
      n: row.n,
      window,
      actions: ['edit_item', 'preview_as_student'],
      explanation: `${row.itemTitle} — item completion ${row.completionPct}, n=${row.n}, ${window}.`,
    })
  }

  // From extra inputs (drop-off, quiz miss rate).
  for (const input of extraInputs) {
    if (!shouldRenderInsight(input.n)) continue

    const actions: InsightAction[] = ['edit_item', 'preview_as_student']
    if (input.metric === 'quiz_miss_rate') {
      actions.push('append_distractor')
    }

    insights.push({
      itemId: input.itemId,
      itemTitle: input.itemTitle,
      metric: input.metric,
      value: input.value,
      n: input.n,
      window,
      actions,
      explanation: input.explanation,
    })
  }

  return insights
}

/**
 * Whether an insight should be rendered for a given `n`. The spec:
 * "An insight displays `n` whenever it is displayed at all."
 */
export function shouldShowInsight(n: number): boolean {
  return shouldRenderInsight(n)
}

/**
 * The insight action labels for the UI.
 */
export const INSIGHT_ACTION_LABELS: Record<InsightAction, string> = {
  edit_item: 'Edit item',
  preview_as_student: 'Preview as student',
  append_distractor: 'Append a distractor',
}
