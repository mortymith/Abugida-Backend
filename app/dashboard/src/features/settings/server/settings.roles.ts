import { createServerFn } from '@tanstack/react-start'
import type { RolesPage } from '../settings.types'
import { createCustomRoleSchema, saveRolePermissionsSchema } from '../schemas/settings.schema'

/**
 * Client-safe S-6.9 Roles & Permissions server functions.
 */

export const getRolesPage = createServerFn({ method: 'GET' }).handler(
  async (): Promise<RolesPage> => {
    const { getRolesPageImpl } = await import('./settings.roles.impl.server')
    return getRolesPageImpl()
  },
)

export const saveRolePermissions = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveRolePermissionsSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveRolePermissionsImpl } = await import('./settings.roles.impl.server')
    return saveRolePermissionsImpl(data)
  })

export const createCustomRole = createServerFn({ method: 'POST' })
  .validator((input: unknown) => createCustomRoleSchema.parse(input))
  .handler(async ({ data }) => {
    const { createCustomRoleImpl } = await import('./settings.roles.impl.server')
    return createCustomRoleImpl(data)
  })
