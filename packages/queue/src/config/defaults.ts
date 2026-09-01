/**
 * @module config/defaults
 * @description Sensible default configuration values for each environment.
 * Users can import these and override specific fields.
 */

import type { QueueConfig } from "./schema.js";

// ---------------------------------------------------------------------------
// Redis Defaults
// ---------------------------------------------------------------------------

export const REDIS_DEFAULTS = {
  hostname: "localhost",
  port: 6379,
  db: 0,
  tls: false,
} as const;

// ---------------------------------------------------------------------------
// Monitoring Defaults
// ---------------------------------------------------------------------------

export const MONITORING_DEFAULTS = {
  enabled: true,
  metricsPrefix: "abugida:queue:metrics",
  healthCheckEndpoint: "/health/queue",
} as const;

// ---------------------------------------------------------------------------
// Logging Defaults
// ---------------------------------------------------------------------------

export const LOGGING_DEFAULTS = {
  development: { level: "debug" as const, format: "pretty" as const },
  staging: { level: "debug" as const, format: "json" as const },
  production: { level: "info" as const, format: "json" as const },
};

// ---------------------------------------------------------------------------
// Environment-based Defaults
// ---------------------------------------------------------------------------

export function getDefaultConfig(env: "development" | "staging" | "production" = "development"): QueueConfig {
  const redisUsername = process.env.REDIS_USERNAME;
  const redisPassword = process.env.REDIS_PASSWORD;

  return {
    env,
    redis: {
      ...REDIS_DEFAULTS,
      hostname:
        env === "production"
          ? (process.env.REDIS_HOST ?? "redis.production.internal")
          : env === "staging"
            ? (process.env.REDIS_HOST ?? "redis.staging.internal")
            : "localhost",
      port: parseInt(process.env.REDIS_PORT ?? "6379", 10),
      ...(redisUsername ? { username: redisUsername } : {}),
      ...(redisPassword ? { password: redisPassword } : {}),
      db: parseInt(process.env.REDIS_DB ?? "0", 10),
      tls: env === "production",
    },
    queues: {},
    monitoring: { ...MONITORING_DEFAULTS },
    logging: { ...LOGGING_DEFAULTS[env] },
  };
}

// ---------------------------------------------------------------------------
// Merge helper
// ---------------------------------------------------------------------------

/**
 * Deep-merge user overrides onto environment defaults.
 * Only shallow-overrides at the top level (redis, monitoring, logging) –
 * queue-specific overrides are additive.
 */
export function mergeWithDefaults(
  overrides: Partial<QueueConfig>,
  env: "development" | "staging" | "production" = "development"
): QueueConfig {
  const base = getDefaultConfig(env);

  return {
    env: overrides.env ?? base.env ?? env,
    redis: {
      ...base.redis,
      ...overrides.redis,
    },
    queues: {
      ...base.queues,
      ...overrides.queues,
    },
    monitoring: {
      ...base.monitoring,
      ...overrides.monitoring,
    },
    logging: {
      ...base.logging,
      ...overrides.logging,
    },
  };
}
