import { describe, expect, test } from 'bun:test'
import {
  buildNavigationGroup,
  buildQuickActionGroup,
  buildResultsGroup,
  commandItemValue,
  QUICK_ACTIONS,
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
    const group = buildQuickActionGroup('admin', (to, search) => {
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

describe('buildQuickActionGroup — permissions', () => {
  test('an action a role cannot use is absent, not disabled', () => {
    const support = buildQuickActionGroup('support', () => {})
    const labels = support.items.map((item) => item.label)
    expect(labels).not.toContain('Create Course')
    expect(labels).not.toContain('Open Review Queue')
    expect(labels).toContain('Upload Content Asset')
  })
})
