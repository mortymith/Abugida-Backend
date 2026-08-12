/**
 * @module monitoring/logger
 * @description Structured logging with correlation IDs and configurable
 * output format. Supports JSON (for production) and pretty-printed
 * (for development) formats.
 */

import type { QueueConfig } from "../config/schema.js";
import { detectEnvironment } from "../config/env.js";

// ---------------------------------------------------------------------------
// Log Level
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ---------------------------------------------------------------------------
// Logger Instance
// ---------------------------------------------------------------------------

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}

// ---------------------------------------------------------------------------
// Factory (cached per config)
// ---------------------------------------------------------------------------

const loggerCache = new Map<string, Logger>();

/**
 * Get or create a logger for the given configuration.
 */
export function getLogger(config?: QueueConfig): Logger {
  if (!config) {
    config = {
      logging: {
        level: detectEnvironment() === "production" ? "info" : "debug",
        format: detectEnvironment() === "production" ? "json" : "pretty",
      },
    } as QueueConfig;
  }

  const cacheKey = `${config.logging.level}:${config.logging.format}`;
  const cached = loggerCache.get(cacheKey);
  if (cached) return cached;

  const logger = createLogger(config);
  loggerCache.set(cacheKey, logger);
  return logger;
}

function createLogger(config: QueueConfig): Logger {
  const { level, format } = config.logging;

  function shouldLog(msgLevel: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[msgLevel] >= LOG_LEVEL_PRIORITY[level];
  }

  function formatMessage(msgLevel: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString();

    if (format === "json") {
      return JSON.stringify({
        timestamp,
        level: msgLevel,
        message,
        ...meta,
      });
    }

    // Pretty format
    const metaStr = meta ? " " + JSON.stringify(meta) : "";
    const color =
      msgLevel === "error"
        ? "\x1b[31m"
        : msgLevel === "warn"
          ? "\x1b[33m"
          : msgLevel === "info"
            ? "\x1b[36m"
            : "\x1b[90m";
    const reset = "\x1b[0m";
    return `${color}[${timestamp}] ${msgLevel.toUpperCase()}${reset} ${message}${metaStr}`;
  }

  function log(msgLevel: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!shouldLog(msgLevel)) return;
    const formatted = formatMessage(msgLevel, message, meta);
    switch (msgLevel) {
      case "error":
        process.stderr.write(formatted + "\n");
        break;
      default:
        process.stdout.write(formatted + "\n");
    }
  }

  return {
    debug: (message, meta) => log("debug", message, meta),
    info: (message, meta) => log("info", message, meta),
    warn: (message, meta) => log("warn", message, meta),
    error: (message, meta) => log("error", message, meta),
    child: (extraMeta) => ({
      debug: (message, meta) => log("debug", message, { ...extraMeta, ...meta }),
      info: (message, meta) => log("info", message, { ...extraMeta, ...meta }),
      warn: (message, meta) => log("warn", message, { ...extraMeta, ...meta }),
      error: (message, meta) => log("error", message, { ...extraMeta, ...meta }),
      child: (moreMeta) => createLogger(config).child({ ...extraMeta, ...moreMeta }),
    }),
  };
}
