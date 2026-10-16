/**
 * Learner Preview logic (spec 04 § S-2.21 → Learner Preview).
 *
 * The Learner Preview is an in-app preview of the course as a student
 * would see it, without a deployed student app. It replaces the retired
 * `COURSE_PREVIEW_URL` external-preview mechanism (which could not show
 * draft content at all).
 *
 * The preview supports five identities:
 *
 * 1. **New student** — no progress, no completions, sees the course as a
 *    brand-new enrollee.
 * 2. **Existing student N** — picks a real enrolled student and renders
 *    their progress, completions, and current position.
 * 3. **Reviewer** — annotation mode: can click any element to leave a
 *    comment attached to the review submission.
 * 4. **Locked-only** — renders only items locked by prerequisite rules,
 *    to verify the lock UX.
 * 5. **Completed-only** — renders the course as a student who has
 *    completed every item, to verify the completion / certificate UX.
 *
 * Draft items show a watermark; scheduled items show a badge with the
 * scheduled date. The preview frame supports three device widths
 * (desktop / tablet / mobile) and a signed expiring preview link.
 *
 * This module is framework-free: it owns the identity resolution, the
 * visibility filter, and the device-width vocabulary. The React component
 * (`LearnerPreviewFrame`) is a consumer.
 */

import type { ItemVisibility } from './courses.workspace'

export const PREVIEW_IDENTITIES = [
  'new_student',
  'existing_student',
  'reviewer',
  'locked_only',
  'completed_only',
] as const

export type PreviewIdentity = (typeof PREVIEW_IDENTITIES)[number]

export const PREVIEW_IDENTITY_LABELS: Record<PreviewIdentity, string> = {
  new_student: 'New student',
  existing_student: 'Existing student',
  reviewer: 'Reviewer (annotation mode)',
  locked_only: 'Locked-only',
  completed_only: 'Completed-only',
}

export const PREVIEW_DEVICE_WIDTHS = [
  { id: 'desktop', label: 'Desktop', width: 1280 },
  { id: 'tablet', label: 'Tablet', width: 768 },
  { id: 'mobile', label: 'Mobile', width: 375 },
] as const

export type PreviewDeviceId = (typeof PREVIEW_DEVICE_WIDTHS)[number]['id']

export interface PreviewItem {
  readonly itemId: string
  readonly title: string
  readonly visibility: ItemVisibility
  readonly scheduledPublishAt: string | null
  readonly isLocked: boolean
  readonly isCompleted: boolean
}

export interface PreviewContext {
  readonly identity: PreviewIdentity
  readonly items: readonly PreviewItem[]
  readonly existingStudentId: string | null
  readonly draftWatermark: boolean
}

/**
 * Resolve which items are visible in the preview for the given identity.
 *
 * The visibility rules (from spec 04 § S-2.21):
 *
 * - **New student / Existing student:** sees `published` items only. Draft
 *   and scheduled items are hidden (a real student would not see them).
 * - **Reviewer:** sees all items, with a draft watermark on `draft` items
 *   and a scheduled badge on `scheduled` items. Annotation mode is active.
 * - **Locked-only:** sees `published` items that are locked by
 *   prerequisite rules. Unlocked and draft items are hidden.
 * - **Completed-only:** sees `published` items, all marked completed (to
 *   verify the completion / certificate UX).
 *
 * The `draftWatermark` flag on the context controls whether the frame
 * renders the "Draft" watermark on draft items — true only for the
 * reviewer identity.
 */
export function resolvePreviewItems(context: PreviewContext): readonly PreviewItem[] {
  switch (context.identity) {
    case 'new_student':
    case 'existing_student':
      return context.items.filter((item) => item.visibility === 'published')
    case 'reviewer':
      return context.items // all items, watermark handled by frame
    case 'locked_only':
      return context.items.filter((item) => item.visibility === 'published' && item.isLocked)
    case 'completed_only':
      return context.items.filter((item) => item.visibility === 'published')
    default:
      return []
  }
}

/**
 * Whether the draft watermark should render on `item` for `identity`.
 * Only the reviewer sees draft items, and the watermark makes clear which
 * items are not yet published.
 */
export function shouldShowDraftWatermark(identity: PreviewIdentity, item: PreviewItem): boolean {
  return identity === 'reviewer' && item.visibility === 'draft'
}

/**
 * Whether the scheduled badge should render on `item`.
 * The badge shows the scheduled publish date. Visible to reviewer and
 * (for items whose scheduled date has passed) to no one — a scheduled item
 * past its date is published by the background worker.
 */
export function shouldShowScheduledBadge(identity: PreviewIdentity, item: PreviewItem): boolean {
  if (item.visibility !== 'scheduled') return false
  if (!item.scheduledPublishAt) return false
  return identity === 'reviewer'
}

/**
 * Whether the "Fix this in the editor" jump should render on `item`.
 * The spec mandates: a reviewer who spots an issue can jump straight to
 * the editor for that item. Available to reviewer identity only.
 */
export function canJumpToEditor(identity: PreviewIdentity): boolean {
  return identity === 'reviewer'
}

/**
 * Whether annotation mode is active. Reviewer identity can click any
 * element to leave a comment attached to the review submission.
 */
export function isAnnotationMode(identity: PreviewIdentity): boolean {
  return identity === 'reviewer'
}

// ── Signed preview link ────────────────────────────────────────────────────
//
// The spec mandates signed expiring preview links. The link encodes the
// course ID, the identity, and an expiry timestamp, signed with a
// workspace secret. This module owns the URL shape; the server function
// owns the signing.

export interface PreviewLinkPayload {
  readonly courseId: string
  readonly identity: PreviewIdentity
  readonly existingStudentId: string | null
  readonly expiresAt: number // epoch ms
}

export function buildPreviewLinkQuery(payload: PreviewLinkPayload): URLSearchParams {
  const params = new URLSearchParams()
  params.set('preview', '1')
  params.set('course', payload.courseId)
  params.set('identity', payload.identity)
  if (payload.existingStudentId) {
    params.set('student', payload.existingStudentId)
  }
  params.set('expires', String(payload.expiresAt))
  return params
}

export function parsePreviewLinkQuery(params: URLSearchParams): PreviewLinkPayload | null {
  const preview = params.get('preview')
  if (preview !== '1') return null
  const courseId = params.get('course')
  const identityParam = params.get('identity')
  const expiresParam = params.get('expires')
  if (!courseId || !identityParam || !expiresParam) return null

  if (!PREVIEW_IDENTITIES.includes(identityParam as PreviewIdentity)) return null
  const identity = identityParam as PreviewIdentity
  const expiresAt = Number(expiresParam)
  if (!Number.isFinite(expiresAt)) return null

  const existingStudentId = params.get('student')
  return { courseId, identity, existingStudentId, expiresAt }
}

export function isPreviewLinkExpired(payload: PreviewLinkPayload, now: number): boolean {
  return now >= payload.expiresAt
}
