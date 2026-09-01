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

export { appConfig, parseAppConfig } from './app_config'
export type { AppConfig } from './app_config'

export { databaseConfig } from './database'
export type { DatabaseConfig } from './database'

export { authConfig, createAuthInstance } from './auth'

export { queueConfig, createQueue } from './queue'
export type { QueueClient } from '@abugida/queue'

export { observabilityConfig, init, shutdown, logger } from './observability'

export { rateLimitConfig, createRateLimiters, RateLimitExceededError } from './rate-limit'
export type {
  RateLimiters,
  RateLimiter,
  RateLimitLimits,
  RateLimitConsumeResult,
} from './rate-limit'
