import { describe, expect, test } from 'bun:test'
import {
  AUTHORING_HEALTH_VARIANTS,
  canPublish,
  countProseCharacters,
  deriveAuthoringHealth,
  evaluateAssignmentContent,
  evaluateLessonContent,
  evaluatePublishReadiness,
  evaluateQuizContent,
  firstBlockingCheck,
  passesContentFamily,
  READINESS_CHECK_IDS,
  READINESS_MIN_PROSE,
} from '#/features/courses/courses.readiness'
import type { ReadinessItem, ReadinessCourseSnapshot } from '#/features/courses/courses.readiness'

function item(overrides: Partial<ReadinessItem> = {}): ReadinessItem {
  return {
    publicId: 'les_1',
    title: 'What is TOEFL?',
    contentType: 'video',
    inPublishedSet: true,
    proseLength: 120,
    hasResolvableMedia: true,
    hasInvalidVideoUrl: false,
    missingCaptions: false,
    missingMediaAsset: false,
    questionCount: 0,
    questionsWithoutAnswer: 0,
    briefLength: 0,
    enabledSubmissionChannels: 0,
    reviewStatus: 'approved',
    isTranslationVariant: false,
    ...overrides,
  }
}

/** A course that already passes everything — the baseline each check breaks. */
function snapshot(overrides: Partial<ReadinessCourseSnapshot> = {}): ReadinessCourseSnapshot {
  return {
    title: 'TOEFL Complete Course',
    hasExamType: true,
    hasInstructor: true,
    hasThumbnail: true,
    description: 'x'.repeat(200),
    isFree: false,
    priceAmount: '1240',
    priceCurrency: 'ETB',
    enabledGatewayCount: 1,
    completionRuleConfigured: true,
    requiresApproval: false,
    sections: [{ itemCount: 1 }],
    // One published item is what makes `RC-3` pass; a baseline with no items
    // would fail it and every "this course can publish" assertion below with it.
    items: [validItem()],
    ...overrides,
  }
}

function validItem(overrides: Partial<ReadinessItem> = {}): ReadinessItem {
  return item({ ...overrides })
}

describe('prose measurement (RC-4a / RC-4c)', () => {
  test('Markdown punctuation does not count as prose', () => {
    // The invariant that matters: wrapping the same words in syntax never
    // changes the measured length. That is what "measured by parsing to a doc
    // and concatenating textContent" buys, and it is what stops a lesson full
    // of `#` and `**` from passing the `RC-4a` minimum.
    const plain = countProseCharacters('Skimming targets gist')
    expect(countProseCharacters('# **Skimming** targets gist')).toBe(plain)
    expect(countProseCharacters('[Skimming](https://x.test) targets gist')).toBe(plain)
    expect(countProseCharacters('- Skimming targets gist')).toBe(plain)
  })

  test('inline code is not prose a student reads as lesson text', () => {
    expect(countProseCharacters('Use `skim()` here')).toBeLessThan(
      countProseCharacters('Use skim here'),
    )
    expect(countProseCharacters('```\nlet x = 1\n```')).toBe(0)
  })

  test('whitespace collapsing keeps multi-paragraph prose stable', () => {
    expect(countProseCharacters('Skimming targets gist\n\nReading for detail')).toBe(
      countProseCharacters('  Skimming   targets gist   Reading for detail '),
    )
  })

  test('heading markers are stripped but the words are not', () => {
    // `## Skimming` is one heading and the word "Skimming" is prose.
    expect(countProseCharacters('## Skimming')).toBe(8)
  })

  test('counts the words a student actually reads', () => {
    expect(countProseCharacters('Skimming is reading for the general idea.')).toBe(41)
  })

  test('fenced code is not prose', () => {
    expect(countProseCharacters('```\nlet x = 1\n```')).toBe(0)
    expect(countProseCharacters('`inline code`')).toBe(0)
  })

  test('an empty or missing body is zero, not an error', () => {
    expect(countProseCharacters('')).toBe(0)
    expect(countProseCharacters(null)).toBe(0)
    expect(countProseCharacters(undefined)).toBe(0)
  })
})

describe('RC-4 is a family of three checks, one per kind', () => {
  test('is exactly RC-4a, RC-4b and RC-4c', () => {
    expect(READINESS_CHECK_IDS.filter((id) => id.startsWith('RC-4'))).toEqual([
      'RC-4a',
      'RC-4b',
      'RC-4c',
    ])
  })

  test('RC-4a passes a video-only lesson with a resolvable asset and no prose', () => {
    // The acceptance criterion Revision 3 was written for: a flat
    // "≥ 50 characters of prose" made a video-only lesson unpublishable.
    const check = evaluateLessonContent([
      item({ contentType: 'video', proseLength: 0, hasResolvableMedia: true }),
    ])
    expect(check.passed).toBe(true)
    expect(check.targets).toEqual([])
  })

  test('RC-4a fails a lesson with neither prose nor media', () => {
    const check = evaluateLessonContent([
      item({ publicId: 'les_a', contentType: 'video', proseLength: 40, hasResolvableMedia: false }),
      item({ publicId: 'les_b', contentType: 'pdf', proseLength: 200, hasResolvableMedia: false }),
    ])
    expect(check.passed).toBe(false)
    expect(check.targets).toEqual(['les_a'])
  })

  test('RC-4a ignores a prose-less lesson that is not in the published set', () => {
    const check = evaluateLessonContent([
      item({
        contentType: 'video',
        proseLength: 0,
        hasResolvableMedia: false,
        inPublishedSet: false,
      }),
    ])
    expect(check.passed).toBe(true)
  })

  test('RC-4b passes a quiz whose body is one sentence', () => {
    // "The item body is an optional short Markdown intro and is never the
    // reason a quiz fails readiness."
    const check = evaluateQuizContent([
      item({ contentType: 'quiz', proseLength: 12, questionCount: 3, questionsWithoutAnswer: 0 }),
    ])
    expect(check.passed).toBe(true)
  })

  test('RC-4b fails a quiz with no questions or with an unkeyed answer', () => {
    expect(evaluateQuizContent([item({ contentType: 'quiz', questionCount: 0 })]).passed).toBe(
      false,
    )
    expect(
      evaluateQuizContent([
        item({ contentType: 'quiz', questionCount: 2, questionsWithoutAnswer: 1 }),
      ]).passed,
    ).toBe(false)
  })

  test('RC-4c fails an assignment with a brief but no submission channel', () => {
    // "A brief alone is not enough, because a student with no way to submit
    // the work cannot complete it."
    const check = evaluateAssignmentContent([
      item({ contentType: 'exercise', briefLength: 400, enabledSubmissionChannels: 0 }),
    ])
    expect(check.passed).toBe(false)
    expect(check.targets).toEqual(['les_1'])
  })

  test('RC-4c passes an assignment with a brief and one channel', () => {
    const check = evaluateAssignmentContent([
      item({ contentType: 'exercise', briefLength: 400, enabledSubmissionChannels: 1 }),
    ])
    expect(check.passed).toBe(true)
  })

  test('the family passes only when all three pass', () => {
    const base = { items: [item({ contentType: 'quiz', questionCount: 3 })] }
    expect(passesContentFamily(evaluatePublishReadiness(snapshot(base)))).toBe(true)
    const withBadQuiz = {
      items: [item({ contentType: 'quiz', questionCount: 3, questionsWithoutAnswer: 1 })],
    }
    expect(passesContentFamily(evaluatePublishReadiness(snapshot(withBadQuiz)))).toBe(false)
  })

  test('a prose minimum below the threshold blocks', () => {
    const result = evaluatePublishReadiness(
      snapshot({
        items: [
          item({
            contentType: 'pdf',
            proseLength: READINESS_MIN_PROSE - 1,
            hasResolvableMedia: false,
          }),
        ],
      }),
    )
    const rc4a = result.checks.find((check) => check.id === 'RC-4a')
    expect(rc4a?.passed).toBe(false)
    // And exactly at the threshold it passes — the boundary is inclusive.
    const atBoundary = evaluatePublishReadiness(
      snapshot({
        items: [
          item({
            contentType: 'pdf',
            proseLength: READINESS_MIN_PROSE,
            hasResolvableMedia: false,
          }),
        ],
      }),
    )
    expect(atBoundary.checks.find((check) => check.id === 'RC-4a')?.passed).toBe(true)
  })
})

describe('the published set is the only thing evaluated', () => {
  test('RC-3 needs at least one item in the published set, not merely a section', () => {
    // A section with no items at all is the empty-course case.
    const noItems = evaluatePublishReadiness(snapshot({ items: [] }))
    expect(noItems.checks.find((check) => check.id === 'RC-3')?.passed).toBe(false)

    // A section whose only item is unpublished has no published set either.
    const unpublishedOnly = evaluatePublishReadiness(
      snapshot({ items: [item({ inPublishedSet: false })] }),
    )
    expect(unpublishedOnly.checks.find((check) => check.id === 'RC-3')?.passed).toBe(false)

    const published = evaluatePublishReadiness(
      snapshot({ items: [item({ inPublishedSet: true })] }),
    )
    expect(published.checks.find((check) => check.id === 'RC-3')?.passed).toBe(true)
  })

  test('an unpublished item is neither checked nor blocking', () => {
    const result = evaluatePublishReadiness(
      snapshot({
        // The course still has a published item, so only the *unpublished* one
        // is under test here and RC-3 is not what fails.
        items: [
          validItem(),
          item({ publicId: 'les_b', inPublishedSet: false, contentType: 'pdf', proseLength: 0 }),
        ],
      }),
    )
    // The family is evaluated only over the published set, so an unpublished
    // lesson with no content is neither checked nor blocking.
    const rc4a = result.checks.find((check) => check.id === 'RC-4a')
    expect(rc4a?.passed).toBe(true)
    expect(rc4a?.targets).toEqual([])
    expect(result.blockingFailures).toBe(0)
    // But the published set count excludes it: "It is a subset of the
    // curriculum, not a synonym for it."
    expect(result.publishedItemCount).toBe(1)
  })

  test('an unpublished item alone still fails RC-3', () => {
    // The published set is what RC-3 counts, so a course whose items are all
    // unpublished has nothing to publish and says so.
    const result = evaluatePublishReadiness(
      snapshot({ items: [item({ inPublishedSet: false, proseLength: 0 })] }),
    )
    expect(result.checks.find((check) => check.id === 'RC-3')?.passed).toBe(false)
    expect(result.blockingFailures).toBeGreaterThan(0)
  })
})

describe('RC-1, RC-2 and the advisory checks', () => {
  test('RC-1 needs a title, an exam, an instructor and a thumbnail', () => {
    const missingThumbnail = evaluatePublishReadiness(snapshot({ hasThumbnail: false }))
    expect(missingThumbnail.checks.find((check) => check.id === 'RC-1')?.passed).toBe(false)

    const shortTitle = evaluatePublishReadiness(snapshot({ title: 'ab' }))
    expect(shortTitle.checks.find((check) => check.id === 'RC-1')?.passed).toBe(false)

    const complete = evaluatePublishReadiness(snapshot())
    expect(complete.checks.find((check) => check.id === 'RC-1')?.passed).toBe(true)
  })

  test('RC-2 requires a 100–500 character description', () => {
    const tooShort = evaluatePublishReadiness(snapshot({ description: 'x'.repeat(50) }))
    expect(tooShort.checks.find((check) => check.id === 'RC-2')?.passed).toBe(false)
    const tooLong = evaluatePublishReadiness(snapshot({ description: 'x'.repeat(600) }))
    expect(tooLong.checks.find((check) => check.id === 'RC-2')?.passed).toBe(false)
    const absent = evaluatePublishReadiness(snapshot({ description: null }))
    expect(absent.checks.find((check) => check.id === 'RC-2')?.passed).toBe(false)
  })

  test('RC-7 is advisory — a red RC-7 must not stop a course shipping', () => {
    const result = evaluatePublishReadiness(snapshot({ completionRuleConfigured: false }))
    const rc7 = result.checks.find((check) => check.id === 'RC-7')
    expect(rc7?.passed).toBe(false)
    expect(rc7?.blocking).toBe(false)
    expect(result.blockingFailures).toBe(0)
    expect(canPublish(result)).toBe(true)
  })

  test('RC-8 only applies when the approval gate is on', () => {
    const ungated = evaluatePublishReadiness(
      snapshot({
        items: [item({ reviewStatus: 'draft' })],
        requiresApproval: false,
      }),
    )
    expect(ungated.checks.find((check) => check.id === 'RC-8')?.passed).toBe(true)

    const gated = evaluatePublishReadiness(
      snapshot({
        items: [item({ reviewStatus: 'draft' })],
        requiresApproval: true,
      }),
    )
    expect(gated.checks.find((check) => check.id === 'RC-8')?.passed).toBe(false)
    expect(gated.blockingFailures).toBe(1)
  })

  test('a translation variant is advisory and never blocks RC-8', () => {
    const result = evaluatePublishReadiness(
      snapshot({
        items: [item({ reviewStatus: 'draft', isTranslationVariant: true })],
        requiresApproval: true,
      }),
    )
    expect(result.checks.find((check) => check.id === 'RC-8')?.passed).toBe(true)
  })
})

describe('every count is reported from one place', () => {
  test('the failing-item count equals the RC-4a target count', () => {
    const result = evaluatePublishReadiness(
      snapshot({
        items: [
          item({
            publicId: 'les_a',
            contentType: 'video',
            proseLength: 0,
            hasResolvableMedia: false,
          }),
          item({
            publicId: 'les_b',
            contentType: 'pdf',
            proseLength: 0,
            hasResolvableMedia: false,
          }),
          item({ publicId: 'les_c', contentType: 'pdf', proseLength: 300 }),
        ],
      }),
    )
    // The catalog card, the Overview banner and the Course health card all read
    // this one number. Revision 2 quoted 3, 2 and 3 for the same course.
    expect(result.itemsNeedingContent).toBe(2)
    expect(result.failingByKind.lesson).toBe(2)
  })

  test('no blocking checks means the lifecycle CTA is available', () => {
    expect(canPublish(evaluatePublishReadiness(snapshot()))).toBe(true)
    const blocked = evaluatePublishReadiness(snapshot({ completionRuleConfigured: false }))
    // RC-7 red is advisory, so this still publishes.
    expect(canPublish(blocked)).toBe(true)
    const hardBlock = evaluatePublishReadiness(snapshot({ description: 'short' }))
    expect(canPublish(hardBlock)).toBe(false)
  })

  test('the first blocking check names the item to jump to', () => {
    const result = evaluatePublishReadiness(
      snapshot({ items: [validItem({ contentType: 'quiz', questionCount: 0 })] }),
    )
    const blocking = firstBlockingCheck(result)
    expect(blocking?.id).toBe('RC-4b')
    expect(blocking?.targets).toEqual(['les_1'])
  })
})

describe('S-2.1 authoring health', () => {
  const passing = evaluatePublishReadiness(snapshot())

  test('has the eight spec variants', () => {
    expect([...AUTHORING_HEALTH_VARIANTS]).toEqual([
      'not_started',
      'needs_content',
      'awaiting_review',
      'changes_requested',
      'ready_to_review',
      'ready_to_publish',
      'scheduled',
      'live',
    ])
  })

  test('not started when the course has no items at all', () => {
    const health = deriveAuthoringHealth(passing, {
      totalItemCount: 0,
      awaitingReviewCount: 0,
      changesRequestedCount: 0,
      scheduledPublishAt: null,
      publishedItemCount: 0,
    })
    expect(health.variant).toBe('not_started')
    // The line is a link straight to the screen that resolves it.
    expect(health.nextAction?.screen).toBe('curriculum')
  })

  test('a future schedule outranks every other signal', () => {
    const health = deriveAuthoringHealth(passing, {
      totalItemCount: 12,
      awaitingReviewCount: 3,
      changesRequestedCount: 2,
      scheduledPublishAt: new Date().toISOString(),
      publishedItemCount: 12,
    })
    expect(health.variant).toBe('scheduled')
  })

  test('the most useful next action wins in spec order', () => {
    const base = {
      totalItemCount: 12,
      awaitingReviewCount: 3,
      changesRequestedCount: 0,
      scheduledPublishAt: null,
      publishedItemCount: 12,
    }
    // Reviewer feedback outranks a missing-content warning because the author
    // has already been asked for something specific.
    expect(deriveAuthoringHealth(passing, { ...base, changesRequestedCount: 1 }).variant).toBe(
      'changes_requested',
    )
    expect(deriveAuthoringHealth(passing, base).variant).toBe('awaiting_review')

    const nothingPending = evaluatePublishReadiness(
      snapshot({ items: [validItem({ proseLength: 0, hasResolvableMedia: false })] }),
    )
    expect(
      deriveAuthoringHealth(nothingPending, {
        ...base,
        awaitingReviewCount: 0,
      }).variant,
    ).toBe('needs_content')
  })

  test('ready to publish only when every blocking check passes', () => {
    const health = deriveAuthoringHealth(passing, {
      totalItemCount: 4,
      awaitingReviewCount: 0,
      changesRequestedCount: 0,
      scheduledPublishAt: null,
      publishedItemCount: 4,
    })
    expect(health.variant).toBe('ready_to_publish')
    // A blocking failure left in place falls back to "review the checklist".
    const blocked = evaluatePublishReadiness(snapshot({ description: 'too short' }))
    expect(
      deriveAuthoringHealth(blocked, {
        totalItemCount: 4,
        awaitingReviewCount: 0,
        changesRequestedCount: 0,
        scheduledPublishAt: null,
        publishedItemCount: 4,
      }).variant,
    ).toBe('ready_to_review')
  })
})
