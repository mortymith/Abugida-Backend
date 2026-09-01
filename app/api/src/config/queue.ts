/**
 * @module queue
 *
 * API-specific queue composition. Maps the validated application config onto
 * the shared `@abugida/queue` (BullMQ over Redis) configuration and exposes a
 * client factory for producers.
 *
 * Direction:
 *   app_config → queue → @abugida/queue
 *
 * Generic Redis connection management lives in `@abugida/queue`; this module
 * only supplies the API's resolved settings.
 */

import {
  mergeWithDefaults,
  createQueueClient,
  type QueueClient,
  type QueueConfig,
} from '@abugida/queue'
import { appConfig } from './app_config'

type QueueEnv = 'development' | 'staging' | 'production'
type QueueLogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Map the application environment onto the queue package's narrower union. */
function resolveEnv(): QueueEnv {
  if (appConfig.NODE_ENV === 'production') return 'production'
  if (appConfig.NODE_ENV === 'staging') return 'staging'
  return 'development'
}

/** Map the application log level onto the queue package's level union. */
function resolveLogLevel(): QueueLogLevel {
  switch (appConfig.LOG_LEVEL) {
    case 'fatal':
      return 'error'
    case 'trace':
      return 'debug'
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      return appConfig.LOG_LEVEL
  }
}

/** JSON logs outside local development; pretty output for the dev loop. */
function resolveLogFormat(): 'json' | 'pretty' {
  return appConfig.NODE_ENV === 'development' || appConfig.NODE_ENV === 'test' ? 'pretty' : 'json'
}

function buildQueueConfig(): QueueConfig {
  const env = resolveEnv()
  return mergeWithDefaults(
    {
      env,
      redis: {
        hostname: appConfig.REDIS_HOST,
        port: appConfig.REDIS_PORT,
        db: appConfig.REDIS_DB,
        tls: appConfig.REDIS_TLS,
        ...(appConfig.REDIS_USERNAME ? { username: appConfig.REDIS_USERNAME } : {}),
        ...(appConfig.REDIS_PASSWORD ? { password: appConfig.REDIS_PASSWORD } : {}),
      },
      logging: { level: resolveLogLevel(), format: resolveLogFormat() },
    },
    env,
  )
}

export const queueConfig: QueueConfig = buildQueueConfig()

/** Create a queue producer bound to the validated queue configuration. */
export function createQueue(): QueueClient {
  return createQueueClient(queueConfig)
}
