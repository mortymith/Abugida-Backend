import { describe, expect, test } from 'bun:test'
import { renderTemplateDocument } from '#/features/marketing/marketing.email-render'

const SAMPLE = {
  first_name: 'Alemayehu',
  course_name: 'TOEFL Complete',
  start_date: 'March 2',
  progress_url: 'https://abugida.app/dashboard',
  unsubscribe_url: 'https://abugida.app/unsubscribe?email=x',
}

/**
 * S-8.2 template rendering (spec 10): blocks render in order, the
 * unsubscribe footer is always present, and unresolved tags stay visible so
 * broken templates never ship silently.
 */
describe('email rendering', () => {
  test('renders blocks in order with merged data', () => {
    const { html } = renderTemplateDocument(
      {
        blocks: [
          { type: 'hero', heading: '{{course_name}} is starting' },
          { type: 'text', body: 'Hi {{first_name}}, save your seat.' },
          { type: 'button', label: 'View syllabus', url: '{{progress_url}}' },
        ],
      },
      SAMPLE,
    )

    expect(html).toContain('TOEFL Complete is starting')
    expect(html).toContain('Hi Alemayehu')
    expect(html).toContain('View syllabus')
    expect(html).toContain('https://abugida.app/dashboard')
  })

  test('always renders the unsubscribe footer', () => {
    const { html } = renderTemplateDocument({ blocks: [] }, SAMPLE)
    expect(html).toContain('Unsubscribe')
    expect(html).toContain('unsubscribe?email=x')
  })

  test('escapes HTML in user-authored text', () => {
    const { html } = renderTemplateDocument(
      { blocks: [{ type: 'text', body: '<script>alert(1)</script>' }] },
      SAMPLE,
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  test('reports unresolved tags instead of hiding them', () => {
    const { hasUnresolvedTags } = renderTemplateDocument(
      { blocks: [{ type: 'text', body: 'Hi {{fist_name}}' }] },
      SAMPLE,
    )
    expect(hasUnresolvedTags).toBe(true)
  })

  test('renders an empty document without a template', () => {
    const { html } = renderTemplateDocument(null, SAMPLE)
    expect(html).toContain('Unsubscribe')
  })

  test('renders a course card placeholder without a course binding', () => {
    const { html } = renderTemplateDocument(
      { blocks: [{ type: 'course_card' }] },
      {
        first_name: 'Alemayehu',
        progress_url: SAMPLE.progress_url,
        unsubscribe_url: SAMPLE.unsubscribe_url,
      },
    )
    expect(html).toContain('Your course')
  })
})
