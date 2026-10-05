/**
 * Server-only helpers shared by the S-1.1 / S-1.2 impl modules: workspace
 * scoping, role resolution, and date-range resolution that needs workspace
 * data. Never import from client code.
 */
import { and, eq, isNull, sql } from '@abugida/database'
import { courses } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { getRequest } from '@tanstack/react-start/server'
import { getAuth } from '#/config/auth.server'
import { resolveDateRange } from '../schemas/dashboard.date-range.schema'
import type {
  DateRange,
  DateRangeInput,
  ResolveRangeOptions,
} from '../schemas/dashboard.date-range.schema'
import { REVENUE_ROLES } from '#/features/auth'
import type { PlatformRole } from '#/features/auth'

/** The active workspace, or throw — a read with no scope reads every workspace. */
export async function requireDashboardOrganizationId(): Promise<string> {
  const { requireActiveOrganizationIdImpl } =
    await import('#/features/workspaces/server/workspaces.impl.server')
  return requireActiveOrganizationIdImpl()
}

/** The caller's role in the active workspace (view-only floor: `viewer`). */
export async function getDashboardRole(): Promise<PlatformRole> {
  const request = getRequest()
  const session = await getAuth().getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')
  const { resolvePlatformRoleImpl } = await import('#/features/auth/server/auth.roles.impl.server')
  return resolvePlatformRoleImpl(session.value.user.id)
}

/** `finance.view_revenue` is a role grant (spec 11 matrix): admin + editor. */
export async function canViewRevenue(): Promise<boolean> {
  return REVENUE_ROLES.includes(await getDashboardRole())
}

/**
 * Oldest course in the workspace — the `allTime` preset's lower bound.
 *
 * A workspace with no course has no history, which is the true-empty state, so
 * falling back to today is honest: the range is one day long and empty rather
 * than silently spanning the epoch.
 */
export async function earliestCourseDate(): Promise<string | undefined> {
  const organizationId = await requireDashboardOrganizationId()
  const rows = await db
    .select({ earliest: sql<string | null>`MIN(${courses.createdAt})::text` })
    .from(courses)
    .where(and(isNull(courses.deletedAt), eq(courses.organizationId, organizationId)))
  const earliest = rows.at(0)?.earliest
  return earliest ? new Date(earliest).toISOString().slice(0, 10) : undefined
}

/** Resolve the screen's single range, workspace-aware for `allTime`. */
export async function resolveDashboardRange(
  input: DateRangeInput | undefined,
  options: Omit<ResolveRangeOptions, 'allTimeFrom'> = {},
): Promise<DateRange> {
  // The workspace lookup only earns its query when `allTime` is selected.
  const allTimeFrom = input?.preset === 'allTime' ? await earliestCourseDate() : undefined
  return resolveDateRange(input, new Date(), { ...options, allTimeFrom })
}
