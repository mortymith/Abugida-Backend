import { describe, expect, test } from 'bun:test'
import {
  MERGE_TAGS,
  extractMergeTags,
  hasUnresolvedTags,
  renderMergeTags,
  suggestMergeTag,
  validateMergeTags,
} from '#/features/marketing/marketing.merge-tags'

/**
 * S-8.2 merge tags (spec 10): tag extraction, unknown-tag detection with
 * suggestions, and preview rendering with sample data.
 */
describe('merge tags', () => {
  test('exposes the spec tag set', () => {
    expect(MERGE_TAGS).toContain('first_name')
    expect(MERGE_TAGS).toContain('course_name')
    expect(MERGE_TAGS).toContain('start_date')
    expect(MERGE_TAGS).toContain('progress_url')
    expect(MERGE_TAGS).toContain('unsubscribe_url')
  })

  test('extracts tags across subject and body', () => {
    const tags = extractMergeTags([
      '{{course_name}} starts {{start_date}}',
      'Hi {{first_name}}, your {{ course_name }} seat is saved.',
    ])
    expect(tags).toContain('course_name')
    expect(tags).toContain('start_date')
    expect(tags).toContain('first_name')
    expect(tags).toHaveLength(3)
  })

  test('flags unknown tags with suggestions', () => {
    const issues = validateMergeTags(['Hello {{fist_name}}, {{unknown_tag}}!'])
    const tags = issues.map((issue) => issue.tag)
    expect(tags).toContain('fist_name')
    expect(tags).toContain('unknown_tag')
    // Close misspelling suggests the real tag.
    const fist = issues.find((issue) => issue.tag === 'fist_name')
    expect(fist?.suggestions).toContain('first_name')
  })

  test('accepts known tags without issues', () => {
    expect(validateMergeTags(['Hi {{first_name}}, {{course_name}} awaits'])).toHaveLength(0)
  })

  test('suggests near matches within edit distance', () => {
    expect(suggestMergeTag('first_nam')).toContain('first_name')
    expect(suggestMergeTag('zzzzzzz')).toHaveLength(0)
  })

  test('renders tags with sample data', () => {
    const out = renderMergeTags('Hi {{first_name}}, {{course_name}} starts {{start_date}}.', {
      first_name: 'Alemayehu',
      course_name: 'TOEFL Complete',
      start_date: 'March 2',
    })
    expect(out).toBe('Hi Alemayehu, TOEFL Complete starts March 2.')
  })

  test('keeps unsubscribe_url even without data (footer is mandatory)', () => {
    expect(renderMergeTags('Unsubscribe: {{unsubscribe_url}}', {})).not.toContain('{{')
  })

  test('leaves unknown tags visible so editors can spot them', () => {
    const out = renderMergeTags('Hi {{not_a_tag}}', { first_name: 'A' })
    expect(out).toContain('{{not_a_tag}}')
  })

  test('detects unresolved tags', () => {
    expect(hasUnresolvedTags('Hi {{first_name}}')).toBe(true)
    expect(hasUnresolvedTags('Hi Alemayehu')).toBe(false)
  })
})
