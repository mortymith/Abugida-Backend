# @abugida/tenant

The single source of truth for **tenancy** in the Abugida monorepo, shared by `app/api` and `app/dashboard`.

```text
@abugida/database → @abugida/auth → @abugida/tenant → app/api · app/dashboard
```

| Package             | Owns                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `@abugida/database` | Drizzle schemas, relations, migrations, the database client                                           |
| `@abugida/auth`     | Better Auth, sessions, OAuth, 2FA, the organization plugin, the role vocabulary                       |
| `@abugida/tenant`   | Tenant resolution, slug and subdomain rules, tenant URLs, tenant context, tenant-scoped authorization |

This package owns **no schema and no authentication**. It derives application tenancy semantics from what the two packages below it already own, and adds no second organization system.

## The model

```text
abugida.com              platform apex (marketing)
dashboard.abugida.com    platform — create/manage organizations
api.abugida.com          platform — reserved
acme.abugida.com         tenant workspace (organization `acme`)
```

`dashboard.abugida.com` is never a tenant. There is no fake organization for the platform.

## Resolution

```ts
import { resolveTenantFromHostname } from '@abugida/tenant'

resolveTenantFromHostname('acme.abugida.com', { baseDomain: 'abugida.com' })
// { kind: 'tenant', slug: 'acme', hostname: 'acme.abugida.com' }
```

The resolver normalizes the hostname (case, trailing dot, port), classifies it as `tenant` / `platform` / `apex` / `external` / `invalid`, and never treats an arbitrary host as a tenant.

Development needs no special case: `baseDomain: 'localhost'` makes `acme.localhost:3000` resolve exactly like production.

## Slugs

A slug is a DNS label, so the rules are boring and centralized:

- `normalizeTenantSlug(value)` — folds user input (lowercase, ASCII, single hyphens, 3–63 chars).
- `validateTenantSlug(value)` — judges a value **without rewriting it**, so the request path cannot re-point a tenant by changing case or padding.
- `isReservedTenantSlug(value)` — the platform list (`www`, `dashboard`, `api`, `auth`, `docs`, `admin`, …), from `RESERVED_TENANT_SLUGS`.

Reserved names are rejected server-side, not only in the form.

## URLs

```ts
import { getTenantUrl, getPlatformUrl } from '@abugida/tenant/url'

getTenantUrl({ slug: 'acme', baseDomain: 'abugida.com' }) // https://acme.abugida.com
getPlatformUrl({ baseDomain: 'abugida.com' }) // https://dashboard.abugida.com
```

## Context and authorization

```ts
import { requireTenantMembership, hasTenantPermission } from '@abugida/tenant/authorization'

const context = await requireTenantMembership({ store, tenant, userId })
hasTenantPermission(context, 'course:update')
```

A hostname is a claim, not a grant. The context is only ever produced by a _verified membership_:

```text
hostname → resolve tenant → authenticate → verify membership → authorize → TenantContext
```

Cross-tenant access is rejected at every step: an unknown slug is `404`, a non-member is `403`, and `requireSameTenant(context, idFromRequest)` refuses a client-supplied tenant id that is not the established one.

## Entry points

| Subpath                         | Contents                                             |
| ------------------------------- | ---------------------------------------------------- |
| `@abugida/tenant`               | Slugs, resolution, URLs, types, errors, env contract |
| `@abugida/tenant/url`           | URL building only (browser-safe)                     |
| `@abugida/tenant/authorization` | Tenant context + permission checks                   |
| `@abugida/tenant/store`         | Drizzle-backed read store                            |
| `@abugida/tenant/hono`          | API middleware                                       |
| `@abugida/tenant/env`           | `tenantEnvShape` — the environment contract          |

The root and `/url` are client-safe: importing a slug helper or a link builder in the browser pulls in neither Drizzle nor Better Auth.

## Dependency contract

`@abugida/tenant` declares **no runtime dependencies of its own**. Everything it needs is supplied by the consuming app:

| Peer                | Range                | Used for                                                          |
| ------------------- | -------------------- | ----------------------------------------------------------------- |
| `@abugida/auth`     | `workspace:*`        | The role vocabulary (`/roles`) that tenant roles are derived from |
| `@abugida/database` | `workspace:*`        | The `organization` / `member` tables the read store projects      |
| `zod`               | `^4.4.3`             | The `tenantEnvShape` environment contract                         |
| `hono`              | `>=4.6.0` (optional) | The API middleware                                                |

This is deliberate: the package sits _on top of_ those two, so the consumer decides which instances it runs against, and there is never a second copy of the schema, the auth instance or the validator. The same three are listed in `devDependencies` so this package can still be built, typechecked and tested on its own.

Consequence for a new consumer: declare `@abugida/auth`, `@abugida/database` and `zod@^4` alongside `@abugida/tenant`. Both `app/api` and `app/dashboard` already do, and the monorepo currently resolves a single `zod@4.4.3` for all of them.

## Apps

- **API** — `src/config/tenant.ts` builds `tenantConfig` and `tenantStore`; `src/middleware/tenant.middleware.ts` mounts `tenantHostMiddleware` globally and `requireTenantContextMiddleware` behind the session, so handlers read `c.get('tenant')` instead of resolving tenancy.
- **Dashboard** — `src/config/tenant.config.ts` (browser URLs), `src/config/tenant.server.ts` (domain config, store, current-tenant resolution) and the sign-up flow, which enforces the shared slug rules server-side before Better Auth creates the organization.

## Commands

```bash
pnpm --filter @abugida/tenant typecheck
pnpm --filter @abugida/tenant test
pnpm --filter @abugida/tenant lint
```
