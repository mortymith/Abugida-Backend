/**
 * @module config/env
 * @description Environment detection and configuration helpers.
 * Reads from process.env to determine the current environment and
 * extracts common configuration values.
 */

export type Environment = "development" | "staging" | "production";

/**
 * Detect the current environment from `NODE_ENV` or `BUN_ENV`.
 * Falls back to `"development"`.
 */
export function detectEnvironment(): Environment {
  const env = process.env.NODE_ENV ?? process.env.BUN_ENV ?? "development";
  switch (env) {
    case "production":
      return "production";
    case "staging":
      return "staging";
    default:
      return "development";
  }
}

/**
 * Check if the current environment is production.
 */
export function isProduction(): boolean {
  return detectEnvironment() === "production";
}

/**
 * Check if the current environment is development.
 */
export function isDevelopment(): boolean {
  return detectEnvironment() === "development";
}

/**
 * Get the application name from env (used in worker IDs and metrics).
 */
export function getAppName(): string {
  return process.env.APP_NAME ?? "abugida-queue";
}

/**
 * Get the worker ID (unique per process). Combines app name with PID.
 */
export function getWorkerId(): string {
  return `${getAppName()}-worker-${process.pid}`;
}

/**
 * Require an env var or throw a helpful error.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${key}. ` +
        `Please set it in your .env file or environment configuration.`
    );
  }
  return value;
}

/**
 * Get an env var with a fallback default.
 */
export function envWithDefault(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

/**
 * Get an env var as a number with a fallback default.
 */
export function envNumber(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? defaultValue : parsed;
}
