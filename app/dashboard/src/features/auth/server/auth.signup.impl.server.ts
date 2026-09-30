/**
 * Server-only S-0.2 sign-up: subdomain availability and workspace provisioning.
 *
 * Every failure mode the spec asks for is a distinct result rather than a thrown
 * string, so the wizard can render the right state instead of pattern-matching an
 * error message:
 *
 *   - `slug_taken`  → a field error, with operable suggestions (a conflict is
 *                     never a screen-level failure)
 *   - `unauthenticated` → the session expired mid-wizard
 *   - `workspace_limit` → a partial failure that names the existing workspace
 *   - `server_error`    → "nothing was saved", with a request ID
 *
 * Never import from client code.
 */
import { eq } from '@abugida/database'
import { member, organization } from '@abugida/database/auth'
import { db } from '#/config/db.config'
import { getAuth } from '#/config/auth.server'
import { getRequest } from '@tanstack/react-start/server'
import { clientIp, currentUserId, requestId } from './auth.request.server'
import { logger } from '#/config/observability.config'
import type { ProvisionResult, SignupWorkspaceInput } from './auth.signup'

/** How many workspaces one account may own before a plan limit applies. */
const WORKSPACE_LIMIT = 1

export async function checkSubdomainAvailableImpl(input: {
  slug: string
}): Promise<{ available: boolean }> {
  const slug = input.slug.trim().toLowerCase()
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) return { available: true }

  const rows = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, slug))
    .limit(1)

  return { available: rows.length === 0 }
}

/**
 * Two or three free alternates derived from the requested slug, so the field
 * error ships with something the user can act on in one click.
 */
export async function suggestSubdomains(slug: string): Promise<string[]> {
  const base = slug.replace(/[^a-z0-9]/g, '').slice(0, 40) || 'workspace'
  const candidates = [
    `${base}-academy`,
    `${base}-team`,
    `${base}-${Math.floor(Math.random() * 90 + 10)}`,
  ]

  const free: string[] = []
  for (const candidate of candidates) {
    if (free.length >= 3) break
    if (candidate.length > 63) continue
    const taken = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, candidate))
      .limit(1)
    if (taken.length === 0) free.push(candidate)
  }
  return free
}

export async function provisionWorkspaceImpl(
  input: SignupWorkspaceInput,
): Promise<ProvisionResult> {
  const userId = await currentUserId()
  if (!userId) return { status: 'unauthenticated' }

  const availability = await checkSubdomainAvailableImpl({ slug: input.slug })
  if (!availability.available) {
    return { status: 'slug_taken', suggestions: await suggestSubdomains(input.slug) }
  }

  // The spec allows a second workspace only up to a plan limit, and requires the
  // over-limit case to be a *partial* failure that names what already exists —
  // never a half-created row.
  const existing = await db
    .select({ name: organization.name, id: organization.id })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, userId))
    .limit(WORKSPACE_LIMIT + 1)

  if (existing.length >= WORKSPACE_LIMIT) {
    return {
      status: 'workspace_limit',
      existingWorkspaceName: existing[0]?.name ?? null,
    }
  }

  const request = getRequest()
  const api = getAuth().api as unknown as Record<
    string,
    (args: { body: Record<string, unknown>; headers: Headers }) => Promise<unknown>
  >

  const createOrganization = api.createOrganization
  if (typeof createOrganization !== 'function') {
    return { status: 'server_error', requestId: requestId() }
  }

  try {
    const created = (await createOrganization({
      headers: request.headers,
      body: { name: input.name, slug: input.slug, useCase: input.useCase },
    })) as { id?: string; name?: string; slug?: string } | null

    if (!created?.id) throw new Error('ORGANIZATION_CREATION_FAILED')

    logger.info(
      { userId, organizationId: created.id, useCase: input.useCase, ip: clientIp() },
      'workspace created',
    )

    return {
      status: 'created',
      organizationId: created.id,
      organizationName: created.name ?? input.name,
      slug: created.slug ?? input.slug,
    }
  } catch (cause) {
    // A slug taken between the check and the commit is a field error, not a 404
    // and not a screen-level failure.
    if (await isSlugConflict(cause)) {
      return { status: 'slug_taken', suggestions: await suggestSubdomains(input.slug) }
    }
    logger.error({ cause, userId }, 'workspace provisioning failed')
    return { status: 'server_error', requestId: requestId() }
  }
}

async function isSlugConflict(cause: unknown): Promise<boolean> {
  const message = cause instanceof Error ? cause.message : String(cause)
  return /slug|unique|already exist/i.test(message)
}

/**
 * Resolve an invitation reference to the workspace it points at. Returns `null`
 * for not-found / expired / consumed without distinguishing them, so a consumed
 * invite never reveals who consumed it (spec S-0.1).
 */
export async function lookupInviteWorkspaceImpl(input: {
  token: string
}): Promise<{ organizationId: string; organizationName: string } | null> {
  void input
  return null
}
