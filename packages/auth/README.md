# @abugida/auth

The **single source of truth for authentication** in the Abugida monorepo,
built on [better-auth](https://www.better-auth.com) `v1.6.26`.

One package owns the Better Auth server instance, the plugin registry, the
session/security policy, the environment contract and the role vocabulary, so
`app/api` and `app/dashboard` serve an identical auth surface instead of each
constructing their own.

What lives here:

- the Better Auth instance and its **plugin registry** — Google, Telegram
  OpenID Connect, JWT/bearer (PowerSync), **two-factor**,
  **organizations** and **OpenAPI** generation;
- session, cookie, rate-limit, trusted-origin and account-lockout policy;
- the auth **environment contract** (`@abugida/auth/env`) and the role
  vocabulary + organization authorization helpers;
- the framework integrations (`@abugida/auth/hono`, `@abugida/auth/tanstack*`)
  and the browser client (`@abugida/auth/client`).

What deliberately does **not** live here: UI, routing, feature policy (which
role may open which screen) and app-specific configuration. Those stay in the
apps.

The plugin set is not an extension point. An app cannot add, remove or reorder
plugins, because two runtimes serving different auth surfaces is the exact
failure this package removes.

- Runtime: Bun `>=1.4.2`, TypeScript, ESM-only
- Database: PostgreSQL via Drizzle ORM. Schemas and migrations are owned by
  `@abugida/database`; this package consumes `authSchema` and never migrates
- One entry point (`createAbugidaAuth`) wires everything together

## Install

The package is a workspace dependency:

```bash
pnpm install
```

Consumers need `better-auth@1.6.26` and, for the framework integration they
use, `hono` or `@tanstack/react-start` + `react`. Both are peer dependencies.

## Quick start

### 1. Declare the auth environment

`@abugida/auth` owns the environment contract, so an app spreads the shape into
its own zod schema instead of re-declaring variables:

```ts
// app/api/src/config/app_config.ts
import { z } from 'zod'
import { authEnvShape } from '@abugida/auth/env'

const appConfigSchema = z.object({
  ...authEnvShape,
  DATABASE_URL: z.string().min(1),
  // …the app's own variables
})
```

Covered by `authEnvShape`: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`WEB_APP_URL`, `CORS_ORIGINS`, `AUTH_BASE_PATH`, the `AUTH_*_CALLBACK_URL`
destinations, `AUTH_BASE_URL`/`TOKEN_AUDIENCE` (token issuance),
`GOOGLE_CLIENT_*`, `TELEGRAM_OIDC_*`, `AUTH_RATE_LIMIT_*`, the two-factor
variables (`TOTP_ISSUER`, `TWO_FACTOR_COOKIE_MAX_AGE`, `TRUST_DEVICE_MAX_AGE`,
`ACCOUNT_LOCKOUT_*`) and `AUTH_ALLOW_USER_CREATED_ORGANIZATIONS`.

Validation rules that are auth policy rather than deployment policy live with
the keys: secret length and placeholder rejection, OAuth credential pairs,
and the trusted-origin list.

### 2. Create the instance — once per process

```ts
import { createAbugidaAuth } from '@abugida/auth'
import { resolveAuthEnv } from '@abugida/auth/env'
import { db } from './database'
import { appConfig } from './app_config'
import { logger } from './observability'

export const auth = createAbugidaAuth({ env: resolveAuthEnv(appConfig), db, logger })
```

That is the whole wiring. It binds `authSchema` from `@abugida/database`
(override `schema` only in tests), derives the provider list from the
credentials that are actually present, and registers the plugin registry.
Create it once per process and share it: a second better-auth instance keeps
its own cookie cache and plugin registry.

Required env vars, at minimum:

| Var                                         | Notes                                                                       |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                        | ≥32 chars, not a placeholder — `openssl rand -hex 32`                       |
| `BETTER_AUTH_URL`                           | Public URL of the service serving `/auth/*`                                 |
| `AUTH_BASE_PATH`                            | Path better-auth is mounted under (default `/auth`); must match the app     |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud Console → OAuth client                                         |
| `TELEGRAM_OIDC_CLIENT_ID` / `_SECRET`       | [@BotFather](https://t.me/botfather) → Bot Settings > Web Login (OIDC) pair |

### 3. Mount it

### Telegram sign-in (Telegram OIDC only, via better-auth-telegram)

Telegram is wired through the [`better-auth-telegram`](https://www.npmjs.com/package/better-auth-telegram)
plugin — this package never implements Telegram verification itself. Telegram
sign-in is supported **exclusively through Telegram OpenID Connect**
(oauth.telegram.org): a standard OAuth 2.0 + PKCE redirect flow that the
plugin registers as a real social provider (`provider: "telegram-oidc"`) via
better-auth's own `POST /sign-in/social` and `GET /callback/telegram-oidc`
routes. Sessions, accounts, and provider-token storage behave exactly as they
do for Google. The plugin's legacy Login Widget and Mini App flows are
disabled (`loginWidget: false`, no `miniApp` config), so no bot token is
involved and none of the `/telegram/signin|link|unlink` endpoints are
registered.

Configured entirely through the shared environment — the plugin is registered
by this package, with the phone scope requested server-side:

```bash
# BotFather > Bot Settings > Web Login (OpenID Connect) credentials
TELEGRAM_OIDC_CLIENT_ID=
TELEGRAM_OIDC_CLIENT_SECRET=   # NOT the bot token
```

Client sign-in (TanStack/vanilla better-auth client):

```ts
authClient.signIn.social({ provider: 'telegram-oidc', callbackURL: '/dashboard' })
```

Setup checklist:

1. Create a bot with [@BotFather](https://t.me/botfather) (the bot ID doubles
   as the default OIDC client id).
2. Configure **Bot Settings > Web Login** in BotFather, register your
   redirect URL, and copy the issued Client ID + Client Secret into
   `TELEGRAM_OIDC_CLIENT_ID`/`TELEGRAM_OIDC_CLIENT_SECRET`. The Web Login
   secret is a dedicated credential — it is **not** the bot token. 3. This integration requests `requestPhone: true` by default, which adds
   the `phone` scope. Telegram only returns `phone_number` after the user
   explicitly grants permission. Additional OIDC scopes can be configured
   with `scopes: [...]`.

Schema note: the OIDC flow stores provider accounts in the standard
`account` table with `providerId = "telegram-oidc"`. No Telegram-specific
columns are required in the injected schema.

### 3a. Hono

```ts
import { Hono } from 'hono'
import { mountAuthRoutes, requireSession, type HonoAuthVariables } from '@abugida/auth/hono'

const app = new Hono<{ Variables: HonoAuthVariables }>()

mountAuthRoutes(app, auth)
// Mounts better-auth's full handler under auth.config.basePath (default
// /auth): POST /sign-in/social, POST /sign-up/email, GET /callback/:provider,
// GET /get-session, POST /sign-out, POST /session/refresh, ...

app.get('/me', requireSession(auth), (c) => c.json({ user: c.get('user') }))
```

See `examples/hono-example.ts` for the full setup.

### 3b. TanStack Start

```ts
// app/lib/auth.server.ts
import { createAuthServerFunctions } from '@abugida/auth/tanstack/server'

export const authServerFns = createAuthServerFunctions(auth)

// app/routes/dashboard.tsx
export const Route = createFileRoute('/dashboard')({
  beforeLoad: requireAuthBeforeLoad(authServerFns, { loginPath: '/login' }),
  loader: () => authServerFns.getServerSession(),
  component: DashboardPage,
})

// app/lib/auth.client.ts
export const authClient = createAuthClient({ baseUrl: import.meta.env.VITE_AUTH_BASE_URL })

function DashboardPage() {
  const { data: session } = authClient.useSession()
  // ...
}
```

See `examples/tanstack-example.tsx` for the full setup, including the sign-in
buttons (`authClient.signIn.social({ provider: "google" | "telegram-oidc" })`).

## Logging

Pass a structured logger to see startup validation failures, provider
errors, session errors, and rate-limit events. Defaults to a no-op logger —
nothing is required to get started, and nothing is ever logged that
contains a secret, private key, or token (see `redact()` in `core/logger.ts`).

```ts
import { createAbugidaAuth, createConsoleLogger } from '@abugida/auth'
import { resolveAuthEnv } from '@abugida/auth/env'

const auth = createAbugidaAuth({
  env: resolveAuthEnv(appConfig),
  db,
  logger: createConsoleLogger('auth'), // or any { debug, info, warn, error }
})
```

## Token refresh (calling a provider's API on the user's behalf)

`getAccessToken` returns a valid, auto-refreshed OAuth access token for a
linked provider account — useful when your app needs to call provider APIs
after sign-in, not just authenticate the user.

```ts
const token = await auth.getAccessToken({ userId, providerId: 'google' })
if (token.ok) {
  await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${token.value.accessToken}` },
  })
}
```

## JWT issuance for external services (PowerSync)

Set `TOKEN_AUDIENCE` to opt in to better-auth's `jwt` + `bearer` plugins.
Keys are served at `GET <basePath>/jwks` (with the default `basePath` of
`/auth`, that is `GET /auth/jwks`) and tokens carry `sub` = user id, which
PowerSync sync streams read via `auth.user_id()`. The audience must match the
consumer's config (`docker/config/powersync/service.yaml` sets
`client_auth.audience = ["abugida"]`):

```bash
TOKEN_AUDIENCE=abugida
```

Requirements and wiring:

- Add better-auth's generated `jwks` table to your Drizzle schema
  (`@better-auth/cli generate` after enabling) — the plugin stores its
  encrypted private keys there.
- Point `PS_JWKS_URI` (see `.env.example`) at `<api-base>/auth/jwks`.
- Clients obtain tokens via the plugin's `/token` endpoint while a session
  is active; the `bearer` plugin accepts them on API requests.

## Session refresh and CSRF hardening

- `auth.refreshSession(headers)` / `authServerFns.refreshServerSession()` —
  bypasses better-auth's 60s cookie cache for a guaranteed-fresh lookup
  (e.g. immediately after a role change).
- `mountAuthRoutes` adds `POST /auth/session/refresh` automatically, guarded
  by an Origin-header check against `cors.origins`.
- `csrfProtection(auth)` — a Hono middleware you can add to your _own_
  mutating routes (account deletion, settings changes, etc.) for the same
  Origin-header defense-in-depth. This backstops, but doesn't replace,
  better-auth's own PKCE/state protection on the OAuth redirect itself.

## Organizations and two-factor

Both plugins are always registered by `buildServerPlugins()`:

- **organizations** declares the `useCase` additional field as required,
  because `organization.use_case` is `NOT NULL` in `@abugida/database`. The
  plugin and its schema are not optional; `AUTH_ALLOW_USER_CREATED_ORGANIZATIONS`
  only controls whether a user may create their own workspace.
- **two-factor** is configured from the shared environment (issuer, verified
  cookie lifetime, trusted-device lifetime, lockout attempts and the
  `durationSeconds` cooldown).

The browser client registers the matching client plugins
(`organizationClient`, `twoFactorClient`) through `createAuthClient()`, so the
two sides cannot disagree about which actions exist.

## OpenAPI documentation

Better Auth's OpenAPI plugin is registered with the rest of the registry, so
the auth documentation is generated from the **live instance**: the paths,
request bodies, responses and schemas are whatever the enabled plugins and
providers actually serve. There is nothing to keep in sync by hand.

```ts
import { getAuthOpenApiDocument, mergeAuthOpenApiDocument } from '@abugida/auth'

// Generated by the plugin from the instance. Cached per instance.
const authDocument = await getAuthOpenApiDocument(auth)

// Folded into the app's own OpenAPI 3.1 document.
const document = mergeAuthOpenApiDocument(app.getOpenAPI31Document(config), authDocument, {
  basePath: auth.config.basePath, // Better Auth emits paths relative to it
  tag: 'Auth', // file the auth operations under the app's own tag
  bearerSecurityScheme: 'Bearer', // reuse the app's scheme names
  cookieSecurityScheme: 'sessionCookie',
})
```

The merge prefixes the generated paths with the auth base path, points
Better Auth's `bearerAuth` / `apiKeyCookie` requirements at the host's own
scheme names, and adds `POST {basePath}/session/refresh` — the one endpoint
`mountAuthRoutes` serves that Better Auth's generator cannot know about.

It deliberately does **not** merge `info`, `servers`, or the document-level
`security`: the host owns its identity, and Better Auth's root requirement
would mark every unannotated public operation as authenticated. Host schema
definitions always win on a name clash.

The plugin's default Scalar reference page is disabled, and neither of the
plugin's own documentation endpoints is served (a framework integration
returns 404 for `isOpenApiPluginPath(path)`) — a consumer publishes the
document from `getAuthOpenApiDocument()` instead, so the schema is not also
available as an unlisted second copy.

## Passwordless surface

The platform has no passwords and no outbound email, so Better Auth's
credential endpoints are switched off through its `disabledPaths` option
(`PASSWORDLESS_DISABLED_PATHS`): sign-in/sign-up by email, password reset,
e-mail change/verification and password change. Better Auth applies that both
in its router (404) and in its OpenAPI generator, so those routes are neither
callable nor documented — one lever, no drift.

`disabledPaths` is matched against the _resolved_ request path, so the templated
`/reset-password/:token` route is listed by template (which removes it from the
generated document) and refused at runtime by the prefix guard in
`mountAuthRoutes` (and by the dashboard's own `/auth/*` entry), via
`isPasswordlessDisabledPath(path)`.

Session-based routes are untouched: `/get-session`, `/list-sessions`,
`/revoke-session*`, `/update-user`, `/delete-user` and `/account-info` all work
from the session cookie.

### Restricting the social sign-in body

`mountAuthRoutes` can narrow two endpoints behind app policy:

```ts
mountAuthRoutes(app, auth, {
  socialSignIn: {
    callbackURL: 'https://app.example.com/callback',
    errorCallbackURL: 'https://app.example.com/login',
    providerAliases: { telegram: 'telegram-oidc' },
  },
  telegramConfig: { providerId: 'telegram' },
})
```

`socialSignIn` discards the client's body and rebuilds it server-side: a client
may only name a provider, never choose where the provider redirects to.
`providerAliases` maps public provider ids onto the ones Better Auth knows
(Telegram OIDC is `telegram-oidc` internally). `telegramConfig` adds the
public provider id to the discovery response. Both are opt-in; omit them and
Better Auth's own endpoints are served unchanged.

### Authorizing a request

```ts
import {
  activeOrganizationId,
  resolveOrganizationAccess,
  requireOrganizationRole,
  resolveUserPlatformRole,
} from '@abugida/auth'
import { requireOrganizationRole as requireOrgRole } from '@abugida/auth/hono'

// Platform role of a user across all their organizations.
const role = await resolveUserPlatformRole(db, userId)

// Membership + minimum role for one organization. The requested id is always
// checked against the caller's own `member` rows, so a signed-in user cannot
// read or write another organization's data by passing someone else's id.
const access = await requireOrganizationRole(db, session, {
  organizationId,
  minimumRole: 'admin',
})
```

`requireOrganizationRole` (the Hono middleware) does the same for a route and
publishes the result on `c.get('organization')`.

## Adding a new provider

Implement `AuthProviderDefinition` (see `src/providers/base.ts` and
`src/providers/google.ts` for a minimal reference) and register it in
`buildProviderRegistry()` in `src/core/auth.ts`, alongside the environment
variables it needs. Providers are the one part of the auth surface an app
cannot extend at runtime — deliberately: a provider that exists in one app and
not the other is a support ticket waiting to happen.

## Security notes

- **CSRF / OAuth state**: better-auth generates and verifies PKCE + state
  parameters on every social sign-in redirect; `cors.origins` is what scopes
  which origins may complete a flow at all (set via `trustedOrigins`).
- **Session fixation**: sessions are re-issued (not reused) on sign-in.
- **Cookies**: `HttpOnly` always; `Secure` is forced on in `production` (and
  config validation rejects `secure: false` in production at startup).
- **Rate limiting**: applied to auth endpoints via `AUTH_RATE_LIMIT_MAX` /
  `AUTH_RATE_LIMIT_WINDOW_SECONDS` (default 100 req/60s per IP+route).
- Error responses use a discriminated-union `AuthError` type
  (`unauthorized`, `session_expired`, `csrf_mismatch`, `rate_limited`, …) —
  messages are safe to show to end users; raw `cause` is for server logs only
  and should never be serialized to a client response.

## Package layout

```
src/
  core/
    server.ts           createAbugidaAuth() — the public entry point
    auth.ts             internal betterAuth() factory + pure option builders
    session.ts          resolveSession / refreshSession / revokeSession
    handlers.ts         behaviour behind the TanStack server functions
    authorize.ts        organization membership + role authorization
    roles.ts            the platform role vocabulary
    token-refresh.ts     getValidAccessToken (auto-refresh wrapper)
    tokens.ts            opt-in jwt/bearer plugins (PowerSync et al)
    openapi.ts           generated OpenAPI document + merge into a host document
    routes.ts            served-surface policy: passwordless + doc path rules
    csrf.ts              Origin-header defense-in-depth check
    logger.ts            pluggable Logger interface, noop + console adapters
    environment.ts       isProduction/isDevelopment/isTest helpers
    types.ts             shared config/error/result types
  plugins/
    constants.ts        shared plugin contract (organization additional fields)
    server.ts           the authoritative server plugin registry
  providers/    google.ts, telegram.ts, base.ts (extension contract)
  middleware/
    hono/       mountAuthRoutes, withSession, requireSession,
                requireOrganizationRole, csrfProtection
    tanstack/   server functions, route guard, React client
  client/       browser-safe client + client plugin registry
  config/       env.ts (the auth environment contract) + config validation
  (route policy is also importable on its own, without better-auth, as
  `@abugida/auth/routes`)
examples/       runnable Hono + TanStack Start integrations, a custom
                (GitHub) provider proof, and a fixture Drizzle schema
tests/          bun:test unit tests — providers, config, session, token
                refresh, CSRF, logger, environment, the plugin registry, the
                env contract, authorization, roles, the server-function
                handlers, the pure option builders, Hono middleware (via
                Hono's own app.request() test harness), the generated OpenAPI
                document and its merge, the endpoints `mountAuthRoutes`
                serves against a real instance, and the TanStack
                route guard
MIGRATIONS.md   drizzle-kit workflow for the schema you inject
```

## Scripts

```bash
bun run typecheck
bun run lint
bun run format
bun test
bun run build
```

## TanStack server functions

`createAuthServerFunctions(auth)` binds the four auth server functions
(`getServerSession`, `refreshServerSession`, `signOutServer`,
`getServerAccessToken`) to `createServerFn()`. An app whose auth instance lives
in its own source can call it directly.

Apps that hit TanStack Start's constraints declare the functions themselves and
delegate the behaviour:

```ts
import { createServerFn } from '@tanstack/react-start'
import { serverSession } from '@abugida/auth'

export const getServerSession = createServerFn({ method: 'GET' }).handler(async () => {
  const { getRequest } = await import('@tanstack/react-start/server') // stripped from the client
  const { getAuth } = await import('./auth.server') // *.server.*: denied at module scope
  return serverSession(getAuth(), getRequest().headers)
})
```

The two constraints, for the record:

1. Start's server-function transform is applied to the app's **source**, not to
   a workspace package's `dist/`. A `createServerFn` declared inside this
   package is not transformed, and fails during SSR with
   `Cannot read properties of null (reading 'context')`.
2. Start's import protection denies importing a `*.server.*` module from a
   route-reachable module — dynamically too — which is where an app's auth
   instance lives.

So the app keeps the RPC declaration and the package keeps the behaviour:
session resolution, sign-out and token refresh are shared and tested here, in
`core/handlers.ts`.

## Migrating from the factory API

`createAuth()` used to be the public entry point and each app assembled its own
`AuthConfig`, plugin list and environment parsing. It is now internal. What
changes for a consumer:

| Before                                     | Now                                                                                |
| ------------------------------------------ | ---------------------------------------------------------------------------------- |
| `createAuth(config)` from the package root | `createAbugidaAuth({ env, db, logger })`                                           |
| app declares auth env vars + zod schema    | spread `authEnvShape` from `@abugida/auth/env`                                     |
| app passes `authSchema` from the database  | bound by the package; no schema wiring in the app                                  |
| `additionalPlugins` for two-factor / org   | removed — both are always registered                                               |
| app-defined role mapping                   | `@abugida/auth/roles` (`mapBetterAuthRoleToPlatformRole`, …)                       |
| per-app membership queries                 | `resolveOrganizationAccess` / `requireOrganizationRole`                            |
| re-implemented session server functions    | `serverSession` / `serverRefreshedSession` / `serverSignOut` / `serverAccessToken` |

Behaviour changes to be aware of:

- the API now serves the same auth surface as the dashboard — organization and
  two-factor endpoints under `/auth/*` are available on both. The tables and
  migrations already exist in `@abugida/database`; no migration is required.
- `AUTH_RATE_LIMIT_MAX` defaults to 100 requests / 60s (previously the package
  default was 20). Set it explicitly to keep a lower limit.
- `createAuthClient()` registers the organization and two-factor client
  plugins; existing `signIn.social`, `signOut` and `useSession` calls are
  unchanged.

## Caveats / things to verify against your installed better-auth version

better-auth's public API shifts between minor versions faster than most
libraries. Before shipping, diff the following against the installed
`better-auth@1.6.26` types, since they're the surface this package assumes:

- `socialProviders.google` field name for accepting multiple client IDs
- `betterAuth({ rateLimit })` option shape
- `better-auth/adapters/drizzle` adapter signature
- `better-auth/react` client export path
- `better-auth-telegram` plugin option shape (pinned `^2.0.1`, which
  supports `better-auth >=1.6.22 <1.7.0`)

None of these are exotic, but pinning to `1.6.26` and running `bun run
typecheck` in CI is the actual guarantee — this README is a map, not the
territory.
