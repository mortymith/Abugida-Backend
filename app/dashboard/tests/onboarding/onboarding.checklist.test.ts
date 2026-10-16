import { describe, expect, test } from 'bun:test'
import {
  CHECKLIST_ITEM_IDS,
  PRIMARY_USE_CASE_OPTIONS,
  PRIMARY_USE_CASES,
  checklistItemsFor,
  collectsPayment,
  evaluateChecklist,
  normaliseUseCase,
} from '#/features/onboarding/onboarding.checklist'
import type { ChecklistCriteria } from '#/features/onboarding/onboarding.checklist'

/**
 * S-0.2 Getting Started Checklist.
 *
 * The acceptance criteria these tests exist for:
 *  1. With a no-payment `Primary Use Case`, the payment item is **absent** —
 *     not disabled.
 *  2. Every item flips on a real criterion, never on a click.
 *  3. Once complete, no card renders.
 */

const NOTHING: ChecklistCriteria = {
  teamMemberAccepted: false,
  brandingConfigured: false,
  firstCourseDrafted: false,
  paymentGatewayConnected: false,
}

const EVERYTHING: ChecklistCriteria = {
  teamMemberAccepted: true,
  brandingConfigured: true,
  firstCourseDrafted: true,
  paymentGatewayConnected: true,
}

describe('primary use case', () => {
  test('offers the spec three', () => {
    expect([...PRIMARY_USE_CASES]).toEqual(['sell_courses', 'run_courses', 'train_employees'])
    expect(PRIMARY_USE_CASE_OPTIONS).toHaveLength(3)
  })

  test('every option is labelled and explained', () => {
    for (const option of PRIMARY_USE_CASE_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(3)
      expect(option.description.length).toBeGreaterThan(10)
    }
  })

  test('only the selling workspace charges', () => {
    expect(collectsPayment('sell_courses')).toBe(true)
    expect(collectsPayment('run_courses')).toBe(false)
    expect(collectsPayment('train_employees')).toBe(false)
  })

  test('normalises rows written before this enum existed', () => {
    // Legacy values were language_courses / corporate_training / other. None
    // of them charge, so none of them may show a payment task.
    expect(normaliseUseCase('language_courses')).toBe('run_courses')
    expect(normaliseUseCase('corporate_training')).toBe('run_courses')
    expect(normaliseUseCase('other')).toBe('run_courses')
    expect(normaliseUseCase(null)).toBe('run_courses')
    expect(normaliseUseCase('sell_courses')).toBe('sell_courses')
  })
})

describe('which items apply', () => {
  test('a selling workspace gets the payment task', () => {
    const ids = checklistItemsFor('sell_courses').map((item) => item.id)
    expect(ids).toEqual([...CHECKLIST_ITEM_IDS])
  })

  test('a no-payment workspace never sees the payment task', () => {
    // Acceptance criterion 1: absent from the list, not disabled.
    for (const useCase of ['run_courses', 'train_employees']) {
      const ids = checklistItemsFor(useCase).map((item) => item.id)
      expect(ids).not.toContain('payment_gateway')
      expect(ids).toHaveLength(3)
    }
  })

  test('a legacy value with no payment intent also omits it', () => {
    expect(checklistItemsFor('corporate_training').map((i) => i.id)).not.toContain(
      'payment_gateway',
    )
  })

  test('every item links to a real destination', () => {
    for (const useCase of PRIMARY_USE_CASES) {
      for (const item of checklistItemsFor(useCase)) {
        expect(item.to.startsWith('/')).toBe(true)
        expect(item.title.length).toBeGreaterThan(3)
        expect(item.description.length).toBeGreaterThan(10)
      }
    }
  })
})

describe('completion is a real criterion, not a click counter', () => {
  test('items are derived from the server criteria passed in', () => {
    const state = evaluateChecklist('run_courses', {
      ...NOTHING,
      firstCourseDrafted: true,
    })
    const byId = Object.fromEntries(state.items.map((item) => [item.id, item.done]))
    expect(byId.first_course).toBe(true)
    expect(byId.invite_team).toBe(false)
    expect(byId.brand_workspace).toBe(false)
  })

  test('the payment criterion is ignored by a no-payment workspace', () => {
    const state = evaluateChecklist('run_courses', {
      ...NOTHING,
      paymentGatewayConnected: true,
    })
    expect(state.completed).toBe(0)
    expect(state.isComplete).toBe(false)
  })

  test('the payment criterion counts for a selling workspace', () => {
    const state = evaluateChecklist('sell_courses', {
      ...NOTHING,
      paymentGatewayConnected: true,
    })
    expect(state.completed).toBe(1)
    expect(state.isComplete).toBe(false)
  })

  test('progress counts only applicable items', () => {
    expect(evaluateChecklist('run_courses', NOTHING).total).toBe(3)
    expect(evaluateChecklist('sell_courses', NOTHING).total).toBe(4)
  })
})

describe('the card is hidden once complete', () => {
  test('acceptance criterion 3: no card renders when everything is done', () => {
    for (const useCase of PRIMARY_USE_CASES) {
      const state = evaluateChecklist(useCase, EVERYTHING)
      expect(state.isComplete).toBe(true)
      expect(state.showCard).toBe(false)
    }
  })

  test('a no-payment workspace can complete without a payment gateway', () => {
    const state = evaluateChecklist('run_courses', {
      teamMemberAccepted: true,
      brandingConfigured: true,
      firstCourseDrafted: true,
      paymentGatewayConnected: false,
    })
    expect(state.isComplete).toBe(true)
    expect(state.showCard).toBe(false)
  })

  test('completion outranks dismissal — a finished workspace is never re-nagged', () => {
    const state = evaluateChecklist('sell_courses', EVERYTHING, { dismissed: true })
    expect(state.showCard).toBe(false)
  })

  test('dismissal hides the card while work remains', () => {
    expect(evaluateChecklist('sell_courses', NOTHING, { dismissed: true }).showCard).toBe(false)
  })

  test('an outstanding workspace shows the card', () => {
    const state = evaluateChecklist('sell_courses', NOTHING)
    expect(state.showCard).toBe(true)
    expect(state.completed).toBe(0)
  })
})
