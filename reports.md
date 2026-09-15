# Abugida-Backend — Critical Analysis Report

> **Analyzed:** 2026-09-13 · commit `60df798` (master, 87 commits) · single-author repository
> **Scope:** Full monorepo — `app/` (api, dashboard, marketing), `packages/` (database, auth, queue, storage, observability), `docker/`, `docs/`, UX specs
> **Method:** Static inspection of source, schemas, configs, tests, CI, docs; cross-referencing the 13 UX spec documents against actual implementation

---

## 1. Executive Summary

Abugida-Backend is an ambitious, **dual-identity repository**: half of it is a genuinely impressive self-hosted **Docker Compose infrastructure platform** (24 prod services, Keepalived VIP, Cloudflare Tunnel, Redis Sentinel, secret layering, 88-recipe justfile, 24 ADRs), and the other half is an **application monorepo** for an Ethiopian ed-tech course-operations platform (Hono API + TanStack Start dashboard + Astro marketing, 5 shared packages, 45-table Drizzle schema).

The code quality discipline is well above average for a solo project: conventional commits enforced via commitlint + husky, lint-staged, Prettier/ESLint everywhere, Turborepo task graph, richly constrained database schema (CHECK constraints, composite/partial indexes, drizzle-zod validation), layered architecture in the API (repository → service → handler → OpenAPI route map), and thorough infrastructure documentation (runbooks, onboarding, ADRs).

However, the project currently has a **"beautiful skeleton, missing organs" problem**. The parts that make it a _product_ are stubs or absent:

1. **No CI/CD at all** — there is no `.github/` directory. 59 test files exist and are never run automatically anywhere.
2. **No database migrations are committed** — `drizzle.config.ts` outputs to `./drizzle/`, but that folder does not exist in the repo. Schema deployment strategy is undefined (`db:push` drift risk in any shared/prod environment).
3. **Queue processors are scaffolds** — purchase, enrollment, statistics, notification processors log via `console.debug` and perform none of their documented side effects ("pending DB integration" is admitted in code comments). The core business loop (purchase → payment → enrollment → stats → notifications) is not actually wired end-to-end.
4. **API surface lags the product spec** — there is no courses/catalog CRUD module, no notifications endpoint, no search endpoint, no analytics endpoint. Most dashboard screens specified in `app/dashboard/spec /` (S-1.1–S-1.4, S-2.x) are currently unservable.
5. **Spec contradictions** that will cause rework: 4 vs 5 roles across spec files, USD/Stripe/PayPal wireframes vs the ETB/telebirr-only reality, "subscription/refund" concepts with no database backing, "workspace-scoped roles" with no workspace table.

**Verdict:** Strong foundations, disciplined engineering culture, credible architecture — but the project is at the "infrastructure ready, application hollow" stage. The fastest path to product value is not more infrastructure polish; it is (a) CI, (b) migrations, (c) wiring the queue→DB loop, and (d) building the missing API modules that the already-written UX specs depend on.

### Scorecard

| Dimension                        | Score /10 | Rationale                                                                                                                    |
| -------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Architecture & code organization | **8.5**   | Clean monorepo, layered API modules, well-factored packages, thin-route conventions                                          |
| Database design                  | **8**     | 45 tables, 6 domains, checks/indexes/zod everywhere; loses points for missing migrations & workspace-roles mismatch          |
| Infrastructure & deployment      | **8**     | Exceptional Compose platform, HA, secrets, edge security; loses points for zero CI and untested app deploy path              |
| Testing                          | **5.5**   | 59 test files with real depth in packages, but zero API route/module tests, zero dashboard tests, and no CI to run any of it |
| Security posture                 | **7**     | CSRF, rate-limit, API-key middleware, docker secrets, security runbooks; no automated scanning, no LICENSE, role model gaps  |
| Product completeness vs spec     | **3**     | Auth flows done; dashboard is a placeholder; most spec screens blocked on missing backend                                    |
| Documentation                    | **7.5**   | ADRs, runbooks, onboarding, per-app AGENTS.md; contradicted by spec inconsistencies and README identity split                |
| **Overall**                      | **6.5**   | Excellent skeleton and platform; hollow product core; critical DevOps gaps                                                   |

---

## 2. Project Overview

### 2.1 What this repository actually is

The repository name says "Backend", the README says "Infrastructure Platform". Both are true, and the tension matters:

| Identity                    | Evidence                                                                                                                                                                                                                                                                           | Maturity                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Infrastructure platform** | `docker/` (9 compose files + profiles), 44 KB `justfile` (88 recipes), `docs/architecture/adr/` (Keepalived, Cloudflare Tunnel, Redis Sentinel, secret layering), `scripts/` (backup, restore, deploy, security, monitoring), `docker/tests/` (integration, performance, security) | **High** — documented, tested, opinionated                 |
| **Application monorepo**    | `app/api` (Hono, 123 TS files), `app/dashboard` (TanStack Start, 52 TS files), `app/marketing` (Astro 7, near-empty), `packages/*` (247 TS files)                                                                                                                                  | **Partial** — auth path done; core domain flows scaffolded |

### 2.2 Stack inventory

| Layer              | Technology                                                                                               | Notes                                                     |
| ------------------ | -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Package management | pnpm 11.21.0 (workspaces) + Turborepo 2.5                                                                | `minimumReleaseAge` pinning for supply-chain safety       |
| Runtime            | Bun ≥ 1.3.14 (enforced via `devEngines.runtime`), Node for some tooling                                  | `bun test` as the unified test runner                     |
| API                | Hono 4.12 + `@hono/zod-openapi` + Scalar API reference                                                   | 15 domain modules, repo/service/handler/route-map pattern |
| Database           | PostgreSQL via Drizzle ORM 0.45 + drizzle-zod                                                            | 45 tables across 6 domains                                |
| Auth               | better-auth 1.6.26 (shared `@abugida/auth`), Google + Telegram providers, CSRF, token refresh, MFA flows | Used by both API and dashboard                            |
| Queue              | BullMQ 5.34 + Redis                                                                                      | 10 processors; telebirr + SMSEthiopia integrations        |
| Storage            | Custom S3-style package (put/get/list/copy/move, presigned, multipart)                                   | Storage-agnostic operations layer                         |
| Observability      | Custom `@abugida/observability` (logging, metrics, tracing, errors) with Hono/TanStack/Astro adapters    | OTel-style design                                         |
| Dashboard          | TanStack Start 1.168, React 19.2, shadcn/ui (base-ui variant), Tailwind 4, TanStack Query/Router/Store   | 16 UI primitives present                                  |
| Marketing          | Astro 7                                                                                                  | Effectively empty (0 TS files)                            |
| Git hygiene        | husky (pre-commit/commit-msg/pre-push), commitlint conventional, lint-staged, Prettier                   | Enforced locally, nothing enforced remotely (no CI)       |

### 2.3 Codebase metrics (measured)

| Metric                                    | Value                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| TS/TSX files (app + packages)             | 422 (123 api / 52 dashboard / 0 marketing / 247 packages)                                                           |
| Total TS/TSX LOC                          | ~46,300                                                                                                             |
| Database tables (`pgTable`)               | 45                                                                                                                  |
| Test files                                | 59 total — 46 in packages, 13 in `app/api` (only `config/` + `middleware/`), **0** in dashboard, **0** in marketing |
| Env vars in `.env.example`                | 109                                                                                                                 |
| TODO/FIXME/HACK markers                   | 18                                                                                                                  |
| `console.*` in package sources (non-test) | 18 occurrences (logger bypass)                                                                                      |
| `: any` annotations (non-test)            | ~16                                                                                                                 |
| Git commits / authors                     | 87 / 1 (bus factor = 1)                                                                                             |
| CI pipelines                              | **0** (no `.github/`)                                                                                               |

---

## 3. Architecture Assessment

### 3.1 What is genuinely good

**Monorepo boundaries are clean and meaningful.** Every package earns its existence: `@abugida/database` exports typed schema + client; `@abugida/auth` wraps better-auth with framework adapters (`/hono`, TanStack guard); `@abugida/queue` isolates BullMQ + third-party integrations (telebirr, SMSEthiopia); `@abugida/storage` abstracts object storage behind operation modules with presigned/multipart support; `@abugida/observability` ships framework integrations rather than leaking concerns into apps. Apps consume packages via `workspace:*` only — no cross-app imports, no circular smells observed.

**The API module pattern is disciplined.** Each module (e.g. `app/api/src/modules/enrollments/`) follows `*.schemas.ts → *.repository.ts → *.service.ts → *.handlers.ts → *.routes.ts` with `index.ts` factories, composed centrally in `app.ts` via `create*RouteMap` + `app.openapi(route, handler)`. This is a textbook vertical-slice design that stays greppable and testable. Middleware (`api-key-auth`, `auth`, `cors`, `error-handler`, `logging`, `rate-limit`, `request-id`) is orthogonal and individually tested.

**The database schema is production-grade in design.** Beyond columns, it encodes business rules: XOR purchase constraint (`courseId` OR `bundleId`, never both), enrollment-source CHECK constraints, progress bounds (0–100), rating bounds (1–5), soft deletes with partial indexes (`WHERE deleted_at IS NULL`), time-series support (`course_stats_history` with `(course_id, snapshot_date)` unique), and idempotency-minded unique indexes. Money is `numeric(19,4)` with ISO currency codes — correct choice for a payments domain.

**Infra-as-code maturity is rare at this stage.** Layered compose files (`base/app/edge/networks/observability/scaling/security/volumes.yml`) with profiles, Keepalived VIP for failover, Cloudflare Tunnel for inbound-only exposure, Redis Sentinel, Trivy in setup, and an incident-response runbook tree — this is a portfolio-quality operations platform.

### 3.2 Architectural concerns

| #   | Concern                                                                                                                                                                                                                                                        | Evidence                                                          | Impact                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| A1  | **Dual identity dilutes focus.** 44 KB justfile + 24 ADRs of infra vs. a dashboard with one placeholder screen. Effort allocation is inverted relative to product value.                                                                                       | README vs `app/dashboard/src/routes/`                             | Slow path to a demoable product                                                       |
| A2  | **The event backbone is declared but dead.** Processors exist for purchase, enrollment, moderation, statistics, notification, audit, maintenance, webhook, export — but contain `console.debug` stubs, no DB writes, no DB schema for notifications/templates. | `packages/queue/src/processors/*.ts`                              | Business flows silently no-op; dashboards/analytics have no data pipeline             |
| A3  | **Dashboard spec assumes capabilities the API doesn't expose** (search index, notifications feed, analytics aggregates, course CRUD). No contract layer (OpenAPI client generation) connects dashboard → API; dashboard currently talks only to better-auth.   | spec `03-Dashboard.md` vs `app/api/src/modules/`                  | Screens specified in specs are unimplementable without new backend work               |
| A4  | **No API client/SDK generation** for the dashboard despite `@hono/zod-openapi` being in place — the single biggest missed DRY opportunity in the stack.                                                                                                        | `app/dashboard/src/lib/` (only auth-client)                       | Duplicate types, drift between API and UI                                             |
| A5  | **Mixed toolchain complexity**: pnpm (deps) + Bun (runtime/tests) + Turbo (tasks) + Just (infra). Each is justified, but the combination with `minimumReleaseAgeExclude` pinning 3 exact versions is fragile for contributors.                                 | `pnpm-workspace.yaml`, `package.json`                             | Onboarding friction; contributors' first `pnpm i` may diverge from docs               |
| A6  | **Roles model mismatch.** Spec §11 claims roles are _workspace-scoped_; the DB has `roles` + `course_roles` (per-course, no `workspaces` table at all). Nothing in the API resolves "the user's workspace role".                                               | `spec /11-Global-Standards.md` vs `packages/database/schema/ops/` | Permission gating (nav hiding, revenue access) has no server-side source of truth yet |

---

## 4. Data Model Review

**Strengths:** domain separation (`auth/ catalog/ finance/ learning/ ops/ shared/`), exhaustive constraints and indexes (61+ indexes observed), drizzle-zod insert/select/update schemas co-located per table, `types.ts`/`enums.ts` re-export hygiene, and 11 test files covering schemas across all domains.

**Gaps and risks:**

| #   | Finding                                                                                                                                                                                                                                                                                    | Severity             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------- |
| D1  | **No committed migrations.** `drizzle.config.ts` → `out: './drizzle'`, but no `drizzle/` directory exists. `db:push` is the de-facto flow — acceptable for solo dev, dangerous the moment a second environment or contributor appears.                                                     | **Critical**         |
| D2  | **No `notifications` table**, while the queue's SMS processor explicitly defers to it ("template rendering requires the notifications DB schema") and spec S-1.4 requires it.                                                                                                              | High                 |
| D3  | **No analytics aggregates.** Spec S-1.1/S-1.2 read `analytics.aggregated_metrics/revenue/enrollments` — none exist. `course_stats_history` provides a partial time-series, but no rollup job populates it (the `statistics` processor is a stub).                                          | High                 |
| D4  | **No subscription or refund concepts.** Purchases are one-shot (`initiated/payment_pending/completed/failed`); spec wireframes price in USD, mention Stripe/PayPal and subscription vs one-time splits. Reality: ETB, telebirr-only enum. Specs must be reconciled or the schema extended. | High (spec mismatch) |
| D5  | **No workspaces table** despite spec §11's "roles are workspace-scoped" and sign-up being "Organization Sign-Up & Onboarding" (S-0.2).                                                                                                                                                     | Medium               |
| D6  | `users.id` is `text` (better-auth convention) while all FKs from bigint tables (`enrollments.studentId` → `users.id`) mix key types across domains — workable but unusual; document it.                                                                                                    | Low                  |

---

## 5. Critical Findings (ordered by severity)

### 🔴 C1 — No CI/CD pipeline

There is no `.github/` (no Actions, no CodeQL, no Dependabot). 59 test files, commitlint, typecheck, and the docker test suites run **only if a developer remembers to**. The husky hooks protect the local machine, not the repository. Any contributor (or future you) can push failing code to `master` today.
**Fix (≈ half a day):** one GitHub Actions workflow running `pnpm i → turbo lint typecheck test` + Trivy scan; branch protection on `master`.

### 🔴 C2 — Schema changes have no migration trail

`db:migrate`/`db:generate` scripts exist, but the generated `drizzle/` folder is absent — meaning no migration has ever been committed. Combined with C1, there is **no reproducible database anywhere**: a fresh clone cannot reach the schema state the code assumes without `db:push` (which diverges from real DDL and can't express data migrations).
**Fix (≈ 1 day):** run `db:generate` once, commit the initial migration set, standardize on `db:migrate` in compose init + CI service containers.

### 🔴 C3 — Core business loop is unwired

The purchase → telebirr transaction → enrollment → statistics → notification chain exists as typed job definitions and processor skeletons, but processors perform none of their documented side effects. Concretely: enrolling a student writes one row; no stats recalculation, no notification, no audit trail beyond DB triggers. The product's value proposition (operate courses) therefore doesn't close the loop yet.
**Fix:** implement `purchase`/`enrollment`/`statistics` processors against the real schema (the outbox-events table already exists for exactly this pattern), then add integration tests per processor.

### 🟠 C4 — API surface vs. spec gap is wide

Modules present: auth, users, enrollments, bookmarks, recommendations, exam-types, tags, resources, bundles, downloads, purchases, quizzes, webhooks, system. **Missing vs. spec: courses/lessons/catalog CRUD (S-2.x), notifications (S-1.4), search (S-1.3), analytics (S-1.1/S-1.2/S-5.x), settings/team/roles (S-6.x), marketing (S-8.x).** The 13-file UX spec suite is far ahead of the backend; without an explicit sequencing plan, dashboard work will keep bouncing off missing endpoints.

### 🟠 C5 — Test pyramid is inverted where it matters most

Packages are well-tested (schema, auth CSRF/token-refresh/session, observability, client). But the layer with the most business logic — API services/handlers/routes — has **zero** tests (only config + middleware), and the dashboard has none. The module factory pattern makes handler testing straightforward; it's simply not being done.
**Fix:** per-module contract tests using the existing `create*RouteMap` + in-memory Postgres; target enrollments + purchases first (money paths).

### 🟡 C6 — Solo-maintainer risk & missing legal frame

87 commits, 1 author, no LICENSE, no CODEOWNERS, no CONTRIBUTING. For anything touching payments (telebirr integration), the absence of a license is a real blocker for any external contribution or organizational use.

### 🟡 C7 — Spec-internal contradictions (will burn implementation time)

Documented instances: role list 4 vs 5 (spec 03 omits Reviewer, §11 includes it); currency `$` vs ETB; Stripe/PayPal vs telebirr-only; subscription/refund vs schema reality; "workspace-scoped roles" vs no workspace table; spec directory literally named `spec /` (trailing space) breaking tooling and links.

### 🟡 C8 — Observability inconsistency

`@abugida/observability` is a quality package, yet package sources contain 18 `console.*` bypasses (queue processors notably), so queue jobs are effectively invisible to the logging/tracing pipeline they were designed for.

---

## 6. Security Review

**In place (good):** better-auth with CSRF module + token refresh; dedicated `api-key-auth` middleware; `rate-limiter-flexible`; layered Docker secrets (ADR-006/017) with no plaintext secrets observed in repo (`.env.example` is placeholders); security-events schema + runbook; edge hardening docs (Cloudflare Tunnel, Keepalived); Trivy referenced in setup; 109-var env surface documented.

**Gaps:**

| Finding                                                                                                                  | Severity  | Note                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | --------- | ------------------------------------------------------------ |
| No automated dependency/container scanning in CI (Dependabot/CodeQL/Trivy pipeline)                                      | High      | Trivy exists only as a manual setup step                     |
| Role/permission enforcement has no server-side implementation yet (see A6) — dashboard-level hiding is the only plan     | High      | Revenue screens must enforce "no revenue access" server-side |
| `pnpm.minimumReleaseAgeExclude` pins 3 packages to exact old versions to dodge the release-age guard                     | Medium    | Acceptable trade-off, but should carry an expiry comment     |
| No LICENSE file                                                                                                          | Medium    | Legal ambiguity for a payments product                       |
| better-auth 1.6.26 + drizzle 0.45 pinned; upgrade cadence unmanaged (no Renovate/Dependabot)                             | Medium    | Manual pinning culture vs 46k LOC app                        |
| MFA present in dashboard flows — verify server-side enforcement on API side (not observable in route middleware listing) | To verify | S-0.3 dependency                                             |

---

## 7. Testing Assessment

| Area                             | Files        | Depth                                                               | Verdict                                |
| -------------------------------- | ------------ | ------------------------------------------------------------------- | -------------------------------------- |
| `packages/database`              | 11           | Schema constraints, enums, client, update flows                     | Good                                   |
| `packages/auth`                  | 11           | CSRF, token refresh, session, providers, middleware, env            | **Strong** — best-tested package       |
| `packages/observability`         | 9            | Context, logging, metrics, tracing, errors, Hono adapter            | Good                                   |
| `packages/queue` / `storage`     | ~15 combined | Core/config/integration level                                       | Adequate                               |
| `app/api`                        | 13           | **Only** `config/` + `middleware/` — no route/handler/service tests | **Weak where it matters**              |
| `app/dashboard`                  | 0            | —                                                                   | None                                   |
| `app/marketing`                  | 0            | —                                                                   | None                                   |
| `docker/tests`                   | dir          | integration / performance / security suites                         | Good concept, **never executed in CI** |
| CI execution of any of the above | —            | —                                                                   | **None**                               |

**Net:** ~59 test files representing real effort, but an estimated **60–70% of business-logic risk is untested**, and 100% of it is unenforced.

---

## 8. Documentation & Specs

**Strengths:** `docs/` is unusually complete for this stage — onboarding (4 guides), development (5 guides incl. testing + justfile authoring), runbooks (deploy, incident-response, security-events, data-ops, maintenance), 9+ ADR files (README claims 24), per-app `AGENTS.md` coding conventions (thin routes, `domain.file.tsx` naming), and a genuinely detailed 13-file UX specification set with screen IDs and cross-links.

**Weaknesses:**

1. **Spec contradictions** (see C7) — the specs are authoritative in tone but disagree with each other and with the schema; every implementer will hit these.
2. `app/dashboard/spec /` — the trailing space in the directory name breaks shell scripting, URL links, and some tooling; trivially fixable, currently a daily irritant.
3. **README identity split** — describes only the infra platform; the apps/packages half of the repo has no top-level explanation, and `app/dashboard/README.md` is boilerplate.
4. Marketing app has a name and a Dockerfile but no content — either remove it from the workspace or mark it clearly as a slot.

---

## 9. Product Readiness vs. UX Specs

| Spec module           | Screens    | Backend ready? | Blocker                                                                                                |
| --------------------- | ---------- | -------------- | ------------------------------------------------------------------------------------------------------ |
| 01 Auth & Onboarding  | S-0.1–0.3  | ✅ Mostly      | MFA server enforcement to verify; org/workspace model absent for S-0.2                                 |
| 02 Global Navigation  | S-A.1      | ⚠️ Partial     | Needs role resolution (A6); shell itself is frontend-only                                              |
| 03 Dashboard          | S-1.1–1.4  | ❌ No          | No analytics, notifications, or search backend (C3, D2, D3)                                            |
| 04 Courses            | S-2.1–2.16 | ❌ No          | **No courses/lessons CRUD module in API**; review/approval workflow absent                             |
| 05 Content Library    | S-3.x      | ⚠️ Partial     | `resources` module + storage package exist; asset-library schema unknown                               |
| 06 Students           | S-4.x      | ⚠️ Partial     | Enrollments/users exist; profiles/cohorts/messaging absent                                             |
| 07 Analytics          | S-5.x      | ❌ No          | No analytics endpoints or rollup pipeline                                                              |
| 08 Settings           | S-6.x      | ❌ Mostly not  | Team/roles/billing/API-keys admin endpoints absent (api-key middleware exists, management API doesn't) |
| 09 Shared Components  | S-7.x      | n/a            | Frontend work; ~16 primitives still to add                                                             |
| 10 Marketing & Growth | S-8.x      | ❌ No          | No campaigns/discounts schema or endpoints                                                             |

**Honest assessment:** roughly **2 of 10 spec modules are implementable today without new backend work**. The specs were written faster than the platform — which is fine, as long as the sequencing is made explicit.

---

## 10. Risk Register

| ID  | Risk                                                                                   | L    | I            | Mitigation                                                               |
| --- | -------------------------------------------------------------------------------------- | ---- | ------------ | ------------------------------------------------------------------------ |
| R1  | Schema drift / unreproducible environments (no migrations)                             | High | High         | C2 fix; CI migration check                                               |
| R2  | Regressions ship to master silently (no CI)                                            | High | High         | C1 fix; branch protection                                                |
| R3  | Payment flow bugs reach production (telebirr processors stubbed, money paths untested) | Med  | **Critical** | C3 + C5 fixes; contract tests for purchases                              |
| R4  | Permission model gap exposes revenue data (server never checks role)                   | Med  | High         | A6 fix before any dashboard analytics ships                              |
| R5  | Spec-implementation divergence compounds (13 specs vs 2 ready modules)                 | High | Med          | Adopt spec-by-spec vertical slices with API-first acceptance criteria    |
| R6  | Bus factor 1; undocumented tribal knowledge                                            | Med  | Med          | ADRs already help; add LICENSE/CONTRIBUTING, onboard a second maintainer |
| R7  | Supply-chain: pinned exclusions, no automated CVE watch                                | Low  | High         | Dependabot + Trivy in CI                                                 |

---

## 11. Prioritized Recommendations

### P0 — This week (unblocks everything, ≈2–3 days)

1. **Add CI** (GitHub Actions): install → `turbo lint typecheck test` → Trivy; protect `master`. _(C1, R2, R7)_
2. **Commit initial Drizzle migrations**; make `db:migrate` the documented flow; add a CI job that replays migrations on a fresh Postgres. _(C2, R1)_
3. **Fix the `spec /` trailing-space directory** and reconcile the 5 documented spec contradictions (roles, currency, gateways, subscription/refund, workspaces) in one small spec-update commit. _(C7, R5)_

### P1 — Next 1–2 weeks (closes the product loop)

4. **Implement the money path end-to-end**: purchase processor → telebirr capture → enrollment creation → stats recalculation → outbox event; add route-level tests for `purchases` + `enrollments` modules. _(C3, C5, R3)_
5. **Resolve the roles model**: decide workspaces vs per-course; add role resolution to `@abugida/auth` and enforce server-side on revenue/admin endpoints. _(A6, R4)_
6. **Build the missing API modules in spec order**: courses/catalog CRUD → notifications (schema already designed in this analysis) → analytics aggregates → search. Start OpenAPI-client generation for the dashboard. _(C4, A4)_

### P2 — Next month (hardening & scale)

7. Handler/service test coverage to 80% on money + enrollment paths; first dashboard component tests (TanStack Query hooks).
8. Renovate/Dependabot; remove `minimumReleaseAgeExclude` pins or give them expiry comments.
9. Replace processor `console.*` with `@abugida/observability` logger + trace context; queue dashboards.
10. README rewrite with the two-identity architecture diagram; LICENSE + CONTRIBUTING; decide marketing app's fate.
11. Wire `docker/tests/` suites into CI on a schedule (nightly), not just locally.

---

## Appendix A — Measured Metrics Snapshot

```
Commits: 87 (single author)          TS/TSX files: 422 (≈46.3k LOC)
Tables: 45 (6 domains)               Test files: 59 (packages 46 / api 13 / dashboard 0)
Indexes observed: 61+                TODO/FIXME: 18
console.* in pkg sources: 18         ": any" (non-test): ~16
Env vars: 109                        Just recipes: 88
CI pipelines: 0                      Compose files: 9 + profiles
ADRs: 9+ files (README claims 24)    UI primitives present: 16 of ~29 needed
```

## Appendix B — Key Evidence Paths

| Claim                        | Path                                                                                                                              |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| No CI                        | repo root: no `.github/` directory                                                                                                |
| No migrations                | `packages/database/` (no `drizzle/` dir; `drizzle.config.ts out: './drizzle'`)                                                    |
| Processor stubs              | `packages/queue/src/processors/{statistics,export,notification,purchase}.ts` (`console.debug`, "pending DB integration")          |
| Missing notifications schema | `packages/database/schema/` (no notifications domain)                                                                             |
| API module inventory         | `app/api/src/modules/` (15 modules; no courses/notifications/search/analytics)                                                    |
| Test distribution            | `app/api/tests/` (config+middleware only); `packages/*/tests/`                                                                    |
| Roles mismatch               | `spec /11-Global-Standards.md` §Roles vs `packages/database/schema/ops/{roles,course-roles}.ts`                                   |
| Currency/gateway reality     | `packages/database/schema/finance/purchases.ts` (`currency default ETB`), `payment-gateways.ts` (`providerName: 'telebirr'` only) |
| Trailing-space spec dir      | `app/dashboard/spec /` (13 files)                                                                                                 |
