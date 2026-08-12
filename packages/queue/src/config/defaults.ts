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

export const LOGGING_DEFAULTS: Record<string, QueueConfig["logging"]> = {
  development: { level: "debug", format: "pretty" },
  staging: { level: "debug", format: "json" },
  production: { level: "info", format: "json" },
};

// ---------------------------------------------------------------------------
// Environment-based Defaults
// ---------------------------------------------------------------------------

export function getDefaultConfig(env: "development" | "staging" | "production" = "development"): QueueConfig {
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
      password: process.env.REDIS_PASSWORD,
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
    env: overrides.env ?? base.env,
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
