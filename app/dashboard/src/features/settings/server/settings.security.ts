import { createServerFn } from '@tanstack/react-start'
import type { AuditLogPage, SecurityPolicies } from '../settings.types'
import { auditLogQuerySchema, saveSecurityPoliciesSchema } from '../schemas/settings.schema'

/**
 * Client-safe S-6.8 Security & Audit Log server functions. The audit log is
 * append-only — this module exposes reads, filters, and CSV export only.
 */

export const getSecurityPolicies = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SecurityPolicies> => {
    const { getSecurityPoliciesImpl } = await import('./settings.security.impl.server')
    return getSecurityPoliciesImpl()
  },
)

export const saveSecurityPolicies = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveSecurityPoliciesSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveSecurityPoliciesImpl } = await import('./settings.security.impl.server')
    return saveSecurityPoliciesImpl(data)
  })

export const getAuditLog = createServerFn({ method: 'GET' })
  .validator((input: unknown) => auditLogQuerySchema.parse(input))
  .handler(async ({ data }): Promise<AuditLogPage> => {
    const { getAuditLogImpl } = await import('./settings.security.impl.server')
    return getAuditLogImpl(data)
  })

export const exportAuditLogCsv = createServerFn({ method: 'POST' })
  .validator((input: unknown) => auditLogQuerySchema.parse(input))
  .handler(async ({ data }): Promise<{ fileName: string; csv: string }> => {
    const { exportAuditLogCsvImpl } = await import('./settings.security.impl.server')
    return exportAuditLogCsvImpl(data)
  })
