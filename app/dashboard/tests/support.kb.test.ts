import { describe, expect, test } from 'bun:test'
import {
  HELP_ARTICLES,
  moduleForPath,
  popularArticlesForModule,
  searchHelpArticles,
} from '#/features/support/support.kb'
import { supportTicketSchema } from '#/features/support/schemas/support.schema'

/** S-7.4 Help & Support knowledge base + ticket validation (spec 09). */

describe('searchHelpArticles', () => {
  test('matches titles and ranks title hits above keyword hits', () => {
    const results = searchHelpArticles('course')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]?.title.toLowerCase()).toContain('course')
  })

  test('matches keywords ("quiz")', () => {
    const results = searchHelpArticles('quiz')
    expect(results.some((article) => article.id === 'curriculum-lessons')).toBe(true)
  })

  test('is case-insensitive', () => {
    expect(searchHelpArticles('TOEFL').length).toBe(searchHelpArticles('toefl').length)
  })

  test('empty or whitespace queries return nothing', () => {
    expect(searchHelpArticles('')).toEqual([])
    expect(searchHelpArticles('   ')).toEqual([])
  })

  test('no match returns an empty list', () => {
    expect(searchHelpArticles('zzz-not-a-topic')).toEqual([])
  })
})

describe('popularArticlesForModule', () => {
  test('surfaces module articles first', () => {
    const popular = popularArticlesForModule('courses')
    expect(popular[0]?.module).toBe('courses')
    expect(popular.every((article) => article.module === 'courses')).toBe(true)
  })

  test('caps the popular list', () => {
    expect(popularArticlesForModule('students').length).toBeLessThanOrEqual(3)
  })

  test('falls back to general articles for modules without their own', () => {
    const popular = popularArticlesForModule('dashboard')
    expect(popular.some((article) => article.module === 'general')).toBe(true)
  })

  test('the knowledge base is read-only static content with bodies', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.body.length).toBeGreaterThan(40)
    }
  })
})

describe('moduleForPath', () => {
  test('maps route paths to help modules', () => {
    expect(moduleForPath('/courses/c1/lessons/l1')).toBe('courses')
    expect(moduleForPath('/settings/profile')).toBe('settings')
    expect(moduleForPath('/students')).toBe('students')
    expect(moduleForPath('/analytics/revenue')).toBe('analytics')
    expect(moduleForPath('/content-library/abc')).toBe('content-library')
    expect(moduleForPath('/')).toBe('dashboard')
  })

  test('unknown segments fall back to general', () => {
    expect(moduleForPath('/somewhere-else')).toBe('general')
  })
})

describe('supportTicketSchema', () => {
  test('accepts a valid ticket with the screen attached', () => {
    const parsed = supportTicketSchema.parse({
      category: 'bug',
      subject: 'Upload fails',
      message: 'Uploading a 40MB video fails at 90% with an error toast.',
      currentScreen: '/content-library',
    })
    expect(parsed.currentScreen).toBe('/content-library')
    expect(parsed.category).toBe('bug')
  })

  test('defaults the category to question', () => {
    const parsed = supportTicketSchema.parse({
      subject: 'How do cohorts work?',
      message: 'I could not find how to schedule a cohort start date.',
    })
    expect(parsed.category).toBe('question')
  })

  test('rejects short subjects and messages', () => {
    expect(
      supportTicketSchema.safeParse({ subject: 'ab', message: 'long enough message here' }).success,
    ).toBe(false)
    expect(
      supportTicketSchema.safeParse({ subject: 'Valid subject', message: 'short' }).success,
    ).toBe(false)
  })

  test('rejects unknown categories', () => {
    expect(
      supportTicketSchema.safeParse({
        category: 'urgent',
        subject: 'Valid subject',
        message: 'long enough message here',
      }).success,
    ).toBe(false)
  })
})
