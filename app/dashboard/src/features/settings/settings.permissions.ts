import {
  BUILT_IN_ROLE_PERMISSIONS,
  PERMISSION_CAPABILITIES,
  PERMISSION_MODULES,
} from './settings.constants'
import type { PermissionMatrix } from './settings.constants'

/**
 * Pure permission-matrix logic for S-6.9 Roles & Permissions. Deterministic
 * and database-free so correctness is unit-testable (spec 08: saving must
 * never leave the workspace without someone able to manage Settings/Billing).
 */

/** Normalize incoming permission cells: drop unknown modules/capabilities, dedupe. */
export function sanitizeMatrix(input: unknown): PermissionMatrix {
  const source = (input ?? {}) as Record<string, unknown>
  const result: PermissionMatrix = {}
  for (const moduleName of PERMISSION_MODULES) {
    const raw = source[moduleName]
    if (!Array.isArray(raw)) continue
    const caps = [
      ...new Set(
        raw.filter(
          (cap): cap is (typeof PERMISSION_CAPABILITIES)[number] =>
            typeof cap === 'string' && (PERMISSION_CAPABILITIES as readonly string[]).includes(cap),
        ),
      ),
    ]
    if (caps.length > 0) result[moduleName] = caps
  }
  return result
}

/** A role "manages" a module when it holds any write capability on it. */
function managesModule(matrix: PermissionMatrix, moduleName: string): boolean {
  const caps = matrix[moduleName] ?? []
  return caps.some((cap) => cap !== 'view')
}

/**
 * Spec S-6.9 conflict rule: warn/block when saving would leave zero users
 * able to manage Settings or Billing. `roleMemberCounts` maps role name →
 * number of org members holding it; `adminCountsAsManager` keeps the
 * platform's fallback admin (owner without a named role row) in the count.
 */
export function findManagerConflicts(
  proposed: Record<string, PermissionMatrix>,
  roleMemberCounts: Record<string, number>,
): string[] {
  const conflicts: string[] = []
  for (const moduleName of ['Settings', 'Billing'] as const) {
    const managers = Object.entries(proposed).reduce((sum, [roleName, matrix]) => {
      const holders = roleMemberCounts[roleName] ?? 0
      return managesModule(matrix, moduleName) ? sum + holders : sum
    }, 0)
    if (managers === 0) {
      conflicts.push(
        `No user would be able to manage ${moduleName} after this change. Grant a role with ${moduleName} write access first.`,
      )
    }
  }
  return conflicts
}

/**
 * Spec S-6.9 built-in lock: the admin role must keep at least one write
 * capability on every module — otherwise the workspace can lose its
 * management path entirely.
 */
export function validateAdminMatrix(matrix: PermissionMatrix): string | null {
  for (const moduleName of PERMISSION_MODULES) {
    if (!managesModule(matrix, moduleName)) {
      return `The Admin role must keep write access to ${moduleName} (lockout protection).`
    }
  }
  return null
}

/**
 * Resolve the effective matrix per built-in role: a saved row wins (admins
 * customize defaults in S-6.9); roles never saved fall back to the spec 11
 * defaults. Custom (non built-in) roles always use their own saved matrix.
 */
export function resolveEffectiveMatrices(
  saved: Record<string, PermissionMatrix | undefined>,
): Record<string, PermissionMatrix> {
  const resolved: Record<string, PermissionMatrix> = {}
  for (const [roleName, matrix] of Object.entries(BUILT_IN_ROLE_PERMISSIONS)) {
    const row = sanitizeMatrix(saved[roleName])
    resolved[roleName] = Object.keys(row).length > 0 ? row : sanitizeMatrix(matrix)
  }
  for (const [roleName, matrix] of Object.entries(saved)) {
    if (!(roleName in resolved)) resolved[roleName] = sanitizeMatrix(matrix)
  }
  return resolved
}
