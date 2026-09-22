import { describe, expect, test } from 'bun:test'
import { commandItemValue } from '#/components/common/command-palette'
import {
  buildNavigationGroup,
  buildQuickActionGroup,
  buildResultsGroup,
  clearRecentSearches,
  readRecentSearches,
  rememberSearchTerm,
  QUICK_ACTIONS,
  RECENT_SEARCHES_LIMIT,
} from '#/features/navigation/navigation.palette'
import { NAV_ITEMS } from '#/features/navigation/navigation.config'
import type { GlobalSearchPayload } from '#/features/search'

/** S-7.5 Command Palette data assembly (spec 09). */

describe('commandItemValue', () => {
  test('labels alone are matchable', () => {
    expect(commandItemValue({ label: 'Create Course' })).toBe('Create Course')
  })

  test('keywords extend the match value', () => {
    expect(commandItemValue({ label: 'Courses', keywords: '/courses screen' })).toBe(
      'Courses /courses screen',
    )
  })
})

describe('buildQuickActionGroup', () => {
  test('exposes the spec quick actions with route-backed targets', () => {
    const targets = QUICK_ACTIONS.map((action) => action.to)
    expect(targets).toContain('/courses/new')
    expect(targets).toContain('/settings/team')
  })

  test('calls the navigate handler with the action target and search params', () => {
    const received: Array<[string, Record<string, unknown> | undefined]> = []
    const group = buildQuickActionGroup((to, search) => {
      received.push([to, search])
    })
    group.items.forEach((item) => item.onSelect())
    expect(received.length).toBe(group.items.length)
    const create = received.find(([to]) => to === '/courses/new')
    expect(create?.[1]).toEqual({ step: 1 })
  })
})

describe('buildNavigationGroup', () => {
  test('respects the role filter from the nav config', () => {
    const admin = buildNavigationGroup('admin', () => {})
    const expected = NAV_ITEMS.filter((item) => item.roles.includes('admin'))
    expect(admin.items.map((item) => item.label)).toEqual(expected.map((item) => item.label))
  })

  test('hides Settings from non-admin roles (spec 11 matrix)', () => {
    const viewer = buildNavigationGroup('viewer', () => {})
    expect(viewer.items.some((item) => item.label === 'Settings')).toBe(false)
  })

  test('items navigate to their screen', () => {
    const visited: string[] = []
    const group = buildNavigationGroup('admin', (to) => visited.push(to))
    group.items.forEach((item) => item.onSelect())
    expect(visited).toEqual(
      NAV_ITEMS.filter((item) => item.roles.includes('admin')).map((i) => i.to),
    )
  })
})

describe('buildResultsGroup', () => {
  const payload: GlobalSearchPayload = {
    query: 'toefl',
    groups: [
      {
        kind: 'course',
        label: 'Courses',
        total: 2,
        items: [
          { kind: 'course', id: 'c1', title: 'TOEFL Complete', url: '/courses/c1', exists: true },
          {
            kind: 'lesson',
            id: 'l1',
            title: 'Skimming Basics',
            url: '/courses/c1/lessons/l1',
            exists: false,
          },
        ],
      },
    ],
    totalMatches: 2,
    omittedGroups: [],
  }

  test('flattens groups into one results group with kind hints', () => {
    const group = buildResultsGroup(payload, () => {})
    expect(group.items.map((item) => item.hint)).toEqual(['Course', 'Lesson (soon)'])
  })

  test('flags unimplemented targets instead of hiding them', () => {
    const group = buildResultsGroup(payload, () => {})
    expect(group.items[1]?.hint).toBe('Lesson (soon)')
  })

  test('navigates to the deep link on select', () => {
    const urls: string[] = []
    buildResultsGroup(payload, (url) => urls.push(url)).items.forEach((item) => item.onSelect())
    expect(urls).toEqual(['/courses/c1', '/courses/c1/lessons/l1'])
  })
})

describe('recent searches', () => {
  function memoryStorage() {
    const map = new Map<string, string>()
    return {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    }
  }

  test('most recent first, deduplicated, capped at the limit', () => {
    const storage = memoryStorage()
    for (const term of ['toefl', 'ielts', 'toefl']) rememberSearchTerm(storage, term)
    expect(readRecentSearches(storage)).toEqual(['toefl', 'ielts'])
  })

  test('ignores blank terms and non-string entries', () => {
    const storage = memoryStorage()
    rememberSearchTerm(storage, '   ')
    storage.setItem('abugida-recent-searches', '[42, "ok"]')
    expect(readRecentSearches(storage)).toEqual(['ok'])
  })

  test('caps the stored list', () => {
    const storage = memoryStorage()
    for (let i = 0; i < 12; i += 1) rememberSearchTerm(storage, `term-${i}`)
    const stored = readRecentSearches(storage)
    expect(stored.length).toBe(RECENT_SEARCHES_LIMIT)
    expect(stored[0]).toBe('term-11')
  })

  test('clear removes stored entries', () => {
    const storage = memoryStorage()
    rememberSearchTerm(storage, 'toefl')
    clearRecentSearches(storage)
    expect(readRecentSearches(storage)).toEqual([])
  })
})
