/**
 * Server-only implementation of S-6.9 Roles & Permissions. The roles table
 * stores per-role permission matrices (module → capabilities). Built-in
 * roles resolve to the spec 11 defaults until an admin customizes them;
 * custom roles clone an existing matrix. Saving enforces the spec's lockout
 * guards (admin core locked; no zero-manager states for Settings/Billing).
 * Never import from client code.
 */
import { eq, isNull } from '@abugida/database'
import { roles } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import {
  countMembersByRole,
  requireSettingsAdmin,
  resolveCallerOrganization,
  writeAudit,
} from './settings.server-helpers.server'
import {
  BUILT_IN_ROLES,
  PERMISSION_CAPABILITIES,
  PERMISSION_MODULES,
  ROLE_DESCRIPTIONS,
} from '../settings.constants'
import {
  findManagerConflicts,
  resolveEffectiveMatrices,
  sanitizeMatrix,
  validateAdminMatrix,
} from '../settings.permissions'
import type { RoleItem, RolesPage } from '../settings.types'
import type { CreateCustomRoleInput, SaveRolePermissionsInput } from '../schemas/settings.schema'

function toMatrix(json: unknown): Record<string, string[]> {
  return sanitizeMatrix(json)
}

export async function getRolesPageImpl(): Promise<RolesPage> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveCallerOrganization(adminId)

  const rows = await db
    .select({
      publicId: roles.publicId,
      name: roles.name,
      description: roles.description,
      permissions: roles.permissions,
    })
    .from(roles)
    .where(isNull(roles.deletedAt))

  const saved: Record<string, Record<string, string[]>> = {}
  for (const row of rows) saved[row.name] = toMatrix(row.permissions)

  const effective = resolveEffectiveMatrices(saved)

  const roleItems: RoleItem[] = [
    ...BUILT_IN_ROLES.map<RoleItem>((name) => ({
      publicId: `built-in:${name}`,
      name,
      description: ROLE_DESCRIPTIONS[name] ?? null,
      isBuiltIn: true,
      permissions: effective[name] ?? {},
    })),
    ...rows
      .filter((row) => !BUILT_IN_ROLES.includes(row.name as 'admin'))
      .map<RoleItem>((row) => ({
        publicId: row.publicId,
        name: row.name,
        description: row.description ?? null,
        isBuiltIn: false,
        permissions: effective[row.name] ?? {},
      })),
  ]

  const roleMemberCounts = org ? await countMembersByRole(org.id) : {}

  return {
    roles: roleItems,
    modules: [...PERMISSION_MODULES],
    capabilities: [...PERMISSION_CAPABILITIES],
    roleMemberCounts,
  }
}

export async function saveRolePermissionsImpl(
  input: SaveRolePermissionsInput,
): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()
  const org = await resolveCallerOrganization(adminId)
  if (!org) throw new Error('NO_ORGANIZATION')

  const matrix = sanitizeMatrix(input.permissions)

  if (input.roleName === 'admin') {
    const lockError = validateAdminMatrix(matrix)
    if (lockError) throw new Error(`ADMIN_LOCKED: ${lockError}`)
  }

  // Zero-manager conflict check across every saved role (spec S-6.9).
  const rows = await db
    .select({ id: roles.id, name: roles.name, permissions: roles.permissions })
    .from(roles)
    .where(isNull(roles.deletedAt))
  const saved: Record<string, Record<string, string[]>> = {}
  for (const row of rows) saved[row.name] = toMatrix(row.permissions)
  saved[input.roleName] = matrix
  const effective = resolveEffectiveMatrices(saved)
  const conflicts = findManagerConflicts(effective, await countMembersByRole(org.id))
  if (conflicts.length > 0) throw new Error(`MANAGER_CONFLICT: ${conflicts.join(' ')}`)

  const existing = rows.find((row) => row.name === input.roleName)
  if (existing) {
    await db
      .update(roles)
      .set({ permissions: matrix, updatedAt: new Date() })
      .where(eq(roles.id, existing.id))
  } else {
    await db.insert(roles).values({
      name: input.roleName,
      description: ROLE_DESCRIPTIONS[input.roleName] ?? null,
      permissions: matrix,
    })
  }

  await writeAudit({
    actorId: adminId,
    action: 'permission_change',
    resourceType: 'role_assignment',
    metadata: {
      screen: 'S-6.9',
      action: 'save_role_permissions',
      role: input.roleName,
      modules: Object.keys(matrix),
    },
  })
  return { ok: true }
}

export async function createCustomRoleImpl(
  input: CreateCustomRoleInput,
): Promise<{ ok: true; publicId: string | null }> {
  const adminId = await requireSettingsAdmin()

  const rows = await db
    .select({ name: roles.name, permissions: roles.permissions })
    .from(roles)
    .where(isNull(roles.deletedAt))
  const saved: Record<string, Record<string, string[]>> = {}
  for (const row of rows) saved[row.name] = toMatrix(row.permissions)
  const effective = resolveEffectiveMatrices(saved)

  const cloneSource = input.cloneFrom in effective ? effective[input.cloneFrom] : undefined
  if (cloneSource == null) throw new Error('CLONE_SOURCE_NOT_FOUND')

  const [row] = await db
    .insert(roles)
    .values({
      name: input.roleName,
      description: `Custom role cloned from ${input.cloneFrom}`,
      permissions: sanitizeMatrix(cloneSource),
    })
    .returning({ publicId: roles.publicId })

  await writeAudit({
    actorId: adminId,
    action: 'permission_change',
    resourceType: 'role_assignment',
    metadata: {
      screen: 'S-6.9',
      action: 'create_custom_role',
      role: input.roleName,
      cloneFrom: input.cloneFrom,
    },
  })
  return { ok: true, publicId: row.publicId }
}
