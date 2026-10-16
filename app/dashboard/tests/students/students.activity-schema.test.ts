import { describe, expect, test } from 'bun:test'
import { mergeActivityFeed } from '#/features/students/students.activity'
import {
  accountStatusFilterSchema,
  badgeTriggerInputSchema,
  createStudentSchema,
  directoryQuerySchema,
} from '#/features/students/schemas/students.schema'

describe('activity feed merge', () => {
  test('sorts descending by time and caps at 50', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: `r${i}`,
      kind: 'lesson_completed' as const,
      title: `Lesson ${i}`,
      at: new Date(Date.UTC(2026, 8, 1, 0, i)).toISOString(),
    }))
    const feed = mergeActivityFeed(rows)
    expect(feed).toHaveLength(50)
    expect(feed[0]?.title).toBe('Lesson 59')
    expect(feed[49]?.title).toBe('Lesson 10')
  })

  test('drops rows with invalid timestamps', () => {
    const feed = mergeActivityFeed([
      { id: 'a', kind: 'enrolled', title: 'OK', at: '2026-09-01T00:00:00.000Z' },
      { id: 'b', kind: 'enrolled', title: 'Bad', at: 'nope' },
    ])
    expect(feed.map((row) => row.id)).toEqual(['a'])
  })
})

describe('students schemas', () => {
  test('directory query coerces page and defaults missing filters', () => {
    const parsed = directoryQuerySchema.parse({ page: '3', course: 'all' })
    expect(parsed.page).toBe(3)
    expect(parsed.status).toBeUndefined()
  })

  test('create student normalizes email case', () => {
    const parsed = createStudentSchema.parse({ name: 'Alem', email: '  Alem@Example.COM ' })
    expect(parsed.email).toBe('alem@example.com')
  })

  test('create student rejects invalid email', () => {
    expect(() => createStudentSchema.parse({ name: 'A', email: 'not-an-email' })).toThrow()
  })

  test('account status filter only allows known statuses', () => {
    expect(accountStatusFilterSchema.safeParse('active').success).toBe(true)
    expect(accountStatusFilterSchema.safeParse('admin').success).toBe(false)
  })

  test('streak badge requires days, others forbid payload drift', () => {
    expect(badgeTriggerInputSchema.safeParse({ triggerKind: 'streak', days: 7 }).success).toBe(true)
    expect(badgeTriggerInputSchema.safeParse({ triggerKind: 'streak', days: 0 }).success).toBe(
      false,
    )
    expect(badgeTriggerInputSchema.safeParse({ triggerKind: 'first_lesson' }).success).toBe(true)
  })
})
