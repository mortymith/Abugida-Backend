import { createServerFn } from '@tanstack/react-start'
import type { IntegrationsPage } from '../settings.types'
import {
  saveAnalyticsIntegrationSchema,
  saveEmailIntegrationSchema,
  savePaymentGatewayConfigSchema,
  togglePaymentGatewaySchema,
} from '../schemas/settings.schema'

/**
 * Client-safe S-6.3 Integrations server functions. Credential values are
 * write-only — reads return presence booleans, never secrets.
 */

export const getIntegrations = createServerFn({ method: 'GET' }).handler(
  async (): Promise<IntegrationsPage> => {
    const { getIntegrationsImpl } = await import('./settings.integrations.impl.server')
    return getIntegrationsImpl()
  },
)

export const saveEmailIntegration = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveEmailIntegrationSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveEmailIntegrationImpl } = await import('./settings.integrations.impl.server')
    return saveEmailIntegrationImpl(data)
  })

export const saveAnalyticsIntegration = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveAnalyticsIntegrationSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveAnalyticsIntegrationImpl } = await import('./settings.integrations.impl.server')
    return saveAnalyticsIntegrationImpl(data)
  })

export const togglePaymentGateway = createServerFn({ method: 'POST' })
  .validator((input: unknown) => togglePaymentGatewaySchema.parse(input))
  .handler(async ({ data }) => {
    const { togglePaymentGatewayImpl } = await import('./settings.integrations.impl.server')
    return togglePaymentGatewayImpl(data)
  })

export const savePaymentGatewayConfig = createServerFn({ method: 'POST' })
  .validator((input: unknown) => savePaymentGatewayConfigSchema.parse(input))
  .handler(async ({ data }) => {
    const { savePaymentGatewayConfigImpl } = await import('./settings.integrations.impl.server')
    return savePaymentGatewayConfigImpl(data)
  })
