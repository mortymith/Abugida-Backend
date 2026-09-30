/**
 * Getting Started Checklist (spec S-0.2, rendered on S-1.1).
 *
 * Two rules from the spec drive this module, and both are easy to get wrong:
 *
 *  1. **Items are derived from `Primary Use Case`.** A workspace that will
 *     never charge is never shown _Connect a payment gateway_ — the item is
 *     **absent**, not disabled (spec 11's three-case permission rule: a
 *     capability the role lacks is absent entirely).
 *  2. **Each item flips on a real server-side criterion**, never on a click.
 *     The server passes booleans; this module only decides which items apply
 *     and what the progress is.
 *
 * The checklist is also the one place `Primary Use Case` is interpreted, so the
 * sign-up wizard, the dashboard card and the tests all agree on what each
 * choice means.
 *
 * Pure module: no React, no env, no db. Tested by `tests/onboarding.checklist.test.ts`.
 */

/**
 * Spec S-0.2 offers exactly three, and the axis that matters downstream is
 * whether the workspace charges for courses — that is what decides whether the
 * payment checklist item exists at all.
 */
export const PRIMARY_USE_CASES = ['sell_courses', 'run_courses', 'train_employees'] as const

export type PrimaryUseCase = (typeof PRIMARY_USE_CASES)[number]

export const PRIMARY_USE_CASE_OPTIONS: ReadonlyArray<{
  value: PrimaryUseCase
  label: string
  description: string
}> = [
  {
    value: 'sell_courses',
    label: 'Sell courses for payment',
    description: 'Charge learners for enrolment. Adds payment setup to your checklist.',
  },
  {
    value: 'run_courses',
    label: 'Run courses for members',
    description: 'No payment. Everyone you enrol has access.',
  },
  {
    value: 'train_employees',
    label: 'Train employees',
    description: 'Private and invite-only. No payment, no storefront.',
  },
]

export function isPrimaryUseCase(value: unknown): value is PrimaryUseCase {
  return typeof value === 'string' && (PRIMARY_USE_CASES as readonly string[]).includes(value)
}

/**
 * Rows written before this enum existed carry `language_courses` /
 * `corporate_training` / `other`. None of them charge, so they all normalise to
 * the no-payment branch rather than showing a payment task that can never
 * become relevant.
 */
export function normaliseUseCase(value: string | null | undefined): PrimaryUseCase {
  if (value === 'sell_courses') return 'sell_courses'
  if (value === 'train_employees') return 'train_employees'
  return 'run_courses'
}

/** The only question the checklist cares about. */
export function collectsPayment(useCase: string | null | undefined): boolean {
  return normaliseUseCase(useCase) === 'sell_courses'
}

export const CHECKLIST_ITEM_IDS = [
  'invite_team',
  'brand_workspace',
  'first_course',
  'payment_gateway',
] as const

export type ChecklistItemId = (typeof CHECKLIST_ITEM_IDS)[number]

export interface ChecklistItem {
  id: ChecklistItemId
  title: string
  description: string
  /** Where the task is done. Spec screen IDs, resolved in the component. */
  to: string
}

/**
 * Real completion criteria, evaluated server-side. These are deliberately
 * server-shaped booleans: the client never counts clicks.
 */
export interface ChecklistCriteria {
  /** ≥ 1 team member has accepted their invitation. */
  teamMemberAccepted: boolean
  /** `primaryColor` is set in workspace branding. */
  brandingConfigured: boolean
  /** A course exists in the `Draft` lifecycle state. */
  firstCourseDrafted: boolean
  /** An enabled payment gateway row exists. */
  paymentGatewayConnected: boolean
}

const ALL_ITEMS: Record<ChecklistItemId, ChecklistItem> = {
  invite_team: {
    id: 'invite_team',
    title: 'Invite your team',
    description: 'Add editors, reviewers, and viewers to your workspace.',
    to: '/settings/team',
  },
  brand_workspace: {
    id: 'brand_workspace',
    title: 'Brand your workspace',
    description: 'Add your logo and set your primary colour.',
    to: '/settings/branding',
  },
  first_course: {
    id: 'first_course',
    title: 'Create your first course',
    description: 'Start from blank, a template, or let AI draft it for you.',
    to: '/courses/new',
  },
  payment_gateway: {
    id: 'payment_gateway',
    title: 'Connect a payment gateway',
    description: 'Set up payments so you can sell courses to learners.',
    to: '/settings/integrations',
  },
}

/**
 * Which items apply. The payment item is *absent* for a workspace that will
 * never charge — a non-selling workspace must not see a task it can never
 * complete (acceptance criterion 1).
 */
export function checklistItemsFor(useCase: string | null | undefined): ChecklistItem[] {
  const base: ChecklistItemId[] = ['invite_team', 'brand_workspace', 'first_course']
  if (collectsPayment(useCase)) base.push('payment_gateway')
  return base.map((id) => ALL_ITEMS[id])
}

function isItemComplete(id: ChecklistItemId, criteria: ChecklistCriteria): boolean {
  switch (id) {
    case 'invite_team':
      return criteria.teamMemberAccepted
    case 'brand_workspace':
      return criteria.brandingConfigured
    case 'first_course':
      return criteria.firstCourseDrafted
    case 'payment_gateway':
      return criteria.paymentGatewayConnected
  }
}

export interface ChecklistState {
  items: Array<ChecklistItem & { done: boolean }>
  completed: number
  total: number
  /** Every applicable item is done — the card is hidden and Resume disappears. */
  isComplete: boolean
  /** Whether the card may render at all. */
  showCard: boolean
}

export function evaluateChecklist(
  useCase: string | null | undefined,
  criteria: ChecklistCriteria,
  options: { dismissed?: boolean } = {},
): ChecklistState {
  const items: Array<ChecklistItem & { done: boolean }> = checklistItemsFor(useCase).map(
    (item) => ({
      ...item,
      done: isItemComplete(item.id, criteria),
    }),
  )

  const completed = items.filter((item) => item.done).length
  const complete = items.length > 0 && completed === items.length

  return {
    items,
    completed,
    total: items.length,
    isComplete: complete,
    // Spec: the card is hidden once every applicable item is complete, and
    // separately while the user has dismissed it. A dismissal never survives
    // completion, so a finished workspace can never be re-nagged.
    showCard: !complete && !options.dismissed,
  }
}
