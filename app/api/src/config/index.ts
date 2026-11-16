/**
 * @module config
 *
 * Public configuration entry point for the API application.
 *
 * `appConfig` is the single validated view of the environment; the remaining
 * modules compose shared infrastructure (database, auth, queue, observability,
 * rate limiting) from it. None of them read `process.env` for application
 * configuration.
 */

export { appConfig, parseAppConfig } from '#/src/config/app_config'
export type { AppConfig } from '#/src/config/app_config'

export { databaseConfig } from '#/src/config/database'
export type { DatabaseConfig } from '#/src/config/database'

export { createAuthInstance } from '#/src/config/auth'

export { queueConfig, createQueue } from '#/src/config/queue'
export type { QueueClient } from '@abugida/queue'

export { observabilityConfig, init, shutdown, logger } from '#/src/config/observability'

export {
  rateLimitConfig,
  createRateLimiters,
  RateLimitExceededError,
} from '#/src/config/rate-limit'
export type {
  RateLimiters,
  RateLimiter,
  RateLimitLimits,
  RateLimitConsumeResult,
} from '#/src/config/rate-limit'
