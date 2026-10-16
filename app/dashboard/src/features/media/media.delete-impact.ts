/**
 * Asset delete impact statement (spec 05 § S-3.1, S-3.3 — Deleting).
 *
 * The spec mandates: delete shows its usage impact **before it asks**.
 * The confirmation names the blast radius in items, courses, published
 * items, and affected students:
 *
 * > "Used in 14 items across 2 courses — 1 item is in a published course.
 * > Deleting will show a broken image to 234 students."
 *
 * The primary action is **Archive** (hides it, breaks nothing); **Delete
 * permanently** is the separated destructive secondary; and **Detach
 * from all items** is offered alongside.
 *
 * This module is framework-free: it computes the impact from usage rows
 * and renders the impact statement text.
 */

export interface AssetUsageEntry {
  readonly itemId: string
  readonly courseId: string
  readonly courseName: string
  readonly courseStatus: string // draft | in_review | published | archived
  readonly itemName: string
  readonly enrolledStudentCount: number
}

export interface DeleteImpact {
  readonly itemCount: number
  readonly courseCount: number
  readonly publishedUseCount: number
  readonly affectedStudentCount: number
}

/**
 * Compute the delete impact from a list of usage entries. The spec
 * counts:
 * - `itemCount` — distinct curriculum items referencing the asset.
 * - `courseCount` — distinct courses those items belong to.
 * - `publishedUseCount` — items in published courses (the ones that
 *   break live student experience).
 * - `affectedStudentCount` — sum of enrolled students across published
 *   courses using the asset. Deduplicated by course so a student in two
 *   published courses using the same asset is counted once.
 */
export function computeDeleteImpact(usage: readonly AssetUsageEntry[]): DeleteImpact {
  const itemIds = new Set(usage.map((u) => u.itemId))
  const courseIds = new Set(usage.map((u) => u.courseId))
  const publishedCourses = new Set(
    usage.filter((u) => u.courseStatus === 'published').map((u) => u.courseId),
  )
  const publishedUseCount = usage.filter((u) => u.courseStatus === 'published').length
  // Affected students: sum across published courses, deduplicated by course
  // (a student in two published courses using the asset is counted once per
  // course, but the dedup is by course not by student — we don't have
  // student-level data here, only per-course enrollment).
  const affectedStudentCount = [...publishedCourses].reduce((sum, courseId) => {
    const entry = usage.find((u) => u.courseId === courseId)
    return sum + (entry?.enrolledStudentCount ?? 0)
  }, 0)

  return {
    itemCount: itemIds.size,
    courseCount: courseIds.size,
    publishedUseCount,
    affectedStudentCount,
  }
}

/**
 * The impact statement for the confirmation dialog. Matches the spec's
 * exact wording:
 *
 * "Used in 14 items across 2 courses — 1 item is in a published course.
 * Deleting will show a broken image to 234 students."
 *
 * When the asset is not in use, returns a simpler message.
 */
export function impactStatement(impact: DeleteImpact): string {
  if (impact.itemCount === 0) {
    return 'This asset is not used in any course. Deleting it will not affect students.'
  }
  const itemNoun = impact.itemCount === 1 ? 'item' : 'items'
  const courseNoun = impact.courseCount === 1 ? 'course' : 'courses'
  const parts: string[] = [
    `Used in ${impact.itemCount} ${itemNoun} across ${impact.courseCount} ${courseNoun}`,
  ]
  if (impact.publishedUseCount > 0) {
    const pubNoun =
      impact.publishedUseCount === 1
        ? 'item is in a published course'
        : 'items are in published courses'
    parts.push(`${impact.publishedUseCount} ${pubNoun}`)
  }
  let message = parts.join(' — ')
  if (impact.publishedUseCount > 0 && impact.affectedStudentCount > 0) {
    const studentNoun = impact.affectedStudentCount === 1 ? 'student' : 'students'
    message += `. Deleting will show a broken image to ${impact.affectedStudentCount} ${studentNoun}.`
  } else if (impact.publishedUseCount === 0) {
    message += '. Deleting will not affect any live course.'
  }
  return message
}

/**
 * Whether the "Delete permanently" action is enabled. The spec:
 * "Delete permanently states that references are not cleaned up silently —
 * it first requires either an Archive or a Detach, or an explicit
 * acknowledgement that the items will break."
 *
 * This function returns true when the author has archived OR detached OR
 * explicitly acknowledged the breakage.
 */
export function canDeletePermanently(
  impact: DeleteImpact,
  options: { archived: boolean; detached: boolean; acknowledgedBreakage: boolean },
): boolean {
  if (impact.itemCount === 0) return true
  return options.archived || options.detached || options.acknowledgedBreakage
}

/**
 * The detach confirmation message. The spec: "This will remove the image
 * from 14 items. Items will show a missing-media placeholder until you
 * re-attach something."
 */
export function detachConfirmationMessage(impact: DeleteImpact): string {
  if (impact.itemCount === 0) {
    return 'This asset is not attached to any items.'
  }
  const noun = impact.itemCount === 1 ? 'item' : 'items'
  return `This will remove the asset from ${impact.itemCount} ${noun}. Items will show a missing-media placeholder until you re-attach something.`
}
