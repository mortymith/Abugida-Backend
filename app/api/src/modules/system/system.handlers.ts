/**
 * @module system.handlers
 *
 * Route handler implementations for the system module — root, liveness,
 * and readiness probes.
 */

import type { Context } from 'hono'
import type { AppEnv } from '@/middleware/types'
import { pool } from '@/config/database'
import { appConfig } from '@/config/app_config'
import { rootRoute, healthLivenessRoute, healthReadinessRoute } from './system.routes'

// ── Process start time (module-level) ───────────────────────────────────

const processStartedAt = Date.now()

// ── Health-check helpers ────────────────────────────────────────────────

async function checkPostgres(): Promise<'ok' | 'degraded' | 'unavailable'> {
  try {
    await pool.query('SELECT 1')
    return 'ok'
  } catch {
    return 'unavailable'
  }
}

async function checkSmsProvider(): Promise<'ok' | 'degraded' | 'unavailable'> {
  return 'unavailable'
}

async function checkPaymentGateway(): Promise<'ok' | 'degraded' | 'unavailable'> {
  return 'unavailable'
}

// ── Handlers ────────────────────────────────────────────────────────────

export function createSystemHandlers() {
  return {
    async root(c: Context<AppEnv>) {
      return c.text('Hello Hono!')
    },

    async healthLiveness(c: Context<AppEnv>) {
      return c.json({
        status: 'ok' as const,
        uptime: (Date.now() - processStartedAt) / 1000,
        version: appConfig.OTEL_SERVICE_VERSION,
        timestamp: new Date().toISOString(),
      })
    },

    async healthReadiness(c: Context<AppEnv>) {
      const [database, smsProvider, paymentGateway] = await Promise.all([
        checkPostgres(),
        checkSmsProvider(),
        checkPaymentGateway(),
      ])

      const allAvailable = [database, smsProvider, paymentGateway].every(
        (v) => v === 'ok' || v === 'unavailable',
      )

      return c.json(
        {
          status: 'ok' as const,
          checks: { database, sms_provider: smsProvider, payment_gateway: paymentGateway },
          timestamp: new Date().toISOString(),
        },
        allAvailable ? 200 : 503,
      )
    },
  }
}

// ── Route-to-handler mapping ────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (c: any) => Promise<any>

export function createSystemRouteMap(handlers: ReturnType<typeof createSystemHandlers>) {
  return [
    { route: rootRoute, handler: handlers.root as AnyHandler },
    { route: healthLivenessRoute, handler: handlers.healthLiveness as AnyHandler },
    { route: healthReadinessRoute, handler: handlers.healthReadiness as AnyHandler },
  ] as const
}
