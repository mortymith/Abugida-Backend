import { createServerFn } from '@tanstack/react-start'
import type { BillingPage } from '../settings.types'

/**
 * Client-safe S-6.6 Billing & Subscription server functions.
 */

export const getBillingPage = createServerFn({ method: 'GET' }).handler(
  async (): Promise<BillingPage> => {
    const { getBillingPageImpl } = await import('./settings.billing.impl.server')
    return getBillingPageImpl()
  },
)
