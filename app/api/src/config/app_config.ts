/**
 * @module app_config
 *
 * Single source of truth for the API's environment configuration.
 *
 * Responsibilities:
 *  1. Load `.env` once via `dotenv/config`.
 *  2. Validate every variable the API needs against a Zod schema.
 *  3. Apply defaults and normalize values (strings → numbers/booleans).
 *  4. Fail fast with a human-readable error when configuration is invalid,
 *     without ever leaking secret values.
 *  5. Export a strongly-typed, validated `appConfig` object.
 *
 * Downstream configuration modules (`./database`, `./auth`, `./queue`,
 * `./observability`, `./rate-limit`) consume `appConfig` and never touch
 * `process.env` for application configuration.
 *
 * Authentication variables are *not* declared here: they come from
 * `authEnvShape` (`@abugida/auth/env`), which is the single declaration of
 * the auth environment contract in the monorepo. What stays here is the
 * API's own deployment policy — HTTPS-only origins in production, a provider
 * required in production, CORS origin syntax — plus everything that is not
 * about authentication.
 */

import 'dotenv/config'

import { z } from 'zod'
import { applyAuthEnvIssues, authEnvShape } from '@abugida/auth/env'
import { tenantEnvShape } from '@abugida/tenant/env'

// ---------------------------------------------------------------------------
// Shared scalar helpers
// ---------------------------------------------------------------------------

const ENV_NAMES = ['development', 'staging', 'production', 'test'] as const

const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const

const STORAGE_PROVIDERS = ['aws-s3', 'minio', 'r2', 'spaces', 'wasabi', 'b2'] as const

/** Parses `"true"`/`"1"` → true and `"false"`/`"0"` → false. Rejects anything else. */
const booleanFromEnv = z
  .enum(['true', 'false', '1', '0'])
  .default('false')
  .transform((value) => value === 'true' || value === '1')

const positiveIntFromEnv = z.coerce.number().int().positive()

/**
 * Merge `WEB_APP_URL` and the comma-separated `CORS_ORIGINS` into a single
 * deduplicated origin list consumed by the CORS middleware. `@abugida/auth`
 * builds the same list for Better Auth's trusted origins, from the same
 * variables.
 */
function buildCorsOrigins(
  authUrl: string,
  webAppUrl: string | undefined,
  corsOrigins: string | undefined,
): string[] {
  const origins = new Set<string>()
  // Better Auth validates the request Origin against this same allowlist. The
  // public API origin must therefore be trusted even when no separate browser
  // frontend has been configured.
  origins.add(new URL(authUrl).origin)
  if (webAppUrl) origins.add(webAppUrl)
  if (corsOrigins) {
    for (const part of corsOrigins.split(',')) {
      const origin = part.trim()
      if (origin) origins.add(origin)
    }
  }
  return [...origins]
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const appConfigSchema = z
  .object({
    // ── Auth (Better Auth) ─────────────────────────────────────────────────
    // Declared by `@abugida/auth/env`: secret, origins, mount path, OAuth
    // credentials, token issuance, auth rate limiting, two-factor policy and
    // the organization switch. Spreading it here means the API and the
    // dashboard cannot drift on a variable name, a default or a secret rule.
    ...authEnvShape,

    // ── Tenancy ────────────────────────────────────────────────────────────
    // Declared by `@abugida/tenant/env` (base domain, protocol, dev port,
    // platform subdomain) so the API and the dashboard resolve a hostname to
    // the same workspace. Projected in `./tenant`.
    ...tenantEnvShape,

    // ── Runtime identity ────────────────────────────────────────────────────
    // Both are set by the deployment: compose injects `ENVIRONMENT`, while Bun
    // and the API Docker image set `NODE_ENV`. `ENVIRONMENT` wins, and the
    // resolved value is exposed as `NODE_ENV` on the parsed config.
    ENVIRONMENT: z.enum(ENV_NAMES).optional(),
    NODE_ENV: z.enum(ENV_NAMES).optional(),
    // Dev default is 3001 so `pnpm dev` can run the API and the dashboard
    // (hardcoded to 3000) side by side. The container port is a deployment
    // concern and is pinned to 3000 in docker/compose/app.yml, which is what
    // Caddy (`api:3000`), the image healthcheck, and the published
    // `${API_PORT}:3000` mapping all expect.
    PORT: z.coerce.number().int().min(1).max(65535).default(3001),
    HOST: z.string().min(1).default('localhost'),
    LOG_LEVEL: z.enum(LOG_LEVELS).default('info'),

    // ── Database (PostgreSQL via PgBouncer, ADR-019) ───────────────────────
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required.'),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(20),

    // ── Auth (Better Auth) ─────────────────────────────────────────────────
    // JWT issuer / audience — opt-in token issuance for PowerSync. Requires
    // better-auth's generated `jwks` table in the Drizzle schema.

    // ── Queue (BullMQ / Redis) ──────────────────────────────────────────────
    REDIS_HOST: z.string().min(1).default('localhost'),
    REDIS_PORT: z.coerce.number().int().min(1).max(65535).default(6379),
    // ACL username (Redis 6+). The Abugida infra runs `user default off` and
    // exposes an `app` ACL user — set REDIS_USERNAME=app in development.
    REDIS_USERNAME: z.string().min(1).optional(),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().min(0).max(15).default(0),
    REDIS_TLS: booleanFromEnv,

    // ── Rate limiting (API spec NFR-403) ───────────────────────────────────
    // Window shared by every limiter.
    RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
    // Authenticated users: 100 req/min.
    RATE_LIMIT_AUTHENTICATED_PER_MINUTE: z.coerce.number().int().positive().default(100),
    // Unauthenticated IPs: 1000 req/min.
    RATE_LIMIT_ANONYMOUS_PER_MINUTE: z.coerce.number().int().positive().default(1000),

    // ── Proxy / networking ────────────────────────────────────────────────
    // Set to "true" when behind a trusted reverse proxy (Caddy) that overwrites
    // X-Forwarded-For. When false, the header is ignored and the raw connection
    // address is used for rate-limit keying.
    TRUST_PROXY: booleanFromEnv,

    // ── API contract ──────────────────────────────────────────────────────
    // Base URL for RFC 9457 problem+json `type` fields. Defaults to the
    // production domain; override for staging / custom deployments.
    ERROR_BASE_URL: z
      .string()
      .url('ERROR_BASE_URL must be a valid URL.')
      .default('https://api.abugida.com/errors'),

    // ── Health checks ─────────────────────────────────────────────────────
    HEALTH_CHECK_QUEUE_NAME: z.string().min(1).default('abugida.purchases'),

    // ── Logging ───────────────────────────────────────────────────────────
    // Requests slower than this (ms) trigger a warn-level log line.
    SLOW_REQUEST_THRESHOLD_MS: z.coerce.number().int().positive().default(1000),

    // ── Observability (Pino + OpenTelemetry) ───────────────────────────────
    OTEL_SERVICE_NAME: z.string().min(1).default('api'),
    OTEL_SERVICE_VERSION: z.string().min(1).default('0.0.1'),
    OTEL_DEPLOYMENT_ENVIRONMENT: z.string().min(1).optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z
      .string()
      .url('OTEL_EXPORTER_OTLP_ENDPOINT must be a valid URL.')
      .default('http://localhost:4318'),
    OTEL_TRACES_EXPORTER: z.enum(['otlp', 'jaeger', 'zipkin', 'console', 'none']).default('otlp'),
    OTEL_METRICS_EXPORTER: z.enum(['otlp', 'console', 'none']).default('otlp'),
    OTEL_TRACES_SAMPLER: z.string().min(1).default('parentbased_always_on'),
    OTEL_TRACES_SAMPLER_ARG: z.coerce.number().default(1),

    // ── Object storage (S3-compatible, ADR-008) ────────────────────────────
    STORAGE_PROVIDER: z.enum(STORAGE_PROVIDERS).optional(),
    STORAGE_ENDPOINT: z.string().url('STORAGE_ENDPOINT must be a valid URL.').optional(),
    STORAGE_REGION: z.string().min(1).default('us-east-1'),
    STORAGE_ACCESS_KEY_ID: z.string().min(1).optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    STORAGE_BUCKET: z.string().min(1).optional(),
    STORAGE_FORCE_PATH_STYLE: booleanFromEnv,
    STORAGE_MAX_ATTEMPTS: positiveIntFromEnv.optional(),
    STORAGE_REQUEST_TIMEOUT: positiveIntFromEnv.optional(),
    STORAGE_CONNECTION_TIMEOUT: positiveIntFromEnv.optional(),
  })
  .superRefine((env, ctx) => {
    const effectiveEnv = env.ENVIRONMENT ?? env.NODE_ENV ?? 'development'

    // DATABASE_URL must be a Postgres connection string — fail fast instead of
    // letting `pg` fail obscurely at first query.
    if (!/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
      ctx.addIssue({
        code: 'custom',
        path: ['DATABASE_URL'],
        message: 'DATABASE_URL must be a postgres:// or postgresql:// URL.',
      })
    }

    // Auth cross-field rules (OAuth credential pairs) are owned by
    // `@abugida/auth` and reported through this same error surface. This API
    // additionally requires a provider in production, below.
    applyAuthEnvIssues(env, ctx)

    // CORS_ORIGINS must be a comma-separated list of valid origins.
    if (env.CORS_ORIGINS) {
      for (const part of env.CORS_ORIGINS.split(',')) {
        const origin = part.trim()
        if (!origin) continue
        try {
          new URL(origin)
        } catch {
          ctx.addIssue({
            code: 'custom',
            path: ['CORS_ORIGINS'],
            message: `Invalid CORS origin: "${origin}".`,
          })
        }
      }
    }

    // Storage requires the same minimum set the shared storage package enforces.
    const hasProvider = Boolean(env.STORAGE_PROVIDER)
    const hasStorageCreds = Boolean(
      env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY && env.STORAGE_BUCKET,
    )
    if (hasProvider !== hasStorageCreds) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_PROVIDER'],
        message:
          'STORAGE_PROVIDER together with STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY and STORAGE_BUCKET must be set together (or all left unset).',
      })
    }

    // A configured provider requires a non-empty endpoint.
    if (hasProvider && !env.STORAGE_ENDPOINT) {
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_ENDPOINT'],
        message: 'STORAGE_ENDPOINT is required when STORAGE_PROVIDER is set.',
      })
    }

    // ── Production hardening ────────────────────────────────────────────────
    if (effectiveEnv === 'production') {
      if (!env.GOOGLE_CLIENT_ID && !env.TELEGRAM_OIDC_CLIENT_ID) {
        ctx.addIssue({
          code: 'custom',
          path: ['GOOGLE_CLIENT_ID'],
          message:
            'At least one OAuth provider (Google or Telegram) must be configured in production.',
        })
      }
      if (env.BETTER_AUTH_URL && !env.BETTER_AUTH_URL.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['BETTER_AUTH_URL'],
          message: 'BETTER_AUTH_URL must use https in production.',
        })
      }
      if (env.WEB_APP_URL && !env.WEB_APP_URL.startsWith('https://')) {
        ctx.addIssue({
          code: 'custom',
          path: ['WEB_APP_URL'],
          message: 'WEB_APP_URL must use https in production.',
        })
      }
      for (const [key, value] of [
        ['AUTH_CALLBACK_URL', env.AUTH_CALLBACK_URL],
        ['AUTH_ERROR_CALLBACK_URL', env.AUTH_ERROR_CALLBACK_URL],
        ['AUTH_NEW_USER_CALLBACK_URL', env.AUTH_NEW_USER_CALLBACK_URL],
      ] as const) {
        if (value && !value.startsWith('https://')) {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: `${key} must use https in production.`,
          })
        }
      }
      if (env.CORS_ORIGINS) {
        for (const part of env.CORS_ORIGINS.split(',')) {
          const origin = part.trim()
          if (origin && origin.startsWith('http://')) {
            ctx.addIssue({
              code: 'custom',
              path: ['CORS_ORIGINS'],
              message: 'CORS origins must use https in production.',
            })
          }
        }
      }
    }
  })
  .transform((env) => {
    const environment = env.ENVIRONMENT ?? env.NODE_ENV ?? 'development'
    return {
      ...env,
      NODE_ENV: environment,
      OTEL_DEPLOYMENT_ENVIRONMENT: env.OTEL_DEPLOYMENT_ENVIRONMENT ?? environment,
      corsOrigins: buildCorsOrigins(env.BETTER_AUTH_URL, env.WEB_APP_URL, env.CORS_ORIGINS),
    }
  })

export type AppConfig = z.infer<typeof appConfigSchema>

// ---------------------------------------------------------------------------
// Validation & error formatting
// ---------------------------------------------------------------------------

function formatConfigError(error: z.ZodError): string {
  const details = error.issues.map((issue) => {
    const path = issue.path.join('.')
    return `  - ${path}: ${issue.message}`
  })
  return [
    '[app-config] Invalid environment configuration.',
    'Fix the variables listed below, then restart. Secret values are never included in this report.',
    ...details,
  ].join('\n')
}

/**
 * Parse and validate the environment exactly once.
 *
 * The validation report names the offending variables and the problem without
 * echoing their values, so credentials (DATABASE_URL, BETTER_AUTH_SECRET,
 * REDIS_PASSWORD, STORAGE_*, OAuth secrets) are never logged.
 */
export function parseAppConfig(source: Record<string, unknown> = process.env): AppConfig {
  const result = appConfigSchema.safeParse(source)

  if (!result.success) {
    throw new Error(formatConfigError(result.error))
  }

  syncSharedEnv(result.data)
  return result.data
}

/**
 * Keys the shared packages resolve directly from `process.env` at init time
 * (`@abugida/observability` reads OTEL_* and LOG_LEVEL). Writing the
 * validated, normalized values back keeps the library observably consistent
 * with `appConfig` without duplicating parsing inside the library. This is
 * the single sanctioned `process.env` write in the configuration layer.
 */
function syncSharedEnv(config: AppConfig): void {
  const syncable: Array<[keyof AppConfig, string]> = [
    ['LOG_LEVEL', String(config.LOG_LEVEL)],
    ['OTEL_SERVICE_NAME', config.OTEL_SERVICE_NAME],
    ['OTEL_SERVICE_VERSION', config.OTEL_SERVICE_VERSION],
    ['OTEL_DEPLOYMENT_ENVIRONMENT', config.OTEL_DEPLOYMENT_ENVIRONMENT],
    ['OTEL_EXPORTER_OTLP_ENDPOINT', config.OTEL_EXPORTER_OTLP_ENDPOINT],
    ['OTEL_TRACES_EXPORTER', config.OTEL_TRACES_EXPORTER],
    ['OTEL_METRICS_EXPORTER', config.OTEL_METRICS_EXPORTER],
    ['OTEL_TRACES_SAMPLER', config.OTEL_TRACES_SAMPLER],
    ['OTEL_TRACES_SAMPLER_ARG', String(config.OTEL_TRACES_SAMPLER_ARG)],
  ]
  for (const [key, value] of syncable) {
    process.env[key] = value
  }
}

/**
 * The validated application configuration. Import this everywhere instead of
 * reading `process.env` directly.
 */
export const appConfig: AppConfig = parseAppConfig()
