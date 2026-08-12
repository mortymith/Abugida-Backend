/**
 * @module config/schema
 * @description Zod-less configuration schema with TypeScript interfaces.
 * This is the canonical config shape consumed by the factory.
 */

/**
 * Redis connection configuration for Bun's native {@link RedisClient}.
 */
export interface RedisConfig {
  /** Redis hostname or IP. Default: `"localhost"`. */
  hostname: string;
  /** Redis port. Default: `6379`. */
  port: number;
  /** Optional password for AUTH. */
  password?: string;
  /** Redis database index (0-15). Default: `0`. */
  db?: number;
  /** Enable TLS (required in production). Default: `false`. */
  tls?: boolean;
  /** Connection timeout in ms. Default: `10000`. */
  connectionTimeout?: number;
  /** Automatically reconnect on an unexpected disconnect. Default: `true`. */
  autoReconnect?: boolean;
  /** Maximum reconnection attempts. Default: `10`. */
  maxRetries?: number;
  /** Queue commands while disconnected instead of failing immediately. Default: `true`. */
  enableOfflineQueue?: boolean;
  /** Coalesce pipelined commands into a single write. Default: `true`. */
  enableAutoPipelining?: boolean;
}

/**
 * Per-queue configuration overrides.
 */
export interface QueueSpecificConfig {
  /** Max concurrent jobs for this queue's worker. */
  concurrency?: number;
  /** Interval in ms at which to check for stalled jobs. Default: `30000`. */
  stalledInterval?: number;
  /** Rate limiter – max jobs per duration window. */
  limiter?: {
    max: number;
    duration: number;
  };
  /** Default job options applied to every job in this queue. */
  defaultJobOptions?: {
    /** Number of retry attempts. Default: `3`. */
    attempts?: number;
    /** Job timeout in ms. Default: no timeout. */
    timeout?: number;
    /** Backoff strategy for retries. */
    backoff?: {
      type: "fixed" | "exponential";
      delay: number;
    };
    /** Remove completed jobs (true) or keep N most recent (number). Default: `false`. */
    removeOnComplete?: boolean | number;
    /** Remove failed jobs (true) or keep N most recent (number). Default: `false`. */
    removeOnFail?: boolean | number;
  };
}

/**
 * Monitoring configuration.
 */
export interface MonitoringConfig {
  /** Enable health checks and metrics collection. Default: `true`. */
  enabled: boolean;
  /** Prefix for metrics keys in Redis. Default: `"abugida:queue:metrics"`. */
  metricsPrefix?: string;
  /** HTTP path for health check endpoint. Default: `"/health/queue"`. */
  healthCheckEndpoint?: string;
}

/**
 * Logging configuration.
 */
export interface LoggingConfig {
  /** Minimum log level. Default: `"info"`. */
  level: "debug" | "info" | "warn" | "error";
  /** Output format. Default: `"json"` in production, `"pretty"` in development. */
  format: "json" | "pretty";
}

/**
 * Top-level queue configuration.
 * Construct via {@link mergeWithDefaults} or provide directly to the factory.
 */
export interface QueueConfig {
  /** Application environment label. */
  env?: "development" | "staging" | "production";
  /** Redis connection parameters. */
  redis: RedisConfig;
  /** Per-queue overrides keyed by queue name. */
  queues: Record<string, QueueSpecificConfig>;
  /** Monitoring settings. */
  monitoring: MonitoringConfig;
  /** Logging settings. */
  logging: LoggingConfig;
}
