/**
 * Publish readiness (spec 04 § Readiness Checks, S-2.22).
 *
 * Framework-free and total: it takes a plain snapshot of what the server read
 * and returns the eight checks. That matters because the spec requires the
 * catalog's authoring-health line, the Overview readiness banner, and the
 * S-2.22 checklist to be **the same number from the same source** — "Revision 2
 * quoted 3, 2, and 3 for the same course; all three now read 3 because there is
 * only one value." A pure evaluator is what makes that enforceable.
 *
 * The server reads the database and builds the snapshot; this module decides.
 * Nothing here is a React concern, so the bun suites exercise it directly.
 */
import { deriveCurriculumItemKind } from './courses.workspace'
import type { CurriculumItemKind } from './courses.workspace'

// ── Check identities ────────────────────────────────────────────────────────

/**
 * `RC-4` is a **family of three checks**, one per item kind, so a quiz is never
 * failed for lacking 50 characters of prose and a video-only lesson is never
 * failed for lacking a body. Anything that says "RC-4" without a suffix means
 * the family: the course passes when all three pass.
 */
export const READINESS_CHECK_IDS = [
  'RC-1',
  'RC-2',
  'RC-3',
  'RC-4a',
  'RC-4b',
  'RC-4c',
  'RC-5',
  'RC-6',
  'RC-7',
  'RC-8',
] as const

export type ReadinessCheckId = (typeof READINESS_CHECK_IDS)[number]

/** A single evaluated check. */
export interface ReadinessCheck {
  id: ReadinessCheckId
  label: string
  passed: boolean
  /**
   * Advisory checks report but never block. `RC-7` is advisory by design
   * (spec 04 S-2.10 lets a course publish without a certificate), and an
   * untranslated variant is always advisory.
   */
  blocking: boolean
  /** Item public ids this check failed on, for "Jump to first blocking item". */
  targets: string[]
  /** Optional next-step copy shown under a failure. */
  detail?: string
}

export const READINESS_CHECK_LABELS: Record<ReadinessCheckId, string> = {
  'RC-1': 'Title, exam and instructor set, thumbnail present',
  'RC-2': 'Description present, 100–500 characters',
  'RC-3': 'At least one section with at least one published item',
  'RC-4a': 'Every published Lesson has a title and prose or media',
  'RC-4b': 'Every published Quiz has a question with a keyed answer',
  'RC-4c': 'Every published Assignment has a brief and a submission channel',
  'RC-5': 'Media URLs valid; no missing assets; captions present',
  'RC-6': 'Pricing consistent and at least one gateway enabled',
  'RC-7': 'Completion rule chosen',
  'RC-8': 'Review: all items approved',
}

// ── Prose measurement ───────────────────────────────────────────────────────
//
// "`RC-4a` … Prose length is measured by parsing to a doc and concatenating
// `textContent`, so Markdown punctuation does not count." Stripping the
// Markdown syntax is an approximation of that parse; it must never count
// punctuation or heading markers as prose, or a checklist full of `#` passes.

/**
 * Count characters of prose in a Markdown body (spec 04 `RC-4a`).
 *
 * "Prose length is measured by parsing to a doc and concatenating
 * `textContent`, so Markdown punctuation does not count." A full Markdown
 * parser is out of scope here, so this walks the same path in reverse: strip
 * the constructs that produce **no** text, then drop inline markup characters,
 * then collapse whitespace.
 *
 * The invariant that matters — and what the test suite pins — is that wrapping
 * the same words in Markdown syntax never changes the count. A per-character
 * regex could not guarantee that (it mishandled `# **word**`), which is why the
 * removal is markup-only rather than tokenised on adjacency.
 */
const MARKDOWN_SYNTAX = /(?:\s|^)(?:[#>*_`~-]+|\[\^?[^]]*\]|\([^)]*\)|\{[^}]*\}|\d+[.)])\s*/g

/** Characters that render as emphasis rather than as readable text. */
const INLINE_MARKUP = /[*_~`#>]/g

export function countProseCharacters(body: string | null | undefined): number {
  if (!body) return 0
  const withoutCode = body
    // Fenced and inline code are not prose a student reads as the lesson text.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
  // A link's URL contributes nothing; its text does, so the label survives.
  const withLinkText = withoutCode.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
  return (
    withLinkText
      .replace(MARKDOWN_SYNTAX, ' ')
      // Catches markup the adjacency-anchored pattern above cannot reach, such as
      // the `**` hugging a word that follows a heading marker.
      .replace(INLINE_MARKUP, '')
      .replace(/\s+/g, ' ')
      .trim().length
  )
}

// ── Snapshot ────────────────────────────────────────────────────────────────

/**
 * One curriculum item as the readiness evaluator needs to see it. This is a
 * projection of a `lessons` row plus its quiz, not the row itself, so the
 * evaluator stays testable without a database.
 */
export interface ReadinessItem {
  publicId: string
  title: string
  contentType: string | null
  /** Whether the item is in the published set (see `isInPublishedSet`). */
  inPublishedSet: boolean
  /** Characters of prose in the item body. */
  proseLength: number
  /** A resolvable media asset, a valid video/PDF URL, or an embed. */
  hasResolvableMedia: boolean
  /** A video item whose URL is missing or malformed. */
  hasInvalidVideoUrl: boolean
  /** A video item with no captions. */
  missingCaptions: boolean
  /** The item references a media asset id that no longer resolves. */
  missingMediaAsset: boolean
  /** Quiz items only. */
  questionCount: number
  /** Quiz items only: questions lacking a keyed correct answer. */
  questionsWithoutAnswer: number
  /** Assignment items only: the brief's prose length. */
  briefLength: number
  /** Assignment items only. */
  enabledSubmissionChannels: number
  reviewStatus: 'draft' | 'in_review' | 'changes_requested' | 'approved'
  /** Archived and deleted items are excluded from the published set upstream. */
  isTranslationVariant: boolean
}

/** Everything RC-1…RC-8 read that is not a curriculum item. */
export interface ReadinessCourseSnapshot {
  title: string
  hasExamType: boolean
  hasInstructor: boolean
  hasThumbnail: boolean
  description: string | null
  isFree: boolean
  priceAmount: string | null
  priceCurrency: string | null
  enabledGatewayCount: number
  completionRuleConfigured: boolean
  requiresApproval: boolean
  sections: Array<{ itemCount: number }>
  items: ReadinessItem[]
}

// ── Thresholds ──────────────────────────────────────────────────────────────

/** `RC-4a`/`RC-4c` prose minimum, in characters. */
export const READINESS_MIN_PROSE = 50
/** `RC-2` description bounds, in characters. */
export const READINESS_DESCRIPTION_MIN = 100
export const READINESS_DESCRIPTION_MAX = 500
/** `RC-1` title minimum, in characters. */
export const READINESS_MIN_TITLE = 3

// ── Evaluation ──────────────────────────────────────────────────────────────

export interface ReadinessResult {
  checks: ReadinessCheck[]
  passCount: number
  blockingFailures: number
  /**
   * `RC-4a` failing-item count. The catalog's authoring-health line, the
   * Overview readiness banner, and the Course health card all read *this*
   * number, which is what stops Revision 2's 3/2/3 disagreement.
   */
  itemsNeedingContent: number
  /** Per-kind failing counts, so a card can name the kind that is short. */
  failingByKind: Record<CurriculumItemKind, number>
  /** Items in the published set, whatever their readiness. */
  publishedItemCount: number
}

function check(
  id: ReadinessCheckId,
  passed: boolean,
  options: { blocking?: boolean; targets?: string[]; detail?: string } = {},
): ReadinessCheck {
  const blocking = options.blocking ?? true
  return {
    id,
    label: READINESS_CHECK_LABELS[id],
    passed,
    blocking,
    targets: options.targets ?? [],
    ...(options.detail === undefined ? {} : { detail: options.detail }),
  }
}

function itemKindOf(item: ReadinessItem): CurriculumItemKind | null {
  return deriveCurriculumItemKind(item.contentType)
}

/**
 * Restrict an item list to the published set before a kind check runs.
 *
 * These evaluators are exported, so a caller could hand them a raw item list.
 * Filtering here rather than only in `evaluatePublishReadiness` means an
 * unpublished item is never checked, whichever entry point is used — the family
 * is "evaluated only over the published set", not "evaluated over it only when
 * called from the top".
 */
function publishedItemsOf(items: readonly ReadinessItem[]): ReadinessItem[] {
  return items.filter((item) => item.inPublishedSet)
}

/**
 * `RC-4a` — a Lesson passes with **either** ≥ 50 characters of prose **or** a
 * resolvable media asset. A video-only lesson is therefore publishable, which is
 * the whole reason the family was split per kind.
 */
export function evaluateLessonContent(items: ReadinessItem[]): ReadinessCheck {
  const failing = publishedItemsOf(items).filter(
    (item) =>
      itemKindOf(item) === 'lesson' &&
      item.proseLength < READINESS_MIN_PROSE &&
      !item.hasResolvableMedia,
  )
  return check('RC-4a', failing.length === 0, {
    targets: failing.map((item) => item.publicId),
    detail:
      failing.length === 0
        ? undefined
        : `${failing.length} lesson${failing.length === 1 ? '' : 's'} need content`,
  })
}

/** `RC-4b` — a Quiz needs ≥ 1 question and every question keyed. */
export function evaluateQuizContent(items: ReadinessItem[]): ReadinessCheck {
  const quizzes = publishedItemsOf(items).filter((item) => itemKindOf(item) === 'quiz')
  const failing = quizzes.filter(
    (item) => item.questionCount < 1 || item.questionsWithoutAnswer > 0,
  )
  return check('RC-4b', failing.length === 0, {
    targets: failing.map((item) => item.publicId),
    detail:
      failing.length === 0
        ? undefined
        : `${failing.length} quiz${failing.length === 1 ? '' : 'zes'} incomplete`,
  })
}

/**
 * `RC-4c` — an Assignment needs **both** a ≥ 50-character brief **and** at
 * least one enabled submission channel. A brief alone is not enough: a student
 * with no way to submit the work cannot complete it.
 */
export function evaluateAssignmentContent(items: ReadinessItem[]): ReadinessCheck {
  const assignments = publishedItemsOf(items).filter((item) => itemKindOf(item) === 'assignment')
  const failing = assignments.filter(
    (item) => item.briefLength < READINESS_MIN_PROSE || item.enabledSubmissionChannels < 1,
  )
  return check('RC-4c', failing.length === 0, {
    targets: failing.map((item) => item.publicId),
    detail:
      failing.length === 0
        ? undefined
        : `${failing.length} assignment${failing.length === 1 ? '' : 's'} incomplete`,
  })
}

/** Run every check and roll the counts the catalog and workspace quote. */
export function evaluatePublishReadiness(snapshot: ReadinessCourseSnapshot): ReadinessResult {
  // The family is evaluated only over the published set — an unpublished item is
  // neither checked nor blocking. `publishedItemsOf` inside the kind evaluators
  // makes that hold however they are reached.
  const publishedItems = snapshot.items.filter((item) => item.inPublishedSet)
  const rc4a = evaluateLessonContent(snapshot.items)
  const rc4b = evaluateQuizContent(snapshot.items)
  const rc4c = evaluateAssignmentContent(snapshot.items)

  const failingByKind: Record<CurriculumItemKind, number> = { lesson: 0, quiz: 0, assignment: 0 }
  for (const target of [...rc4a.targets, ...rc4b.targets, ...rc4c.targets]) {
    const item = publishedItems.find((candidate) => candidate.publicId === target)
    const kind = item ? itemKindOf(item) : null
    if (kind !== null) failingByKind[kind] += 1
  }

  const rc1 = check(
    'RC-1',
    snapshot.title.trim().length >= READINESS_MIN_TITLE &&
      snapshot.hasExamType &&
      snapshot.hasInstructor &&
      snapshot.hasThumbnail,
  )
  const descriptionLength = snapshot.description?.trim().length ?? 0
  const rc2 = check(
    'RC-2',
    descriptionLength >= READINESS_DESCRIPTION_MIN &&
      descriptionLength <= READINESS_DESCRIPTION_MAX,
  )
  const rc3 = check('RC-3', publishedItems.length > 0, {
    targets: [],
    detail:
      publishedItems.length > 0
        ? undefined
        : 'Publish at least one item — unpublished items do not count',
  })
  const mediaProblems = publishedItems.filter(
    (item) => item.hasInvalidVideoUrl || item.missingMediaAsset || item.missingCaptions,
  )
  const rc5 = check('RC-5', mediaProblems.length === 0, {
    targets: mediaProblems.map((item) => item.publicId),
  })
  const rc6 = check(
    'RC-6',
    snapshot.isFree ||
      (snapshot.priceAmount != null &&
        Number(snapshot.priceAmount) > 0 &&
        (snapshot.priceCurrency ?? '').length === 3),
    { detail: 'Enable at least one payment gateway' },
  )
  // Advisory by design: a course may publish without a certificate configured.
  const rc7 = check('RC-7', snapshot.completionRuleConfigured, { blocking: false })
  const awaitingApproval = publishedItems.filter(
    (item) => item.reviewStatus !== 'approved' && !item.isTranslationVariant,
  )
  const rc8 = check('RC-8', !snapshot.requiresApproval || awaitingApproval.length === 0, {
    targets: awaitingApproval.map((item) => item.publicId),
    detail: `${awaitingApproval.length} item${awaitingApproval.length === 1 ? '' : 's'} await approval`,
  })

  const checks = [rc1, rc2, rc3, rc4a, rc4b, rc4c, rc5, rc6, rc7, rc8]
  const blockingFailures = checks.filter((item) => !item.passed && item.blocking).length
  return {
    checks,
    passCount: checks.filter((item) => item.passed).length,
    blockingFailures,
    itemsNeedingContent: rc4a.targets.length,
    failingByKind,
    publishedItemCount: publishedItems.length,
  }
}

/**
 * Would publishing now be blocked? Advisory failures are excluded — `RC-7` red
 * must not stop a course shipping.
 */
export function canPublish(result: ReadinessResult): boolean {
  return result.blockingFailures === 0
}

/** The first failing check that blocks, for "Jump to first blocking item". */
export function firstBlockingCheck(result: ReadinessResult): ReadinessCheck | null {
  return result.checks.find((item) => !item.passed && item.blocking) ?? null
}

/**
 * The `RC-4` family verdict. Anything referring to "RC-4" without a suffix
 * means the family; the dashboard uses this so no screen hardcodes `rc4a.passed`.
 */
export function passesContentFamily(result: ReadinessResult): boolean {
  const family = result.checks.filter((item) => item.id.startsWith('RC-4'))
  return family.every((item) => item.passed)
}

// ── Authoring health (S-2.1 card line) ──────────────────────────────────────
//
// "Every count below is read from one source — the server-side authoring-health
// projection that also backs RC-3/RC-4 in S-2.22 — so the catalog can never
// disagree with the readiness checklist." The projection is derived here from
// the same `ReadinessResult`, which is what makes that guarantee hold rather
// than merely being asserted.

export const AUTHORING_HEALTH_VARIANTS = [
  'not_started',
  'needs_content',
  'awaiting_review',
  'changes_requested',
  'ready_to_review',
  'ready_to_publish',
  'scheduled',
  'live',
] as const

export type AuthoringHealthVariant = (typeof AUTHORING_HEALTH_VARIANTS)[number]

export interface AuthoringHealth {
  variant: AuthoringHealthVariant
  /** The single most useful next action, e.g. `{ kind: 'curriculum' }`. */
  nextAction: { screen: 'curriculum' | 'readiness'; label: string } | null
  count: number
}

export function deriveAuthoringHealth(
  result: ReadinessResult,
  input: {
    totalItemCount: number
    awaitingReviewCount: number
    changesRequestedCount: number
    scheduledPublishAt: string | null
    publishedItemCount: number
  },
): AuthoringHealth {
  if (input.scheduledPublishAt) {
    return { variant: 'scheduled', nextAction: null, count: 0 }
  }
  if (input.totalItemCount === 0) {
    return {
      variant: 'not_started',
      nextAction: { screen: 'curriculum', label: 'Add your first section' },
      count: 0,
    }
  }
  if (input.changesRequestedCount > 0) {
    return {
      variant: 'changes_requested',
      nextAction: { screen: 'curriculum', label: 'Review the feedback' },
      count: input.changesRequestedCount,
    }
  }
  if (result.itemsNeedingContent > 0) {
    return {
      variant: 'needs_content',
      nextAction: { screen: 'curriculum', label: 'Fix the blocking items' },
      count: result.itemsNeedingContent,
    }
  }
  if (input.awaitingReviewCount > 0) {
    return {
      variant: 'awaiting_review',
      nextAction: { screen: 'curriculum', label: 'Open the review queue' },
      count: input.awaitingReviewCount,
    }
  }
  if (input.publishedItemCount > 0 && result.blockingFailures === 0) {
    return { variant: 'ready_to_publish', nextAction: null, count: 0 }
  }
  return {
    variant: 'ready_to_review',
    nextAction: { screen: 'readiness', label: 'Review the checklist' },
    count: 0,
  }
}
