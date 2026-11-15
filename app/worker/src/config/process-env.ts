/**
 * @module config/process-env
 * @description Raw `process.env` readers for values the worker's validated
 * configuration does not model.
 *
 * The worker's own settings (Redis, queue selection, observability) come from
 * the validated Zod schema in {@link ./app_config.ts}. The provider
 * integrations, however, read their own optional knobs — a gateway timeout, an
 * API version — straight from the environment, because those values belong to
 * the provider's configuration and not to the worker's.
 *
 * Secrets are never logged and never validated here; a missing value simply
 * falls back to the provider's own default.
 */

/**
 * Read a numeric environment variable, falling back to `fallback` when it is
 * unset or not a number.
 */
export function envNumber(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw.length === 0) return fallback
  const parsed = Number(raw)
  return Number.isNaN(parsed) ? fallback : parsed
}
