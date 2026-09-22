/**
 * S-7.7 Duplicate Lesson Modal — pure decision helpers (spec 09).
 *
 * Extracted from the component so the naming, positioning, and payload
 * rules are unit-testable without a DOM. The modal owns fetching and
 * mutations; these functions own the rules:
 *  - name conflicts resolve to "<title> (copy)" (and "<title> (copy) 2",
 *    … when that is also taken) shown before confirming;
 *  - position is "end of module" (default) or "after <lesson>" via a
 *    reorder of the created lesson;
 *  - unlock rules are never copied; quiz copies are unlinked.
 */

export interface DuplicateIncludeFlags {
  content: boolean
  quiz: boolean
}

/** The duplicate starts in Draft; the review flow cannot be bypassed. */
export const DUPLICATE_STARTS_DRAFT_NOTE =
  'The copy starts in Draft and follows the normal review flow. Unlock rules are never copied.'

export function duplicateLessonTitle(
  sourceTitle: string,
  existingTitles: readonly string[] = [],
): string {
  const base = sourceTitle.toLowerCase().endsWith('(copy)')
    ? sourceTitle.trim()
    : `${sourceTitle.trim()} (copy)`
  if (!existingTitles.includes(base)) return base
  let n = 2
  while (existingTitles.includes(`${base} ${n}`)) n += 1
  return `${base} ${n}`
}

export type DuplicatePositionMode = 'end' | 'after'

/**
 * Order of lesson publicIds inside the target module after a duplicate.
 * `createdLessonId` is the freshly created (currently last) lesson;
 * `afterLessonId` is an existing lesson in the same module.
 */
export function resolveDuplicateOrder(
  currentOrder: readonly string[],
  createdLessonId: string,
  mode: DuplicatePositionMode,
  afterLessonId: string | null,
): string[] {
  const withoutCreated = currentOrder.filter((id) => id !== createdLessonId)
  if (mode === 'end' || !afterLessonId || afterLessonId === createdLessonId) {
    return [...withoutCreated, createdLessonId]
  }
  if (!withoutCreated.includes(afterLessonId)) return [...withoutCreated, createdLessonId]
  const index = withoutCreated.indexOf(afterLessonId)
  return [
    ...withoutCreated.slice(0, index + 1),
    createdLessonId,
    ...withoutCreated.slice(index + 1),
  ]
}

/** Media references stay shared: copy the asset link, never re-upload. */
export function buildContentPayload(
  flags: DuplicateIncludeFlags,
  source: {
    body: string | null
    contentType: 'pdf' | 'video' | 'quiz' | 'exercise' | 'link'
    videoUrl: string | null
    durationMinutes: number | null
    assetId: string | null
    tags: readonly string[]
  } | null,
): {
  body: string | null
  contentType: 'pdf' | 'video' | 'quiz' | 'exercise' | 'link'
  videoUrl: string | null
  durationMinutes: number | null
  assetId: string | null
  tags: string[]
} | null {
  if (!flags.content || !source) return null
  return {
    body: source.body,
    contentType: source.contentType,
    videoUrl: source.videoUrl,
    durationMinutes: source.durationMinutes,
    assetId: source.assetId,
    tags: [...source.tags],
  }
}
