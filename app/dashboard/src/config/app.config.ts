import { config } from 'dotenv'
import { z } from 'zod/v4'
import { applyAuthEnvIssues, authEnvShape } from '@abugida/auth/env'

config()

/**
 * The environment contract is split in two on purpose:
 *
 *  - `authEnvShape` (`@abugida/auth/env`) declares every variable
 *    authentication needs — secret, origins, mount path, OAuth credentials,
 *    token issuance, two-factor and organization policy — so the dashboard and
 *    the API cannot drift on a name, a default, or a secret rule. Validation of
 *    those keys happens when `resolveAuthEnv()` projects them for
 *    `createAbugidaAuth()`.
 *  - this file declares what is specific to the dashboard: browser-visible
 *    (`VITE_*`) values, product copy defaults and the integrations the
 *    dashboard's server bridges own.
 */
const envSchema = z
  .object({
    ...authEnvShape,

    ENVIRONMENT: z.enum(['development', 'production', 'test']).default('development'),
    APP_NAME: z.string().default('Abugida Academy'),
    DATABASE_URL: z.url(),
    VITE_AUTH_BASE_PATH: z.string().startsWith('/').default('/auth'),
    LOGIN_PATH: z.string().default('/login'),
    DEFAULT_LOGIN_REDIRECT: z.string().default('/dashboard'),
    /** Attempts the MFA screen allows before it defers to the server's counter. */
    MFA_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    VITE_MFA_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    WORKSPACE_DOMAIN: z.string().default('abugida.app'),
    VITE_APP_NAME: z.string().default('Abugida Academy'),
    VITE_WORKSPACE_DOMAIN: z.string().default('abugida.app'),
    VITE_LOGIN_PATH: z.string().default('/login'),
    VITE_DEFAULT_LOGIN_REDIRECT: z.string().default('/dashboard'),
    COURSE_PREVIEW_URL: z.url().optional(),

    // ── Object storage (Content Library) ────────────────────────────────
    // Optional so the dashboard can start without storage; the Library
    // server bridge returns STORAGE_NOT_CONFIGURED until these are present.
    STORAGE_PROVIDER: z.enum(['aws-s3', 'minio', 'r2', 'spaces', 'wasabi', 'b2']).optional(),
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_PUBLIC_ENDPOINT: z.string().optional(),
    STORAGE_REGION: z.string().optional(),
    STORAGE_ACCESS_KEY_ID: z.string().optional(),
    STORAGE_SECRET_ACCESS_KEY: z.string().optional(),
    STORAGE_BUCKET: z.string().optional(),
    STORAGE_FORCE_PATH_STYLE: z.enum(['true', 'false']).optional(),
    STORAGE_MAX_ATTEMPTS: z.coerce.number().int().positive().optional(),
    STORAGE_REQUEST_TIMEOUT: z.coerce.number().int().positive().optional(),
    STORAGE_CONNECTION_TIMEOUT: z.coerce.number().int().positive().optional(),

    // ── Queue transport (spec 10 marketing sends via EMAIL_NOTIFICATION) ──
    REDIS_HOST: z.string().default('localhost'),
    REDIS_PORT: z.coerce.number().int().positive().default(6379),
    REDIS_PASSWORD: z.string().optional(),
    REDIS_DB: z.coerce.number().int().min(0).max(15).optional(),

    // ── AI generation (spec 04 S-2.11 / S-2.16) ─────────────────────────
    // Optional: with none set, the deterministic local generator is used.
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),

    // ── Transcription (spec 05 S-3.6) ───────────────────────────────────
    // Optional: enables Auto-Transcribe against an OpenAI-compatible
    // /audio/transcriptions endpoint. Unset → the UI degrades honestly and
    // segments can still be authored manually or imported from .srt/.vtt.
    TRANSCRIPTION_API_KEY: z.string().optional(),
    TRANSCRIPTION_BASE_URL: z.string().optional(),
    TRANSCRIPTION_MODEL: z.string().optional(),

    // ── Observability ──────────────────────────────────────────────────
    OTEL_SERVICE_NAME: z.string().default('dashboard'),
    OTEL_SERVICE_VERSION: z.string().default('0.0.1'),
    OTEL_DEPLOYMENT_ENVIRONMENT: z.string().optional(),
    OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
    OTEL_TRACES_EXPORTER: z.enum(['otlp', 'jaeger', 'zipkin', 'console', 'none']).default('otlp'),
    OTEL_METRICS_EXPORTER: z.enum(['otlp', 'console', 'none']).default('otlp'),
    OTEL_TRACES_SAMPLER: z.string().default('parentbased_always_on'),
    OTEL_TRACES_SAMPLER_ARG: z.coerce.number().default(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((env, ctx) => {
    // Auth cross-field rules (OAuth credential pairs) live with the keys they
    // describe, and fail here rather than later at auth-module import.
    applyAuthEnvIssues(env, ctx)
  })

export const env = envSchema.parse(process.env)

/** Raw STORAGE_* values for @abugida/storage's environment adapter. */
export const storageEnv = {
  STORAGE_PROVIDER: env.STORAGE_PROVIDER,
  STORAGE_ENDPOINT: env.STORAGE_ENDPOINT,
  STORAGE_PUBLIC_ENDPOINT: env.STORAGE_PUBLIC_ENDPOINT,
  STORAGE_REGION: env.STORAGE_REGION,
  STORAGE_ACCESS_KEY_ID: env.STORAGE_ACCESS_KEY_ID,
  STORAGE_SECRET_ACCESS_KEY: env.STORAGE_SECRET_ACCESS_KEY,
  STORAGE_BUCKET: env.STORAGE_BUCKET,
  STORAGE_FORCE_PATH_STYLE: env.STORAGE_FORCE_PATH_STYLE,
  STORAGE_MAX_ATTEMPTS: env.STORAGE_MAX_ATTEMPTS?.toString(),
  STORAGE_REQUEST_TIMEOUT: env.STORAGE_REQUEST_TIMEOUT?.toString(),
  STORAGE_CONNECTION_TIMEOUT: env.STORAGE_CONNECTION_TIMEOUT?.toString(),
}
