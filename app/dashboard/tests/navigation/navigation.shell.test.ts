import { describe, expect, test } from 'bun:test'
import {
  NAV_GROUPS,
  NAV_ITEMS,
  getVisibleNavGroups,
  getVisibleNavItems,
} from '#/features/navigation/navigation.config'
import { readSidebarOpen } from '#/features/navigation/navigation.sidebar-preference'
import {
  buildDocumentTitle,
  composeAnnouncement,
} from '#/features/navigation/navigation.page-title'
import type { PlatformRole } from '#/features/auth'

/**
 * The navigation's shell contracts: rail grouping, the persisted collapse
 * preference, and how a route is worded out loud and in the tab strip.
 *
 * All pure, so they run without a router, a browser or a DOM.
 */

const ROLES: PlatformRole[] = ['admin', 'editor', 'reviewer', 'viewer', 'support']

describe('Nav grouping (presentational only)', () => {
  test('grouping never changes which items a role can see', () => {
    for (const role of ROLES) {
      const flat = getVisibleNavItems(role).map((item) => item.id)
      const grouped = getVisibleNavGroups(role).flatMap((group) =>
        group.items.map((item) => item.id),
      )
      expect(grouped).toEqual(flat)
    }
  })

  test('grouping preserves the visual order of NAV_ITEMS', () => {
    for (const role of ROLES) {
      const order = NAV_ITEMS.map((item) => item.id)
      const grouped = getVisibleNavGroups(role).flatMap((group) =>
        group.items.map((item) => item.id),
      )
      expect(grouped).toEqual(order.filter((id) => grouped.includes(id)))
    }
  })

  test('every item appears in exactly one group — none is silently dropped', () => {
    const ids = NAV_GROUPS.flatMap((group) => group.itemIds)
    expect(new Set(ids).size).toBe(ids.length)
    expect([...ids].sort()).toEqual(NAV_ITEMS.map((item) => item.id).sort())
  })

  test('a group with nothing visible to the role is dropped, not left as a bare label', () => {
    // Support has no Review item and no Settings item: neither group may end up
    // showing a heading whose contents the role cannot open.
    const groups = getVisibleNavGroups('support')
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0)
    }
    expect(groups.some((group) => group.label === '')).toBe(false)
  })

  test('an admin sees every item, in both groups', () => {
    const groups = getVisibleNavGroups('admin')
    expect(groups.flatMap((g) => g.items).length).toBe(NAV_ITEMS.length)
    expect(groups.map((g) => g.label)).toEqual(['Workspace', 'Manage'])
  })
})

describe('Sidebar collapse preference', () => {
  test('reads the persisted state', () => {
    expect(readSidebarOpen('sidebar_state=false')).toBe(false)
    expect(readSidebarOpen('sidebar_state=true')).toBe(true)
  })

  test('finds the cookie among others, in any order', () => {
    expect(readSidebarOpen('theme=dark; sidebar_state=false; locale=am')).toBe(false)
    expect(readSidebarOpen('sidebar_state=false; theme=dark')).toBe(false)
  })

  test('a first-time visitor has no opinion, so the rail opens', () => {
    expect(readSidebarOpen(null)).toBeUndefined()
    expect(readSidebarOpen('')).toBeUndefined()
    expect(readSidebarOpen('theme=dark')).toBeUndefined()
  })

  test('a value written by something else is ignored, never coerced', () => {
    expect(readSidebarOpen('sidebar_state=maybe')).toBeUndefined()
    expect(readSidebarOpen('sidebar_state=')).toBeUndefined()
  })

  test('a similarly named cookie is not mistaken for it', () => {
    expect(readSidebarOpen('old_sidebar_state=false')).toBeUndefined()
  })
})

describe('Route wording', () => {
  test('a screen reader hears a path, not a URL', () => {
    expect(composeAnnouncement(['Courses', 'Course 3'])).toBe('Courses / Course 3')
  })

  test('empty crumbs contribute silence, not a stray separator', () => {
    expect(composeAnnouncement(['Courses', '  '])).toBe('Courses')
    expect(composeAnnouncement([])).toBe('')
  })

  test('the document title leads with the page and ends with the product', () => {
    expect(buildDocumentTitle(['Courses', 'Course 3'])).toBe('Courses · Course 3 · Abugida Academy')
    expect(buildDocumentTitle(['Dashboard'])).toBe('Dashboard · Abugida Academy')
  })

  test('a deep workspace title stays readable in a tab strip', () => {
    const title = buildDocumentTitle(['Courses', 'Course 3', 'Lessons', 'Intro'])
    expect(title).toBe('Course 3 · Lessons · Intro · Abugida Academy')
  })

  test('announcement and title are built from the same labels', () => {
    const labels = ['Settings', 'Roles & Permissions']
    expect(buildDocumentTitle(labels)).toContain(composeAnnouncement(labels).split(' / ').at(-1)!)
  })
})
