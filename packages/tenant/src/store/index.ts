/**
 * @module store
 *
 * The Drizzle-backed {@link TenantStore}. This is the only module in the package
 * that touches a database, and it only *reads*: the `organization` and `member`
 * tables belong to `@abugida/database` and their writes belong to Better Auth's
 * organization plugin.
 *
 * Kept off the package root so that importing a slug helper or a URL builder in
 * the browser does not pull Drizzle in.
 */

import { and, eq } from '@abugida/database'
import { member, organization } from '@abugida/database/auth'
import type { Tenant, TenantMembership, TenantStore } from '../context'

/**
 * Structural view of the Drizzle handle this store needs — the same approach
 * `@abugida/auth` takes, so the package stays driver-agnostic (node-postgres,
 * PGlite, Bun's driver, … all satisfy it).
 */
interface DrizzleLike {
  select: (fields: Record<string, unknown>) => {
    from: (table: unknown) => {
      where: (condition: unknown) => PromiseLike<Array<Record<string, unknown>>>
      limit?: (count: number) => PromiseLike<Array<Record<string, unknown>>>
    }
  }
}

/**
 * Build a tenant store over an existing Drizzle handle.
 *
 * Every query is keyed on an explicit `tenantId` or `slug`; there is no
 * "current tenant" ambient lookup, so a tenant-scoped service can only ever be
 * asked about a tenant the caller named explicitly.
 */
export function createDrizzleTenantStore(db: unknown): TenantStore {
  const store = db as DrizzleLike

  const selectOne = async <T>(
    fields: Record<string, unknown>,
    table: unknown,
    condition: unknown,
  ): Promise<T | null> => {
    const rows = await store.select(fields).from(table).where(condition)
    return (rows[0] as T | undefined) ?? null
  }

  return {
    async findTenantBySlug(slug: string): Promise<Tenant | null> {
      return selectOne<Tenant>(
        { id: organization.id, slug: organization.slug, name: organization.name },
        organization,
        eq(organization.slug, slug),
      )
    },

    async findTenantById(tenantId: string): Promise<Tenant | null> {
      return selectOne<Tenant>(
        { id: organization.id, slug: organization.slug, name: organization.name },
        organization,
        eq(organization.id, tenantId),
      )
    },

    async findMembership(input: {
      tenantId: string
      userId: string
    }): Promise<TenantMembership | null> {
      const row = await selectOne<{
        id: string
        organizationId: string
        userId: string
        role: string | null
      }>(
        {
          id: member.id,
          organizationId: member.organizationId,
          userId: member.userId,
          role: member.role,
        },
        member,
        and(eq(member.organizationId, input.tenantId), eq(member.userId, input.userId)),
      )
      if (!row) return null
      // `member.organizationId` is the tenant id; renaming it here keeps the
      // tenancy vocabulary out of the Better Auth table names.
      return {
        id: row.id,
        tenantId: row.organizationId,
        userId: row.userId,
        role: row.role ?? null,
      }
    },
  }
}
