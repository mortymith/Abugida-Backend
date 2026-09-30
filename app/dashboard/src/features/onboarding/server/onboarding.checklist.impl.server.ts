/**
 * Server-only Getting Started Checklist criteria (spec S-0.2).
 *
 * The spec is explicit that "each item is a real completion check, not a click
 * counter: it flips when the destination screen's own criterion is met". So the
 * booleans are computed here, from the same rows the destination screens read —
 * a member row, a draft course, a configured brand colour, an enabled gateway —
 * and the pure module only decides which items apply and what the progress is.
 *
 * Never import from client code.
 */
import { eq, sql } from '@abugida/database'
import { courses } from '@abugida/database/catalog'
import { paymentGateways } from '@abugida/database/finance'
import { member, organization } from '@abugida/database/auth'
import { systemConfigs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { evaluateChecklist } from '../onboarding.checklist'
import type { ChecklistCriteria, ChecklistState } from '../onboarding.checklist'

export interface ChecklistResult extends ChecklistState {
  useCase: string
  /** The single "Resume setup" affordance that replaces the dismissed card. */
  resumeAvailable: boolean
}

export async function getChecklistImpl(): Promise<ChecklistResult | null> {
  const { getAuth } = await import('#/config/auth.server')
  const { getRequest } = await import('@tanstack/react-start/server')
  const request = getRequest()
  const session = await getAuth().getSession(request.headers)
  if (!session.ok) return null

  const userId = session.value.user.id

  const orgRows = await db
    .select({ id: organization.id, useCase: organization.useCase })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .limit(1)

  const org = orgRows.at(0)
  if (!org) return null

  const [members, drafts, gateways, branding] = await Promise.all([
    countMembers(org.id),
    countDraftCourses(),
    countEnabledGateways(),
    readBranding(),
  ])

  const criteria: ChecklistCriteria = {
    teamMemberAccepted: members > 1,
    brandingConfigured: Boolean(branding.primaryColor),
    firstCourseDrafted: drafts > 0,
    paymentGatewayConnected: gateways > 0,
  }

  const state = evaluateChecklist(org.useCase, criteria)

  return {
    ...state,
    useCase: org.useCase,
    // The Resume link exists exactly while there is outstanding setup, so a
    // finished workspace is never re-nagged.
    resumeAvailable: !state.isComplete,
  }
}

async function countMembers(organizationId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(member)
    .where(eq(member.organizationId, organizationId))
  return Number(rows.at(0)?.total ?? 0)
}

async function countDraftCourses(): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(courses)
    .where(eq(courses.status, 'draft'))
  return Number(rows.at(0)?.total ?? 0)
}

async function countEnabledGateways(): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`COUNT(*)::int` })
    .from(paymentGateways)
    .where(eq(paymentGateways.isEnabled, true))
  return Number(rows.at(0)?.total ?? 0)
}

async function readBranding(): Promise<{ primaryColor?: string }> {
  const rows = await db
    .select({ value: systemConfigs.value })
    .from(systemConfigs)
    .where(eq(systemConfigs.key, 'branding.settings'))
    .limit(1)
  return (rows.at(0)?.value as { primaryColor?: string } | undefined) ?? {}
}
