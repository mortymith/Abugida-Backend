# @abugida/auth

Shared authentication layer for Hono API and TanStack Start apps, built on
top of [better-auth](https://www.better-auth.com) `v1.6.26`. Ships pluggable
**Apple ID** and **Google OAuth** providers, with a documented interface for
adding your own.

- Runtime: Bun `>=1.3.14`, TypeScript, ESM-only
- Database: PostgreSQL via Drizzle ORM — you inject the schema, this package
  never owns migrations
- One factory function (`createAuth`) wires everything together

## Install

```bash
bun add @abugida/auth better-auth@1.6.26 drizzle-orm
# and whichever framework you're integrating with:
bun add hono
# or
bun add @tanstack/react-start @tanstack/react-router react
```

## Quick start

### 1. Provide your schema

Your app (or a shared `@abugida/db-schemas` package) owns the Drizzle table
definitions. They just need to match the shape below — see
`examples/fixtures/schema.ts` for a complete, copy-pasteable version.

```ts
export const authSchema = { user, session, account, verification };
```

### 2. Create the auth instance

```ts
import { drizzle } from "drizzle-orm/node-postgres";
import { createAuth } from "@abugida/auth";
import { authSchema } from "@abugida/db-schemas/auth";

const db = drizzle(process.env.DATABASE_URL!);

export const auth = createAuth({
  environment: process.env.NODE_ENV as "development" | "production" | "test",
  baseUrl: process.env.AUTH_BASE_URL!,
  secret: process.env.AUTH_SECRET!, // openssl rand -hex 32
  database: { db, schema: authSchema, provider: "pg" },
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!, // Services ID
      teamId: process.env.APPLE_TEAM_ID!,
      keyId: process.env.APPLE_KEY_ID!,
      privateKey: process.env.APPLE_PRIVATE_KEY!, // full .p8 contents
    },
  },
  cors: { origins: [process.env.WEB_APP_URL!], credentials: true },
  rateLimit: { max: 20, windowSeconds: 60 },
});
```

Required env vars, at minimum:

| Var                                                                        | Notes                                                  |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| `AUTH_SECRET`                                                              | ≥32 chars, `openssl rand -hex 32`                      |
| `AUTH_BASE_URL`                                                            | Public URL of the service serving `/auth/*`            |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`                                | Google Cloud Console → OAuth client                    |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | Apple Developer → Services ID + Sign in with Apple key |

### 3a. Hono

```ts
import { Hono } from "hono";
import { mountAuthRoutes, requireSession, type HonoAuthVariables } from "@abugida/auth/hono";

const app = new Hono<{ Variables: HonoAuthVariables }>();

mountAuthRoutes(app, auth); // /auth/login, /auth/callback/:provider, /auth/logout, ...

app.get("/me", requireSession(auth), (c) => c.json({ user: c.get("user") }));
```

See `examples/hono-example.ts` for the full setup.

### 3b. TanStack Start

```ts
// app/lib/auth.server.ts
export const authServerFns = createAuthServerFunctions(auth);

// app/routes/dashboard.tsx
export const Route = createFileRoute("/dashboard")({
  beforeLoad: requireAuthBeforeLoad(authServerFns, { loginPath: "/login" }),
  loader: () => authServerFns.getServerSession(),
  component: DashboardPage,
});

// app/lib/auth.client.ts
export const authClient = createAuthClient({ baseUrl: import.meta.env.VITE_AUTH_BASE_URL });

function DashboardPage() {
  const { data: session } = authClient.useSession();
  // ...
}
```

See `examples/tanstack-example.tsx` for the full setup, including the sign-in
buttons (`authClient.signIn.social({ provider: "google" | "apple" })`).

## Logging

Pass a structured logger to see startup validation failures, provider
errors, session errors, and rate-limit events. Defaults to a no-op logger —
nothing is required to get started, and nothing is ever logged that
contains a secret, private key, or token (see `redact()` in `core/logger.ts`).

```ts
import { createConsoleLogger } from "@abugida/auth";

createAuth({
  // ...
  logger: createConsoleLogger("auth"), // dev-friendly console adapter
  // or plug in your own: any object implementing { debug, info, warn, error }
});
```

## Token refresh (calling a provider's API on the user's behalf)

`getAccessToken` returns a valid, auto-refreshed OAuth access token for a
linked provider account — useful when your app needs to call back into
Google/Apple/GitHub APIs after sign-in, not just authenticate the user.

```ts
const token = await auth.getAccessToken({ userId, providerId: "google" });
if (token.ok) {
  await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${token.value.accessToken}` },
  });
}
```

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

## Adding a new provider

Implement `AuthProviderDefinition` (see `src/providers/base.ts` and
`src/providers/google.ts` for a minimal reference) and pass it in via
`providers.custom`:

```ts
createAuth({
  // ...
  providers: {
    custom: {
      github: { definition: githubProviderDefinition, credentials: { clientId, clientSecret } },
    },
  },
});
```

No changes to this package are required. `examples/custom-provider-github.ts`
is a complete working proof of this using GitHub.

## Security notes

- **CSRF / OAuth state**: better-auth generates and verifies PKCE + state
  parameters on every social sign-in redirect; `cors.origins` is what scopes
  which origins may complete a flow at all (set via `trustedOrigins`).
- **Session fixation**: sessions are re-issued (not reused) on sign-in.
- **Cookies**: `HttpOnly` always; `Secure` is forced on in `production` (and
  config validation rejects `secure: false` in production at startup).
- **Rate limiting**: applied to auth endpoints via `rateLimit` config
  (default 20 req/60s per IP+route).
- Error responses use a discriminated-union `AuthError` type
  (`unauthorized`, `session_expired`, `csrf_mismatch`, `rate_limited`, …) —
  messages are safe to show to end users; raw `cause` is for server logs only
  and should never be serialized to a client response.

## Package layout

```
src/
  core/
    auth.ts            createAuth() factory + pure option builders
    session.ts          resolveSession / refreshSession / revokeSession
    token-refresh.ts     getValidAccessToken (auto-refresh wrapper)
    csrf.ts              Origin-header defense-in-depth check
    logger.ts            pluggable Logger interface, noop + console adapters
    environment.ts       isProduction/isDevelopment/isTest helpers
    types.ts             shared config/error/result types
  providers/    apple.ts, google.ts, base.ts (extension contract)
  middleware/
    hono/       mountAuthRoutes, withSession, requireSession, csrfProtection
    tanstack/   server functions, route guard, React client
  config/       zod-backed config validation + defaults
examples/       runnable Hono + TanStack Start integrations, a custom
                (GitHub) provider proof, and a fixture Drizzle schema
tests/          bun:test unit tests — providers, config, session, token
                refresh, CSRF, logger, environment, the pure createAuth()
                option builders, Hono middleware (via Hono's own app.request()
                test harness), and the TanStack route guard
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

## Caveats / things to verify against your installed better-auth version

better-auth's public API shifts between minor versions faster than most
libraries. Before shipping, diff the following against the installed
`better-auth@1.6.26` types, since they're the surface this package assumes:

- `socialProviders.apple` accepting a `clientSecret` function (vs. requiring
  a pre-computed string) and the `appBundleIdentifier` option for native flows
- `socialProviders.google` field name for accepting multiple client IDs
- `betterAuth({ rateLimit })` option shape
- `better-auth/adapters/drizzle` adapter signature
- `better-auth/react` client export path

None of these are exotic, but pinning to `1.6.26` and running `bun run
typecheck` in CI is the actual guarantee — this README is a map, not the
territory.
