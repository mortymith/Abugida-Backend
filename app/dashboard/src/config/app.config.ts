import { config } from 'dotenv'
import { z } from 'zod/v4'

config()

const envSchema = z
  .object({
    ENVIRONMENT: z.enum(['development', 'production', 'test']).default('development'),
    APP_NAME: z.string().default('Abugida Academy'),
    DATABASE_URL: z.url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    AUTH_BASE_URL: z.url(),
    AUTH_BASE_PATH: z.string().default('/auth'),
    VITE_AUTH_BASE_PATH: z.string().startsWith('/').default('/auth'),
    LOGIN_PATH: z.string().default('/login'),
    DEFAULT_LOGIN_REDIRECT: z.string().default('/dashboard'),
    TOTP_ISSUER: z.string().default('Abugida Academy'),
    TWO_FACTOR_COOKIE_MAX_AGE: z.coerce.number().int().positive().default(600),
    TRUST_DEVICE_MAX_AGE: z.coerce.number().int().positive().default(2592000),
    ACCOUNT_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    ACCOUNT_LOCKOUT_DURATION: z.coerce.number().int().positive().default(600),
    MFA_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    VITE_MFA_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    WORKSPACE_DOMAIN: z.string().default('abugida.app'),
    VITE_APP_NAME: z.string().default('Abugida Academy'),
    VITE_WORKSPACE_DOMAIN: z.string().default('abugida.app'),
    VITE_LOGIN_PATH: z.string().default('/login'),
    VITE_DEFAULT_LOGIN_REDIRECT: z.string().default('/dashboard'),
    AUTH_CALLBACK_URL: z.string().optional(),
    AUTH_ERROR_CALLBACK_URL: z.string().optional(),
    AUTH_NEW_USER_CALLBACK_URL: z.string().optional(),
    WEB_APP_URL: z.string().optional(),
    TOKEN_AUDIENCE: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    TELEGRAM_OIDC_CLIENT_ID: z.string().optional(),
    TELEGRAM_OIDC_CLIENT_SECRET: z.string().optional(),

    // ── AI generation (spec 04 S-2.11 / S-2.16) ─────────────────────────
    // Optional: with none set, the deterministic local generator is used.
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    AI_MODEL: z.string().optional(),

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
  .refine(
    (data) => {
      if (data.GOOGLE_CLIENT_ID && !data.GOOGLE_CLIENT_SECRET) return false
      if (!data.GOOGLE_CLIENT_ID && data.GOOGLE_CLIENT_SECRET) return false
      return true
    },
    { message: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be provided' },
  )
  .refine(
    (data) => {
      if (data.TELEGRAM_OIDC_CLIENT_ID && !data.TELEGRAM_OIDC_CLIENT_SECRET) return false
      if (!data.TELEGRAM_OIDC_CLIENT_ID && data.TELEGRAM_OIDC_CLIENT_SECRET) return false
      return true
    },
    {
      message: 'TELEGRAM_OIDC_CLIENT_ID and TELEGRAM_OIDC_CLIENT_SECRET must both be provided',
    },
  )

export const env = envSchema.parse(process.env)
