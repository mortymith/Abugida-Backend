/**
 * @module config/env
 *
 * The canonical environment contract for authentication, owned by this
 * package.
 *
 * Apps spread {@link authEnvShape} into their own `z.object({...})` so a key
 * is declared exactly once in the monorepo, then hand the parsed object to
 * {@link resolveAuthEnv}. Nothing here reads `process.env` implicitly and
 * nothing here imports a database, a server plugin, or a framework — the
 * module is safe to import from any app config, including client-adjacent
 * ones.
 *
 * Secrets are validated here rather than per app: length, obvious
 * placeholders and pair-completeness of OAuth credentials are auth policy,
 * and two apps checking them differently is how a staging environment ends up
 * weaker than production.
 */

import { z } from 'zod'
import type {
  AuthEnvironment,
  ProvidersConfig,
  RateLimitConfig,
  TwoFactorConfig,
} from '../core/types'

const emptyToUndefined = (value: string): string | undefined =>
  value.trim() === '' ? undefined : value

// `.transform()` (rather than `z.preprocess`) so `.optional()` still
// short-circuits on `undefined`: an empty value in a .env file means "unset",
// not "invalid".
const optionalUrl = z
  .union([z.url(), z.literal('')])
  .transform(emptyToUndefined)
  .optional()
const optionalSecret = z.string().transform(emptyToUndefined).optional()

const WEAK_SECRETS = new Set([
  'admin',
  'abugida-secret',
  'better-auth-secret',
  'change-me',
  'change_me',
  'changeme',
  'default',
  'development-secret',
  'example',
  'insecure-secret',
  'password',
  'please-change-me',
  'replace-this',
  'secret',
  'test',
  'todo',
  'your-secret-here',
])

/**
 * Rejects the secrets that pass a length check but protect nothing: a known
 * placeholder, a single repeated character, or a short pattern repeated.
 */
function isWeakSecret(value: string): boolean {
  const lower = value.toLowerCase()
  if (WEAK_SECRETS.has(lower)) return true
  if (/^(.)\1+$/.test(lower)) return true
  const stripped = lower.replace(/[-_]/g, '')
  return /^(.{2,8})\1+$/.test(stripped)
}

/**
 * The auth-owned environment keys as a raw zod shape, for apps to spread into
 * their own object. Exported as a shape (not a schema) so an app can add its
 * own keys — and its own deployment-level refinements — without inheriting
 * this module's cross-field checks twice.
 */
export const authEnvShape = {
  // ── Secrets & origins ───────────────────────────────────────────────────
  BETTER_AUTH_SECRET: z
    .string()
    .min(
      32,
      'BETTER_AUTH_SECRET must be at least 32 characters (generate with `openssl rand -hex 32`).',
    )
    .refine((value) => !isWeakSecret(value), {
      message:
        'BETTER_AUTH_SECRET must not be a well-known placeholder or trivially guessable value.',
    }),
  // Public origin of the service that serves `/auth/*`. This is the
  // Better Auth `baseURL` and therefore the default token issuer.
  BETTER_AUTH_URL: z.url('BETTER_AUTH_URL must be a valid URL.'),
  /** Public origin of the browser app. Part of the trusted-origin allowlist. */
  WEB_APP_URL: optionalUrl,
  /** Extra browser/WebView origins, comma-separated. */
  CORS_ORIGINS: optionalSecret,

  // ── Mounting ────────────────────────────────────────────────────────────
  // Must match the path the app mounts better-auth's handler under.
  AUTH_BASE_PATH: z
    .string()
    .regex(/^\//, 'AUTH_BASE_PATH must start with a slash (e.g. /auth).')
    .refine((value) => value === '/' || !value.endsWith('/'), {
      message: 'AUTH_BASE_PATH must not end with a trailing slash (e.g. /auth, not /auth/).',
    })
    .default('/auth'),

  // ── Post-login destinations (owned by the server, never by the client) ──
  AUTH_CALLBACK_URL: optionalUrl,
  AUTH_ERROR_CALLBACK_URL: optionalUrl,
  AUTH_NEW_USER_CALLBACK_URL: optionalUrl,

  // ── OAuth providers ─────────────────────────────────────────────────────
  GOOGLE_CLIENT_ID: optionalSecret,
  GOOGLE_CLIENT_SECRET: optionalSecret,
  // Telegram sign-in runs exclusively through Telegram OIDC (oauth.telegram.org).
  // The secret is the BotFather "Web Login" client secret, NOT the bot token.
  TELEGRAM_OIDC_CLIENT_ID: optionalSecret,
  TELEGRAM_OIDC_CLIENT_SECRET: optionalSecret,

  // ── Token issuance (PowerSync and other service clients) ────────────────
  /** Overrides the JWT `iss` claim; defaults to BETTER_AUTH_URL. */
  AUTH_BASE_URL: optionalUrl,
  TOKEN_AUDIENCE: optionalSecret,

  // ── Rate limiting of the /auth endpoints ────────────────────────────────
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  AUTH_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),

  // ── Two-factor / account lockout ────────────────────────────────────────
  TOTP_ISSUER: z.string().min(1).default('Abugida Academy'),
  /** Lifetime of the short-lived "2FA verified" cookie. */
  TWO_FACTOR_COOKIE_MAX_AGE: z.coerce.number().int().positive().default(600),
  /** Lifetime of a trusted device cookie. */
  TRUST_DEVICE_MAX_AGE: z.coerce.number().int().positive().default(2592000),
  ACCOUNT_LOCKOUT_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  /** Lockout cooldown in seconds. better-auth's option is `durationSeconds`. */
  ACCOUNT_LOCKOUT_DURATION: z.coerce.number().int().positive().default(900),

  // ── Organizations ───────────────────────────────────────────────────────
  /** Whether a signed-in user may create their own workspace. */
  AUTH_ALLOW_USER_CREATED_ORGANIZATIONS: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .transform((value) => value === true || value === 'true')
    .default(true),
} satisfies z.ZodRawShape

/** The parsed form of {@link authEnvShape}. */
export type AuthEnv = z.infer<typeof authEnvShape>

/**
 * The same keys with cross-field validation: OAuth credentials must be
 * configured in pairs, and at least one provider must be present.
 */
export const authEnvSchema = z.object(authEnvShape).superRefine((env, ctx) => {
  const pairs: Array<{ id: string; secret: string; label: string; present: [unknown, unknown] }> = [
    {
      id: 'GOOGLE_CLIENT_ID',
      secret: 'GOOGLE_CLIENT_SECRET',
      label: 'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
      present: [env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET],
    },
    {
      id: 'TELEGRAM_OIDC_CLIENT_ID',
      secret: 'TELEGRAM_OIDC_CLIENT_SECRET',
      label: 'TELEGRAM_OIDC_CLIENT_ID and TELEGRAM_OIDC_CLIENT_SECRET',
      present: [env.TELEGRAM_OIDC_CLIENT_ID, env.TELEGRAM_OIDC_CLIENT_SECRET],
    },
  ]

  for (const pair of pairs) {
    const [id, secret] = pair.present
    if (Boolean(id) === Boolean(secret)) continue
    ctx.addIssue({
      code: 'custom',
      path: [id ? pair.id : pair.secret],
      message: `${pair.label} must both be provided or both left unset.`,
    })
  }
})

/** Fully resolved, app-ready auth configuration. */
export interface AbugidaAuthEnv {
  environment: AuthEnvironment
  secret: string
  /** Better Auth `baseURL` — the origin serving `/auth/*`. */
  baseUrl: string
  /** Path the app mounts better-auth's handler under. */
  basePath: string
  /** Exact origin allowlist used for CORS and better-auth's trusted origins. */
  trustedOrigins: string[]
  providers: ProvidersConfig
  /** Present only when token issuance is configured. */
  tokens?: { issuer?: string; audience?: string }
  rateLimit: RateLimitConfig
  twoFactor: TwoFactorConfig
  organization: { allowUserToCreateOrganization: boolean }
}

/**
 * Report the auth environment's cross-field problems through an app's own
 * zod context.
 *
 * Apps spread {@link authEnvShape} into a larger schema and keep their
 * deployment rules; this is how they also get this package's cross-field
 * rules (credential pairs) in the same fail-fast report, instead of a second
 * error surface at auth-module import time.
 */
export function applyAuthEnvIssues(
  value: unknown,
  ctx: { addIssue: (issue: { code: 'custom'; path: PropertyKey[]; message: string }) => void },
): void {
  const result = authEnvSchema.safeParse(value)
  if (result.success) return

  for (const issue of result.error.issues) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message })
  }
}

/**
 * Merge the public auth origin, the browser app and any extra CORS origins
 * into one deduplicated allowlist. The auth origin is always included: it has
 * to be trusted when the API is called directly through a public tunnel, and
 * it is the origin the OAuth callback lands on.
 */
export function buildTrustedOrigins(input: {
  authUrl: string
  webAppUrl?: string | undefined
  corsOrigins?: string | undefined
}): string[] {
  const origins = new Set<string>()
  origins.add(new URL(input.authUrl).origin)
  if (input.webAppUrl) origins.add(input.webAppUrl)
  for (const part of (input.corsOrigins ?? '').split(',')) {
    const origin = part.trim()
    if (origin) origins.add(origin)
  }
  return [...origins]
}

/**
 * Project a deployment environment onto the auth environment.
 *
 * `staging` is deliberately folded into `production`: staging serves over
 * https behind the same proxy as production, so it must get production cookie
 * flags (`Secure`, and the production check that forbids disabling them).
 * Deployments that name their environments differently are free to pass an
 * explicit value instead.
 */
export function parseAuthEnvironment(value: string | undefined): AuthEnvironment {
  if (value === 'production' || value === 'staging') return 'production'
  return value === 'test' ? 'test' : 'development'
}

/**
 * Project an app's parsed environment onto {@link AbugidaAuthEnv}.
 *
 * Validation runs on the auth-owned keys only, so an app can keep its own
 * (stricter, deployment-specific) rules for the same values without this
 * function having to know about them. `ENVIRONMENT` (or `NODE_ENV`) is read
 * from the same object and is not part of {@link authEnvShape}: the set of
 * names a deployment may use is the deployment's business, the mapping to auth
 * behaviour is ours.
 */
export function resolveAuthEnv(raw: unknown): AbugidaAuthEnv {
  const source = (raw ?? {}) as Record<string, unknown>
  const { ENVIRONMENT, NODE_ENV, ...rest } = source
  const env = authEnvSchema.parse(rest)
  const environment = parseAuthEnvironment(
    typeof ENVIRONMENT === 'string'
      ? ENVIRONMENT
      : typeof NODE_ENV === 'string'
        ? NODE_ENV
        : undefined,
  )

  const providers: ProvidersConfig = {}
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    providers.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }
  }
  if (env.TELEGRAM_OIDC_CLIENT_ID && env.TELEGRAM_OIDC_CLIENT_SECRET) {
    providers.telegram = {
      clientId: env.TELEGRAM_OIDC_CLIENT_ID,
      clientSecret: env.TELEGRAM_OIDC_CLIENT_SECRET,
      // Backend-controlled: Telegram only returns the phone number once the
      // user grants the phone scope, and a client must not be able to drop it.
      requestPhone: true,
    }
  }

  return {
    environment,
    secret: env.BETTER_AUTH_SECRET,
    baseUrl: env.BETTER_AUTH_URL,
    basePath: env.AUTH_BASE_PATH,
    trustedOrigins: buildTrustedOrigins({
      authUrl: env.BETTER_AUTH_URL,
      webAppUrl: env.WEB_APP_URL,
      corsOrigins: env.CORS_ORIGINS,
    }),
    providers,
    ...(env.TOKEN_AUDIENCE ? { tokens: { audience: env.TOKEN_AUDIENCE } } : {}),
    rateLimit: { max: env.AUTH_RATE_LIMIT_MAX, windowSeconds: env.AUTH_RATE_LIMIT_WINDOW_SECONDS },
    twoFactor: {
      issuer: env.TOTP_ISSUER,
      twoFactorCookieMaxAge: env.TWO_FACTOR_COOKIE_MAX_AGE,
      trustDeviceMaxAge: env.TRUST_DEVICE_MAX_AGE,
      accountLockout: {
        maxFailedAttempts: env.ACCOUNT_LOCKOUT_MAX_ATTEMPTS,
        durationSeconds: env.ACCOUNT_LOCKOUT_DURATION,
      },
    },
    organization: { allowUserToCreateOrganization: env.AUTH_ALLOW_USER_CREATED_ORGANIZATIONS },
  }
}
