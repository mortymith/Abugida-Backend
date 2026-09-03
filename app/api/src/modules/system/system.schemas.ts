/**
 * @module system.schemas
 *
 * Zod schemas for the system module — health checks and root endpoint.
 */

import { z } from '@hono/zod-openapi'

// ── Shared ──────────────────────────────────────────────────────────────

const TimestampSchema = z.string().datetime().openapi({ example: '2026-04-30T14:30:00.000Z' })

const DependencyStatusSchema = z.enum(['ok', 'degraded', 'unavailable']).openapi({ example: 'ok' })

// ── GET / (root) ────────────────────────────────────────────────────────

export const RootResponseSchema = z.string().openapi({
  description: 'API welcome message',
  example: 'Hello Hono!',
})

// ── GET /health (liveness) ──────────────────────────────────────────────

export const HealthLivenessResponseSchema = z
  .object({
    status: z.enum(['ok']).openapi({ example: 'ok' }),
    uptime: z.number().openapi({ example: 123456.78, description: 'Process uptime in seconds' }),
    version: z.string().openapi({ example: '2.0.0', description: 'Deployed API version' }),
    timestamp: TimestampSchema,
  })
  .openapi('HealthLiveness')

// ── GET /health/ready (readiness) ───────────────────────────────────────

export const HealthReadinessChecksSchema = z
  .object({
    database: DependencyStatusSchema,
    sms_provider: DependencyStatusSchema,
    payment_gateway: DependencyStatusSchema,
  })
  .openapi('HealthReadinessChecks')

export const HealthReadinessResponseSchema = z
  .object({
    status: z.enum(['ok']).openapi({ example: 'ok' }),
    checks: HealthReadinessChecksSchema,
    timestamp: TimestampSchema,
  })
  .openapi('HealthReadiness')
