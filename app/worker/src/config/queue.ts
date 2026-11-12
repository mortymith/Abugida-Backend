/**
 * @module queue
 *
 * Worker-specific queue composition. Maps the validated worker environment
 * onto the shared `@abugida/queue` (BullMQ over Redis) configuration.
 *
 * Direction:
 *   workerEnv → queue → @abugida/queue
 *
 * Generic Redis connection management lives in `@abugida/queue`; this module
 * only supplies the worker's resolved settings.
 */

import { mergeWithDefaults, type QueueConfig } from '@abugida/queue'
import { workerEnv } from './env'

type QueueEnv = 'development' | 'staging' | 'production'
type QueueLogLevel = 'debug' | 'info' | 'warn' | 'error'

/** Map the worker environment onto the queue package's narrower union. */
function resolveEnv(): QueueEnv {
  if (workerEnv.NODE_ENV === 'production') return 'production'
  if (workerEnv.NODE_ENV === 'staging') return 'staging'
  return 'development'
}

/** Map the application log level onto the queue package's level union. */
function resolveLogLevel(): QueueLogLevel {
  switch (workerEnv.LOG_LEVEL) {
    case 'fatal':
      return 'error'
    case 'trace':
      return 'debug'
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      return workerEnv.LOG_LEVEL
  }
}

/** JSON logs outside local development; pretty output for the dev loop. */
function resolveLogFormat(): 'json' | 'pretty' {
  return workerEnv.NODE_ENV === 'development' || workerEnv.NODE_ENV === 'test' ? 'pretty' : 'json'
}

function buildQueueConfig(): QueueConfig {
  const env = resolveEnv()
  return mergeWithDefaults(
    {
      env,
      redis: {
        hostname: workerEnv.REDIS_HOST,
        port: workerEnv.REDIS_PORT,
        db: workerEnv.REDIS_DB,
        tls: workerEnv.REDIS_TLS,
        ...(workerEnv.REDIS_USERNAME ? { username: workerEnv.REDIS_USERNAME } : {}),
        ...(workerEnv.REDIS_PASSWORD ? { password: workerEnv.REDIS_PASSWORD } : {}),
      },
      logging: { level: resolveLogLevel(), format: resolveLogFormat() },
    },
    env,
  )
}

/** The queue configuration the worker connects BullMQ to. */
export const queueConfig: QueueConfig = buildQueueConfig()
