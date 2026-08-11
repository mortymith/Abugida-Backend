/**
 * @module core/environment
 *
 * Small helpers so consumers (and this package's own code) don't repeat
 * `config.environment === "production"` string comparisons everywhere.
 */

import type { AuthConfig, AuthEnvironment } from "./types";

export function isProduction(config: Pick<AuthConfig, "environment">): boolean {
  return config.environment === "production";
}

export function isDevelopment(config: Pick<AuthConfig, "environment">): boolean {
  return config.environment === "development";
}

export function isTest(config: Pick<AuthConfig, "environment">): boolean {
  return config.environment === "test";
}

/** Parses `process.env.NODE_ENV` (or an arbitrary string) into an AuthEnvironment, defaulting to "development". */
export function parseEnvironment(value: string | undefined): AuthEnvironment {
  if (value === "production" || value === "test" || value === "development") {
    return value;
  }
  return "development";
}
