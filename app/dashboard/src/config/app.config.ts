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
    AUTH_BASE_PATH: z.string().default('/api/auth'),
    VITE_AUTH_BASE_URL: z.url().default('http://localhost:3000/api/auth'),
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
