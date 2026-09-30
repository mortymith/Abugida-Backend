/**
 * @module core/routes
 *
 * Which of Better Auth's routes this platform serves, and which it refuses.
 *
 * Two lists, both pure data, both consumed by the framework integrations and
 * by the instance factory:
 *
 *   - {@link PASSWORDLESS_DISABLED_PATHS} — credential endpoints the platform
 *     cannot complete, because it has no passwords and no outbound email.
 *     Handed to Better Auth as `disabledPaths`, which applies it twice: the
 *     router answers 404 and the OpenAPI generator skips the path. One lever,
 *     so the handler and the generated document can never disagree.
 *   - {@link OPENAPI_PLUGIN_PATHS} — the documentation endpoints Better Auth's
 *     OpenAPI plugin registers for itself. Consumers publish the document from
 *     `getAuthOpenApiDocument()` instead, so these are not served at all.
 *
 * `disabledPaths` is matched exactly against the *resolved* request path, so a
 * templated route (`/reset-password/:token`) can never be listed there. Such
 * paths are {@link PASSWORDLESS_DISABLED_PREFIXES} and are refused by the
 * integrations with a prefix match instead.
 *
 * Session-based endpoints are deliberately absent from both lists:
 * `/get-session`, `/list-sessions`, `/revoke-session*`, `/update-user`,
 * `/delete-user` and `/account-info` all work from the session cookie.
 *
 * Pure module: no better-auth import, so any bundle can use it.
 */

/** Credential endpoints the Abugida platform cannot serve (Google/Telegram OIDC only). */
export const PASSWORDLESS_DISABLED_PATHS = [
  '/sign-up/email',
  '/sign-in/email',
  '/request-password-reset',
  '/reset-password',
  '/send-verification-email',
  '/verify-email',
  '/verify-password',
  '/change-password',
  '/change-email',
] as const

/**
 * Templated credential endpoints, which `disabledPaths` cannot express.
 * Matched as a prefix against the auth-relative request path.
 */
export const PASSWORDLESS_DISABLED_PREFIXES = ['/reset-password/'] as const

/**
 * Templated credential endpoints, which `disabledPaths` cannot express as a
 * runtime rule: the option is matched against the *resolved* request path, so
 * the literal route template only removes it from the generated document. The
 * runtime refusal is {@link PASSWORDLESS_DISABLED_PREFIXES}.
 */
export const PASSWORDLESS_DISABLED_TEMPLATES = ['/reset-password/:token'] as const

/** Base-path-relative paths Better Auth's OpenAPI plugin serves for itself. */
export const OPENAPI_PLUGIN_PATHS = ['/open-api', '/reference'] as const

/**
 * Strips a trailing slash and normalizes the leading one, so `/auth` and
 * `/auth/` behave the same and comparisons stay string-exact.
 */
export function normalizeAuthBasePath(basePath: string): string {
  const trimmed = basePath.replace(/\/+$/, '')
  return trimmed === '' || trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

/**
 * The request path relative to the auth base path, or `undefined` when the
 * request is not under it at all. `undefined` must never match a rule — that
 * is what keeps a host application's own `/open-api/...` routes safe.
 */
function authRelativePath(path: string, basePath: string): string | undefined {
  const prefix = normalizeAuthBasePath(basePath)
  if (path === prefix) return '/'
  if (prefix !== '' && !path.startsWith(`${prefix}/`)) return undefined
  return prefix === '' ? path : path.slice(prefix.length)
}

/**
 * Whether a credential route is refused because the platform is passwordless.
 * Covers the static list (also passed to Better Auth as `disabledPaths`) and
 * the templated ones that option cannot express.
 */
export function isPasswordlessDisabledPath(path: string, basePath = '/auth'): boolean {
  const relative = authRelativePath(path, basePath)
  if (relative === undefined) return false
  if ((PASSWORDLESS_DISABLED_PATHS as readonly string[]).includes(relative)) return true
  return PASSWORDLESS_DISABLED_PREFIXES.some((prefix) => relative.startsWith(prefix))
}

/** Whether a request targets one of the OpenAPI plugin's own documentation paths. */
export function isOpenApiPluginPath(path: string, basePath = '/auth'): boolean {
  const relative = authRelativePath(path, basePath)
  if (relative === undefined) return false
  return OPENAPI_PLUGIN_PATHS.some(
    (entry) => relative === entry || relative.startsWith(`${entry}/`),
  )
}
