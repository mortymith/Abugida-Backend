# Dashboard App — Professional Analysis

**Date:** 2026-09-20
**Scope:** `app/dashboard` — TanStack Start application
**Reviewer:** Automated analysis

---

## Executive Summary

The dashboard app is a well-structured early-stage TanStack Start application with solid architectural foundations (centralized config, feature-based organization, shared package usage). However, there are **critical version incompatibilities**, **dead dependencies**, **missing strictness flags**, and **several configuration issues** that will cause runtime failures or build errors. This document catalogs every finding by severity.

---

## 🔴 Critical Issues

### 1. Zod v3 / v4 Version Conflict

**Severity:** Critical — will cause runtime validation failures

The dashboard declares `zod@4.4.3` in `package.json`, but the shared packages use Zod v3:

| Package              | Zod Version         |
| -------------------- | ------------------- |
| `@abugida/dashboard` | `4.4.3` (Zod v4)    |
| `@abugida/auth`      | `^3.23.8` (Zod v3)  |
| `@abugida/database`  | `>=3.23.0` (Zod v3) |

**Impact:**

- `src/config/app.config.ts` imports `from 'zod/v4'` — this is the Zod v4 subpath import, correct for Zod v4.
- `src/features/auth/schemas/auth.signup.schema.ts` imports `from 'zod'` — this resolves to the installed `zod@4.4.3` package. If `@hookform/resolvers` (used in `auth.signup-step-2.tsx`) expects Zod v3's API, validation will silently break.
- `@abugida/auth` and `@abugida/database` both depend on Zod v3 internally. With Zod v4 as the hoisted version, their internal validation may produce incorrect results or throw at runtime.

**Fix:** Align all packages on a single Zod major version. Either:

- Downgrade dashboard to `zod@^3.23.8` and remove the `zod/v4` subpath import, OR
- Upgrade `@abugida/auth` and `@abugida/database` to support Zod v4 (requires upstream changes).

### 2. TanStack AI Packages — Severely Misaligned Versions

**Severity:** Critical — will fail at build or runtime if AI features are used

All seven `@tanstack/ai-*` packages are pinned to wildly different versions:

| Package                  | Pinned Version | Latest (Sep 2026) |
| ------------------------ | -------------- | ----------------- |
| `@tanstack/ai`           | `0.43.1`       | ~0.52.0+          |
| `@tanstack/ai-anthropic` | `0.16.4`       | —                 |
| `@tanstack/ai-client`    | `0.23.1`       | —                 |
| `@tanstack/ai-gemini`    | `0.21.0`       | —                 |
| `@tanstack/ai-ollama`    | `0.8.17`       | —                 |
| `@tanstack/ai-openai`    | `0.18.0`       | —                 |
| `@tanstack/ai-react`     | `0.19.1`       | —                 |

TanStack AI follows a monorepo release cadence — all `@tanstack/ai-*` packages must be at the same version to be compatible. The current pins are from different release cycles and **will not work together**.

**Additionally:** None of these packages are imported anywhere in the source code. They are dead dependencies adding ~2 MB+ to the install.

**Fix:** Either remove all `@tanstack/ai-*` packages entirely (they're unused), or if AI features are planned, pin all to the same latest version and ensure `@alcyone-labs/zod-to-json-schema` is also installed (required peer dependency).

### 3. `@tanstack/react-router-devtools` Version Mismatch

**Severity:** High — may cause SSR/CSR hydration mismatches or devtools crashes

| Package                           | Version    |
| --------------------------------- | ---------- |
| `@tanstack/react-router`          | `1.170.38` |
| `@tanstack/react-router-devtools` | `1.167.2`  |
| `@tanstack/react-start`           | `1.168.56` |
| `@tanstack/router-cli`            | `1.167.26` |

The router is at `1.170.38` while devtools and CLI are at `1.167.x`. TanStack packages in the same family should be kept within minor versions of each other. The 3-version gap between router and devtools is a known source of "Cannot read property of undefined" errors in devtools.

**Fix:** Update `@tanstack/react-router-devtools` and `@tanstack/router-cli` to match `1.170.x`.

---

## 🟠 High Severity Issues

### 4. Missing TypeScript Strictness Flags

**Severity:** High — weakens type safety

The dashboard `tsconfig.json` is missing several flags that the root `tsconfig.json` enforces:

| Flag                         | Root | Dashboard  |
| ---------------------------- | ---- | ---------- |
| `exactOptionalPropertyTypes` | ✅   | ❌ Missing |
| `noImplicitReturns`          | ✅   | ❌ Missing |
| `noUncheckedIndexedAccess`   | ✅   | ❌ Missing |
| `isolatedModules`            | ✅   | ❌ Missing |

Per `AGENTS.md`: "Root tsconfig is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `isolatedModules`. Match these in new code."

**Fix:** Add these flags to `app/dashboard/tsconfig.json` `compilerOptions`:

```json
"noUncheckedIndexedAccess": true,
"exactOptionalPropertyTypes": true,
"noImplicitReturns": true,
"isolatedModules": true
```

### 5. No Error Boundary at Root

**Severity:** High — unhandled errors crash the entire app

`src/routes/__root.tsx` does not define an `errorComponent` or `pendingComponent` on the root route. If any component throws during render (including during SSR), the error will propagate to TanStack Start's default error handler, which shows a blank page or an unstyled error.

**Fix:** Add an `errorComponent` to the root route:

```tsx
export const Route = createRootRouteWithContext<MyRouterContext>()({
  errorComponent: RootErrorBoundary,
  shellComponent: RootDocument,
  // ...
})
```

### 6. QueryClient Created Without Default Options

**Severity:** High — causes excessive network requests

`src/integrations/tanstack-query/root-provider.tsx`:

```ts
export function getContext() {
  const queryClient = new QueryClient()
  return { queryClient }
}
```

No `defaultOptions` are set. This means:

- `staleTime: 0` (default) — every navigation refetches data
- `gcTime: 300000` (5 min) — unused but not harmful
- `retry: 3` (default) — failed requests retry 3 times, slowing error feedback
- `refetchOnWindowFocus: true` — excessive refetching on tab switch

**Fix:**

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60, // 1 minute
      gcTime: 1000 * 60 * 5,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

### 7. `defaultPreloadStaleTime: 0` Defeats Preloading

**Severity:** High — preloaded data is immediately stale

`src/router.tsx`:

```ts
const router = createTanStackRouter({
  defaultPreloadStaleTime: 0,
  // ...
})
```

With `staleTime: 0`, preloaded data is considered stale the instant it arrives. This means every preloaded route will immediately refetch on navigation, negating the performance benefit of preloading entirely.

**Fix:** Set `defaultPreloadStaleTime` to at least `30_000` (30 seconds):

```ts
defaultPreloadStaleTime: 30_000,
```

---

## 🟡 Medium Severity Issues

### 8. `server.mjs` Uses `process.exit()` — Incompatible with Bun

**Severity:** Medium — production server won't shut down gracefully on Bun

`server.mjs` line 143:

```js
process.exit(1)
```

Bun does not fully support `process.exit()` for graceful shutdown. Bun uses `process.kill()` or signal handlers. In a crash scenario, `process.exit(1)` may not flush buffered logs or close database connections.

**Fix:** Use `Bun.exit(1)` or throw the error and let Bun's default handler manage it:

```js
main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error))
  throw error // Bun will handle the exit
})
```

### 9. Hardcoded Ngrok URL in Vite Config

**Severity:** Medium — security/infrastructure concern

`vite.config.ts`:

```ts
server: {
  allowedHosts: ['accuracy-flip-playing.ngrok-free.dev'],
},
```

This is a personal ngrok tunnel URL hardcoded in source. It will break for other developers and exposes infrastructure details.

**Fix:** Move to an environment variable:

```ts
server: {
  allowedHosts: process.env.VITE_ALLOWED_HOSTS?.split(',') ?? [],
},
```

### 10. `observability.config.ts` `init()` Is Never Called

**Severity:** Medium — observability is configured but never initialized

`src/config/observability.config.ts` exports `init()` and `shutdown()`, but neither is called anywhere in the application lifecycle. The logger works (it's imported directly), but OpenTelemetry tracing and metrics are never initialized.

**Fix:** Call `init()` in the server entry or root route's `beforeLoad`:

```ts
// In server.mjs or app entry
import { init, shutdown } from '#/config/observability.config'
await init()
process.on('SIGTERM', () => shutdown())
```

### 11. Missing `.env.example` File

**Severity:** Medium — poor developer experience

There is no `.env.example` in the dashboard directory. The `app.config.ts` validates ~35 environment variables, but new developers have no reference for which are required vs. optional.

**Fix:** Create `app/dashboard/.env.example` with all variables from the Zod schema, marking required ones with comments.

### 12. Auth Signup Schema Imports from Wrong Zod Path

**Severity:** Medium — will break with Zod v4 if resolvers expect v3 API

`src/features/auth/schemas/auth.signup.schema.ts`:

```ts
import { z } from 'zod'
```

This imports from the bare `'zod'` specifier. With `zod@4.4.3` installed, this resolves to Zod v4. However, `@hookform/resolvers` (used in `auth.signup-step-2.tsx`) may expect Zod v3's `zodResolver` API. The `@hookform/resolvers@5.x` supports Zod v4, but only if imported from `@hookform/resolvers/zod/v4`.

**Fix:** Either:

- Change the import to `import { z } from 'zod/v4'` for consistency with `app.config.ts`, OR
- Verify that `@hookform/resolvers` is configured for Zod v4 compatibility.

### 13. Duplicate Path Aliases

**Severity:** Low — unnecessary complexity

Both `#/` and `@/` are configured to point to `./src/*` in `tsconfig.json` and `package.json` imports. The AGENTS.md states `#/` is preferred, but `@/` is also available. This creates confusion about which to use.

**Fix:** Remove `@/*` from `tsconfig.json` `paths` to enforce the `#/` convention exclusively. (Keep it if it's needed by other tooling.)

---

## 🔵 Low Severity / Code Quality Issues

### 14. Dead Dependencies — Unused Packages

**Severity:** Low — bloats install, increases attack surface

The following dependencies are declared in `package.json` but never imported anywhere in the source code:

| Package                                                                                           | Purpose (stated)                | Used?                        |
| ------------------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------- |
| `@tanstack/ai` + 6 adapters                                                                       | AI features                     | ❌ No imports                |
| `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`                                        | Drag & drop                     | ❌ No imports                |
| `@tiptap/extension-link`, `@tiptap/extension-placeholder`, `@tiptap/react`, `@tiptap/starter-kit` | Rich text editor                | ❌ No imports                |
| `highlight.js`                                                                                    | Code highlighting               | ❌ No imports                |
| `streamdown`                                                                                      | Markdown streaming              | ❌ No imports                |
| `lucide-react`                                                                                    | Icons (using hugeicons instead) | ❌ No imports                |
| `date-fns`                                                                                        | Date utilities                  | ❌ No imports                |
| `sonner`                                                                                          | Toast notifications             | ❌ No imports                |
| `@fontsource-variable/inter`                                                                      | Inter font                      | ❌ Not used (Outfit is used) |

**Fix:** Remove all unused dependencies. If they're planned for future features, add them when the feature is implemented.

### 15. `@fontsource-variable/inter` Installed But Unused

**Severity:** Low — dead dependency

The `inter` font package is installed but the app uses `outfit` (body) and `raleway` (headings). The `inter` import in `styles.css` is absent.

**Fix:** Remove `@fontsource-variable/inter` from `package.json`.

### 16. `console.log` Left in Production Code

**Severity:** Low — information leakage

`src/features/auth/components/auth.login-form.tsx` line 44:

```ts
console.log('Provider sign‑in clicked', provider)
```

This debug log should be removed or replaced with the observability logger.

**Fix:** Remove the `console.log` or use `logger.debug(...)` from the observability config (server-side only — this is a client component, so just remove it).

### 17. Auth Feature Imports Internal Files Directly

**Severity:** Low — violates architecture rules

Several route files import directly from feature internals instead of through the feature's `index.ts`:

- `src/routes/_auth/login.tsx` imports `useSession` from `#/features/auth/hooks/auth.session`
- `src/routes/_auth/login.tsx` imports `LoginForm` from `#/features/auth/components/auth.login-form`
- `src/routes/_auth/mfa.tsx` imports `MfaInput` from `#/features/auth/components/auth.mfa-input`
- `src/routes/_auth/signup.tsx` imports `SignupStep1`, `SignupStep2`, `SignupStep3` directly

Per AGENTS.md §4: "Import from a feature's `index.ts` — never reach into its internal files directly."

The `features/auth/index.ts` already exports all of these.

**Fix:** Update imports to use the barrel:

```ts
import { useSession, LoginForm } from '#/features/auth'
```

### 18. `auth.login-form.tsx` Imports Type from Internal Path

**Severity:** Low — same barrel violation

`auth.login-form.tsx` line 3:

```ts
import type { Provider } from '#/features/auth/hooks/auth.provider-memory'
```

The `Provider` type is already exported from `features/auth/index.ts`.

**Fix:** `import type { Provider } from '#/features/auth'`

### 19. `signupOrganization` Server Function Uses `as any` Cast

**Severity:** Low — loses type safety

`src/server/functions/auth.signup.ts` line 24:

```ts
const result = await (auth.raw.api as any).createOrganization({
```

The `as any` cast bypasses all type checking on the API call. If the `organization` plugin's API changes, this will silently break.

**Fix:** Use the typed API from better-auth's organization plugin, or create a typed wrapper in the auth package.

### 20. `verifyMfa` Server Function Uses `as any` Cast

**Severity:** Low — same issue as above

`src/server/functions/auth.mfa-verify.ts` line 11:

```ts
await (auth.raw.api as any).verifyTwoFactorOTP({
```

**Fix:** Use the typed `twoFactor` plugin API from better-auth.

### 21. `getMfaStatus` Accesses `user` Without Type Safety

**Severity:** Low — fragile type assertion

`src/server/functions/auth.mfa-status.ts` line 16:

```ts
const user = session.user as typeof session.user & { twoFactorEnabled?: boolean }
```

This manual type assertion suggests the `twoFactorEnabled` field isn't in the shared type definitions. The auth package should export this type.

**Fix:** Extend the user type in `@abugida/auth` to include `twoFactorEnabled`, or use the two-factor plugin's API to check MFA status.

### 22. `TanstackQueryProvider` Component Is Empty

**Severity:** Low — misleading export

`src/integrations/tanstack-query/root-provider.tsx` line 10:

```ts
export default function TanstackQueryProvider() {}
```

This component does nothing. It appears to be a leftover from a template. The actual QueryClient setup happens in `getContext()`.

**Fix:** Remove the empty component or add `QueryClientProvider` wrapping if needed.

---

## 🟢 Recommendations (Improvements)

### 23. Add `Suspense` Boundaries for Data-Dependent Routes

The `_app/dashboard.tsx` renders placeholder `"--"` values. When real data loading is added, wrap content in `<Suspense>` with `pendingComponent` to avoid layout shift.

### 24. Use `loader` Instead of `useEffect` for Auth Redirects

`src/routes/_auth/login.tsx` and `src/routes/_auth/mfa.tsx` use `useEffect` to redirect if a session exists. This causes a flash of the login/MFA page before redirect.

**Better:** Use `beforeLoad` to redirect server-side:

```ts
export const Route = createFileRoute('/_auth/login')({
  beforeLoad: async () => {
    const { authServerFns } = await import('#/config/auth.config')
    const session = await authServerFns.getServerSession()
    if (session) throw redirect({ to: '/dashboard' })
  },
  component: LoginPage,
})
```

### 25. Add `pendingComponent` to All Routes

None of the route files define `pendingComponent`. While TanStack Router handles loading states via the root, route-specific pending UI improves perceived performance.

### 26. Add `errorComponent` to Individual Routes

Only the root route should have a fallback `errorComponent`. Individual routes (especially `_app/dashboard`) should define their own error UI for better UX.

### 27. Consider Adding `staleTime` to Route Loaders

When loaders are added, set `staleTime` per-route to control refetch behavior:

```ts
export const Route = createFileRoute('/_app/dashboard')({
  staleTime: 10_000, // 10 seconds
  loader: async () => { ... },
})
```

### 28. Add `@/` Path Alias Deprecation

If the project is standardizing on `#/`, consider adding an ESLint rule to warn on `@/` imports:

```js
'no-restricted-imports': ['error', {
  patterns: [{ group: ['@/*'], message: 'Use #/ instead of @/' }],
}]
```

---

## Summary Table

| #   | Issue                                     | Severity       | Category      |
| --- | ----------------------------------------- | -------------- | ------------- |
| 1   | Zod v3/v4 version conflict                | 🔴 Critical    | Compatibility |
| 2   | TanStack AI version misalignment + unused | 🔴 Critical    | Compatibility |
| 3   | Router/devtools version mismatch          | 🔴 High        | Compatibility |
| 4   | Missing tsconfig strictness flags         | 🟠 High        | Configuration |
| 5   | No error boundary at root                 | 🟠 High        | Resilience    |
| 6   | QueryClient missing default options       | 🟠 High        | Performance   |
| 7   | `defaultPreloadStaleTime: 0`              | 🟠 High        | Performance   |
| 8   | `process.exit()` in Bun                   | 🟡 Medium      | Compatibility |
| 9   | Hardcoded ngrok URL                       | 🟡 Medium      | Security      |
| 10  | Observability `init()` never called       | 🟡 Medium      | Configuration |
| 11  | Missing `.env.example`                    | 🟡 Medium      | DX            |
| 12  | Zod import path inconsistency             | 🟡 Medium      | Compatibility |
| 13  | Duplicate path aliases                    | 🔵 Low         | Consistency   |
| 14  | 8+ dead dependencies                      | 🔵 Low         | Hygiene       |
| 15  | Unused `inter` font                       | 🔵 Low         | Hygiene       |
| 16  | `console.log` in production               | 🔵 Low         | Hygiene       |
| 17  | Direct feature imports (barrel violation) | 🔵 Low         | Architecture  |
| 18  | Type import from internal path            | 🔵 Low         | Architecture  |
| 19  | `as any` in signup server fn              | 🔵 Low         | Type Safety   |
| 20  | `as any` in MFA verify server fn          | 🔵 Low         | Type Safety   |
| 21  | Manual type assertion for MFA status      | 🔵 Low         | Type Safety   |
| 22  | Empty `TanstackQueryProvider` component   | 🔵 Low         | Hygiene       |
| 23  | Add Suspense boundaries                   | 🟢 Improvement | UX            |
| 24  | Use `beforeLoad` for auth redirects       | 🟢 Improvement | Performance   |
| 25  | Add `pendingComponent` to routes          | 🟢 Improvement | UX            |
| 26  | Add `errorComponent` to routes            | 🟢 Improvement | Resilience    |
| 27  | Add `staleTime` to route loaders          | 🟢 Improvement | Performance   |
| 28  | Deprecate `@/` alias via ESLint           | 🟢 Improvement | Consistency   |

---

## Recommended Priority Order

1. **Immediate:** Fix Zod version conflict (#1) — will cause runtime failures
2. **Immediate:** Remove or align TanStack AI packages (#2) — dead weight + incompatibility
3. **This sprint:** Update TanStack router-adjacent packages (#3), add missing tsconfig flags (#4), add error boundary (#5)
4. **This sprint:** Fix QueryClient defaults (#6), fix preload stale time (#7)
5. **Next sprint:** Address medium issues (#8–#12)
6. **Backlog:** Clean up low-severity items and implement improvements (#13–#28)
