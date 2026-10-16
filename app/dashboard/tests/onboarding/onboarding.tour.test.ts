import { describe, expect, test } from 'bun:test'
import { NAV_ITEMS } from '#/features/navigation/navigation.config'
import { REPLAY_TOUR_EVENT, TOUR_STEPS } from '#/features/onboarding/onboarding.steps'
import {
  placeTourCard,
  spotlightRect,
  TOUR_DEFAULT_MARGIN,
} from '#/features/onboarding/onboarding.geometry'

/** S-7.6 Onboarding Tour steps and spotlight geometry (spec 09). */

describe('TOUR_STEPS', () => {
  test('has the five spec steps (S-1.1, S-2.1, S-4.1, S-5.1, S-6.1)', () => {
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      'dashboard',
      'courses',
      'students',
      'analytics',
      'settings',
    ])
  })

  test('every step targets a real sidebar nav item', () => {
    const navIds = new Set(NAV_ITEMS.map((item) => `nav-${item.id}`))
    for (const step of TOUR_STEPS) {
      expect(navIds.has(step.target)).toBe(true)
    }
  })

  test('every step has readable copy', () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(3)
      expect(step.body.length).toBeGreaterThan(20)
    }
  })
})

describe('spotlightRect', () => {
  const viewport = { width: 1440, height: 900 }
  const target = { top: 100, left: 24, width: 200, height: 40 }

  test('grows the hole by the padding', () => {
    const spot = spotlightRect(target, 8)
    expect(spot).toEqual({ top: 92, left: 16, width: 216, height: 56, clipped: false })
  })

  test('reports clipping at the viewport edge without negative sizes', () => {
    const edge = { top: 0, left: 0, width: 40, height: 20 }
    const spot = spotlightRect(edge, 8, viewport)
    expect(spot.top).toBe(0)
    expect(spot.left).toBe(0)
    expect(spot.clipped).toBe(true)
  })
})

describe('placeTourCard', () => {
  const viewport = { width: 1440, height: 900 }
  const card = { width: 320, height: 180 }
  const centered = { top: 400, left: 24, width: 200, height: 40 }

  test('prefers below the target when there is room', () => {
    const roomy = { top: 400, left: 300, width: 200, height: 40 }
    const result = placeTourCard(roomy, viewport, card)
    expect(result.placement).toBe('bottom')
    // Horizontally centered on the target.
    expect(result.x).toBe(roomy.left + roomy.width / 2 - card.width / 2)
    expect(result.y).toBe(roomy.top + roomy.height + TOUR_DEFAULT_MARGIN)
  })

  test('centering near the left edge clamps to the margin', () => {
    const result = placeTourCard(centered, viewport, card)
    expect(result.x).toBe(TOUR_DEFAULT_MARGIN)
  })

  test('flips above the target near the bottom edge', () => {
    const nearBottom = { top: 850, left: 24, width: 200, height: 40 }
    const result = placeTourCard(nearBottom, viewport, card)
    expect(result.placement).toBe('top')
    expect(result.y).toBe(nearBottom.top - card.height - TOUR_DEFAULT_MARGIN)
  })

  test('falls back to the side when vertical space is exhausted', () => {
    const middle = { top: 400, left: 24, width: 200, height: 40 }
    const shortViewport = { width: 1440, height: 640 }
    const result = placeTourCard(middle, shortViewport, { width: 320, height: 500 })
    expect(['right', 'left', 'top', 'bottom']).toContain(result.placement)
  })

  test('never leaves the viewport, even for a target at the edge', () => {
    const edge = { top: 100, left: 1300, width: 120, height: 40 }
    const result = placeTourCard(edge, viewport, card)
    expect(result.x).toBeLessThanOrEqual(viewport.width - card.width - TOUR_DEFAULT_MARGIN)
    expect(result.y).toBeGreaterThanOrEqual(TOUR_DEFAULT_MARGIN)
  })

  test('clamps negative coordinates to the margin', () => {
    const topEdge = { top: 4, left: 24, width: 200, height: 40 }
    const result = placeTourCard(topEdge, viewport, card)
    expect(result.y).toBeGreaterThanOrEqual(0)
    expect(result.x).toBeGreaterThanOrEqual(TOUR_DEFAULT_MARGIN)
  })
})

describe('replay event', () => {
  test('dispatches the documented replay event name', () => {
    expect(REPLAY_TOUR_EVENT).toBe('abugida:replay-tour')
  })
})
