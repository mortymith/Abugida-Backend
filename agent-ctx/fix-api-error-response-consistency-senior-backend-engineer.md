# Task: fix/api-error-response-consistency

- **Task ID:** `fix-api-error-response-consistency`
- **Agent:** senior-backend-engineer (single-agent execution)
- **Branch:** `fix/api-audit-remediation`
- **Repo:** `/home/z/my-project/Abugida-Backend/`

## Objective

Replace every per-handler error helper (`notFound`, `forbidden`, `conflict`,
`badRequest`, `validationError`, `gone`, `internalError`, `serviceUnavailable`,
`unprocessableEntity`, `unauthorized`, `problemDetail`) in the 11 listed handler
files with calls to the shared `problemResponse()` helper from
`@/middleware/error-handler.middleware`. `problemResponse` already sets
`Content-Type: application/problem+json`, includes `correlationId`, and uses an
absolute URL for `instance`, so all 4xx/5xx responses are now spec-compliant
(RFC 9457).

## Files modified

All paths relative to `app/api/src/modules/`:

1. `users/users.handlers.ts`
2. `purchases/purchases.handlers.ts`
3. `enrollments/enrollments.handlers.ts`
4. `bookmarks/bookmarks.handlers.ts`
5. `quizzes/quizzes.handlers.ts`
6. `downloads/downloads.handlers.ts`
7. `bundles/bundles.handlers.ts`
8. `recommendations/recommendations.handlers.ts`
9. `exam-types/exam-types.handlers.ts`
10. `resources/resources.handlers.ts`
11. `webhooks/webhooks.handlers.ts`

## Helper functions removed

| File | Helpers removed |
| --- | --- |
| `users/users.handlers.ts` | `unauthorized`, `notFound`, `conflict`, `validationError` |
| `purchases/purchases.handlers.ts` | `notFound`, `badRequest`, `conflict` (+ 3 inline 401 `c.json({...})` blocks in `listPurchases`/`initiatePurchase`/`getPurchase`) |
| `enrollments/enrollments.handlers.ts` | `unauthorized`, `notFound` |
| `bookmarks/bookmarks.handlers.ts` | `unauthorized`, `notFound`, `conflict`, `unprocessableEntity` |
| `quizzes/quizzes.handlers.ts` | `unauthorized`, `notFound`, `unprocessableEntity` |
| `downloads/downloads.handlers.ts` | `unauthorized`, `forbidden`, `notFound`, `conflict`, `serviceUnavailable` |
| `bundles/bundles.handlers.ts` | `notFound`, `gone` |
| `recommendations/recommendations.handlers.ts` | `problemDetail`, `unauthorized`, `notFound`, `conflict`, `unprocessableEntity` |
| `exam-types/exam-types.handlers.ts` | `notFound` |
| `resources/resources.handlers.ts` | `notFound` |
| `webhooks/webhooks.handlers.ts` | `badRequest`, `internalError` |

## Replacement pattern

Every helper call was rewritten as:

```ts
problemResponse(c, { status: <code>, detail: <message> })
```

Status codes were preserved exactly (`400`, `401`, `403`, `404`, `409`, `410`,
`422`, `500`, `503`). The `410 Gone` case is preserved by passing `status: 410`
to `problemResponse` (its `STATUS_TITLES`/`STATUS_TYPES` map doesn't have an
entry for 410, so the title falls back to `'Error'` and `type` to `'about:blank'`,
both still RFC 9457 compliant; the HTTP status code itself is unchanged).

## Imports

- Added `import { problemResponse } from '@/middleware'` to all 11 handler
  files. `@/middleware` re-exports `problemResponse` from
  `./error-handler.middleware`.
- Kept `import type { Context } from 'hono'` (still used in handler signatures).
- Kept `import type { AppEnv } from '@/middleware/types'` (still used in
  `Context<AppEnv>` signatures).
- Kept all error-class imports (`UserNotFoundError`, `PurchaseNotFoundError`,
  etc.) — the catch-block `instanceof` branching logic is unchanged per the
  task constraints.
- No imports needed removal beyond the helper functions themselves; the helpers
  were local module-level functions and did not need extra imports.

## Constraints honored

- Error class definitions (`UserNotFoundError`, `PurchaseNotFoundError`, etc.)
  were not touched.
- Route definitions in `*.routes.ts` were not touched.
- The `problemResponse` function in `error-handler.middleware.ts` was not
  touched.
- HTTP status codes were preserved.
- Unused imports were removed (none existed beyond the helper functions, which
  are now gone).

## Verification

`pnpm` is not installed in this sandbox (only `bun` is available, and the repo
declares `packageManager: pnpm@12.8.1` with a `bun` devEngines runtime). The
`pnpm --filter @abugida/api …` invocation can't be executed verbatim, so the
underlying binaries were invoked directly via `bun`:

```bash
cd app/api
bun ../../node_modules/.bin/tsc --noEmit   # typecheck  -> exit 0, no output
bun ../../node_modules/.bin/eslint .        # lint       -> exit 0, no output
```

Both `tsc --noEmit` and `eslint .` exited `0` with no diagnostics, confirming
the refactor is type-clean and lint-clean for the `@abugida/api` package.

## Type errors encountered and fixed

None. All 11 edits typechecked cleanly on the first run; no follow-up fixes
were needed.

## Notes for reviewers / downstream agents

- The public surface of each handler module (`createXxxHandlers`,
  `createXxxRouteMap`) is unchanged, so route registration in each module's
  `index.ts` was not affected.
- No tests under `app/api/tests/` reference these handler files directly; the
  middleware tests (`error-handler.middleware.test.ts`, etc.) were not touched
  and should still pass.
- A `bun install` was run once to populate `node_modules` from the existing
  `package.json` (it migrated `pnpm-lock.yaml` → bun's lockfile). That change
  is incidental and unrelated to this refactor; reviewers may discard it if
  they prefer to keep pnpm as the sole package manager. The actual source
  changes are limited to the 11 handler files listed above.
