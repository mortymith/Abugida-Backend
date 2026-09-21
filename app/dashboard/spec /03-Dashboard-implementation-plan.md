# Implementation Plan — Dashboard Module (Spec Part 03)

> **Target:** `@abugida/dashboard` (TanStack Start) · **Spec:** [`03-Dashboard.md`](03-Dashboard.md) · Screens S-1.1, S-1.2, S-1.3, S-1.4
> **Status:** Plan only — no implementation performed. Written to be executable by any engineer or AI agent without re-discovering the architecture.
> **Related specs:** [`00-Overview`](00-Overview-and-Sitemap.md) · [`02-Global-Navigation`](02-Global-Navigation.md) · [`09-Shared-Components`](09-Shared-Components.md) · [`11-Global-Standards`](11-Global-Standards.md)

---

## 1. Executive Summary

Spec part 03 defines four screens for the admin workspace: **Analytics Overview (S-1.1)**, **Revenue Analytics (S-1.2)**, **Global Search Results (S-1.3)**, and **Notifications Center (S-1.4)**. The app shell they live in (sidebar, header, breadcrumbs, ⌘K search trigger, auth guard) was recently implemented and is reusable as-is; the dashboard route itself is a placeholder with static `--` stat cards.

The audit found the UI layer well-prepared (complete shadcn kit, TanStack Query SSR integration already wired, feature-folder conventions documented in `AGENTS.md`), but the **data and authorization layers required by this spec do not exist yet**:

- **No RBAC anywhere** — the session carries no role (`@abugida/auth` `ResolvedSession` = id/email/name/emailVerified/image only). The sidebar already fakes `session.user.role ?? 'viewer'`. Role gating for S-1.2 (Admin/Editor only, Support explicitly excluded from revenue) is impossible until a role-resolution mechanism exists. This is the critical-path decision of the whole plan (Phase 1).
- **No analytics data source** — `analytics.aggregated_metrics` / `analytics.revenue` tables named by the spec do not exist. Existing tables (`purchases`, `purchase_transactions`, `enrollments`, `course_stats`) can support computed-on-read v1 aggregates, but refunds, subscriptions, and the Stripe/PayPal gateway split have **no data source** (Telebirr-only purchase flow, no refund state).
- **No notifications infrastructure** — no `notifications` table, no endpoints, no bell in the header. The queue's notification processors are outbound SMS/email only.
- **No global search** — the header search trigger exists but its hook is a `TODO` stub; the only server-side search is public `GET /search/bundles`.
- **Minor UI gaps** — no `table`/`pagination`/`chart` shadcn primitives, no chart library, sonner installed but `Toaster` never mounted, dashboard package has no test script.

The plan therefore sequences work as: **foundations & decisions (Phase 0–1) → data contracts (2) → the four screens in spec order (3–6) → cross-cutting polish (7) → testing (8) → build verification (9)**. Four decisions need explicit sign-off before coding (§12): RBAC mechanism, chart dependency, real-time strategy, and revenue-data degradation.

**Out of scope (documented deviations):** S-1.1 "Export" and S-1.2 "PDF Report" full flows (they belong to S-5.4 Export Reports, spec part 07 — v1 ships client-side CSV only), the Assets tab of S-1.3 (no `asset_library`/Content Library exists yet — spec part 05), and true realtime push for S-1.4 (v1 = polling; upgrade path documented).

---

## 2. Requirements Breakdown

### 2.1 Explicit requirements extracted from the spec

#### S-1.1 Analytics Overview (Admin, Editor, Viewer, Support)

| Category   | Requirement                                                                                                                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout     | Header "Dashboard" + date-range selector + Export; stats row of 4 cards (Revenue, Courses, Students, Avg Rating) each with delta trend (e.g. "+23% ↑"); chart row 2-col: Revenue Trend (line, last 30 days) + Enrollments (bar, last 30 days); course performance table (Course Name, Students, Completion, Revenue) — scrollable, paginated |
| Actions    | View metrics; interact with charts (hover details, zoom); filter by date range; export; click course row → S-2.6 Course Detail                                                                                                                                                                                                               |
| Data       | Reads `analytics.aggregated_metrics`, `analytics.revenue`, `analytics.enrollments` (tables do **not** exist — see §3.3)                                                                                                                                                                                                                      |
| States     | Default populated; loading = 4 skeleton cards + shimmer charts; empty = "No data available for the selected period." + CTA to adjust date range; error = "Unable to load analytics. Retry?" + retry button; date-range change re-queries                                                                                                     |
| Navigation | Course row → `/courses/$courseId` (S-2.6); chart interaction → S-5.1 (not built — defer); Export → S-5.4 (not built — CSV fallback)                                                                                                                                                                                                          |
| Responsive | Stat cards horizontal-scroll on mobile, single column; charts stack vertically on tablet                                                                                                                                                                                                                                                     |
| A11y       | Charts must expose an underlying data table as accessible alternative (spec 11); `aria-live` for async results                                                                                                                                                                                                                               |

#### S-1.2 Revenue Analytics (Admin, Editor only)

| Category   | Requirement                                                                                                                                                                                                                                                                                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout     | Header "Revenue Analytics" + date range + Export + PDF Report; 4 summary cards (Total, One-Time, Subscription, Refund) with YoY deltas; revenue-by-course horizontal bar chart; breakdown row = pie chart (one-time vs subscription) + gateway table (Payment Gateway, Transactions, Amount) |
| Actions    | Drill into revenue by course; export; **filter by payment gateway**                                                                                                                                                                                                                          |
| Data       | Reads `analytics.revenue`, `analytics.payment_transactions` (do **not** exist)                                                                                                                                                                                                               |
| States     | Default / skeleton / empty "No revenue data available." / error retry                                                                                                                                                                                                                        |
| Authz      | Roles per matrix (spec 11): Admin full; Editor view-only revenue; **Support no revenue access**; Reviewer/Viewer view-only (screen header says Admin, Editor — stricter screen rule wins: gate the _route_ to Admin+Editor, all others → no access)                                          |
| Navigation | Course row → S-2.6; Export → S-5.4                                                                                                                                                                                                                                                           |

#### S-1.3 Global Search Results (all roles)

| Category   | Requirement                                                                                                                                                                |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Purpose    | Unified results page backing the header search bar (S-A.1), spanning courses, lessons, students, content-library assets                                                    |
| Layout     | Header "Results for \"<q>\"" with search input; tabs with counts: All (n), Courses (n), Lessons (n), Students (n), Assets (n); grouped, ranked results under type headings |
| Actions    | Filter by entity type via tabs; click result → its detail screen; refine query without leaving the page                                                                    |
| Data       | Read-only query over `courses`, `lessons`, `users`, `asset_library` via a search index (only `courses`/`lessons`/`users` tables exist)                                     |
| States     | Default grouped/ranked; no results → S-7.3 empty state "No results for \"{query}\". Try a different term."; loading = skeleton rows per group                              |
| Navigation | Course → S-2.6, Lesson → S-2.7 (not built), Student → S-4.2 (not built), Asset → S-3.3 (not built) — deep links must degrade gracefully to existing routes                 |

#### S-1.4 Notifications Center (all roles)

| Category   | Requirement                                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entry      | Bell icon in header with unread-count badge (component also specified in spec 11 "Notification Bell": badge + dropdown preview)                                                          |
| Layout     | "Notifications" + "Mark all as read" + settings gear (→ S-6.1 notifications section, not built); tabs All / Mentions / System; feed rows with severity dot, icon, message, relative time |
| Actions    | Read/filter/mark-as-read; click notification → jump to its source screen; configure preferences (defer)                                                                                  |
| Data       | Reads/writes `notifications` table (read/unread state) — table does **not** exist, must be created                                                                                       |
| States     | Unread badge count; empty = "You're all caught up."; **real-time**: new items appear without manual refresh                                                                              |
| Deep links | Enrollment → S-4.2 (not built), Payment → S-1.2, Publish → S-2.6 (not built), Team invite → S-6.2 (not built), Review → S-2.14 (not built)                                               |

### 2.2 Cross-cutting requirements (spec 11 — binding for this module)

- **Roles & permissions matrix (Dashboard & Analytics row):** Admin Full · Editor Full (revenue view-only) · Reviewer view-only · Viewer view-only · **Support no revenue access**. "No access" hides UI affordances entirely (never disabled states) — S-1.2 route unreachable for Support/Reviewer/Viewer.
- **Permission-aware UI:** actions outside a role are hidden; read-only contexts show disabled controls _with explanatory tooltip_.
- **Design tokens:** primary `#8b5cf6`; money right-aligned with `tabular-nums`; display title 28px/700; body 14px; caption 12px; radius 8px cards / 12px modals; page canvas 24px padding; grid gutters 24/16/12; z-scale (toasts 300, modals 200).
- **Fonts note:** spec 11 says Inter; the app currently ships **Outfit Variable (body) + Raleway (headings)** via `@fontsource-variable` (Inter package _is_ installed). Follow the existing app fonts — do not switch the app's type ramp for this module (deviation recorded in §12.5).
- **Empty vs zero-result:** "no records ever" → S-7.3 empty state with CTA; "records exist but filter excludes them" → lighter "No matches — adjust filters" + "Clear filters" action. Both variants must be built.
- **Optimistic UI:** mark-as-read updates instantly and **rolls back with an error toast** on failure.
- **Toasts:** sonner; success auto-dismiss ~5s; errors manual dismiss/retry.
- **Motion:** 120/200/300ms, ease-out in / ease-in out; skeleton shimmer and any animation respect `prefers-reduced-motion`; interruptible.
- **Responsive:** <640px single column, tables → stacked cards; 640–1024px charts stack; 1024–1440px 2-col chart row; >1440px content max-width 1440 centered.
- **A11y (WCAG 2.2 AA):** full keyboard operability (tabs, table rows, menu), 2px focus ring offset, 4.5:1 contrast, status never color-only, charts expose data tables, `aria-live` announcements for async results, ≥40×40px touch targets, labeled inputs.
- **Keyboard shortcuts:** ⌘/Ctrl+K already implemented for search palette.

### 2.3 Assumptions requiring clarification (do not silently resolve)

| #   | Assumption                                                                                                                                              | Impact if wrong                                                                                                             | Recommended default                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| A1  | Role model comes from Better Auth **organization plugin** member roles (`owner/admin → admin`; custom `editor/viewer/support` via `ac`) — see §4.4      | Entire authz layer reworked                                                                                                 | Confirm in Phase 1 gate                                     |
| A2  | Dashboard reads Postgres **directly via server functions** (no Hono API hop) for v1                                                                     | If the team requires all reads through `app/api`, Phases 2–6 shift to building an admin module in the API first (+2 phases) | Server-function reads (rationale §4.3)                      |
| A3  | Revenue metrics degrade gracefully where no data source exists (refunds/subscriptions/gateway split)                                                    | Spec parity vs honesty of UI                                                                                                | Show "—" + tooltip "Not available yet"; do not fake numbers |
| A4  | "Courses" stat card = total published courses; "Students" = total enrolled learners; "Avg Rating" = platform-wide mean of `course_stats.average_rating` | Card semantics                                                                                                              | Confirm with product                                        |
| A5  | Date-range presets: 7d / 30d / 90d / 12mo + custom range; deltas are vs previous equal-length period                                                    | Chart/trend queries                                                                                                         | 7/30/90/365 presets                                         |
| A6  | Notifications are **per-user** (recipient = staff user); a writer-side producer (queue/event hooks) can land later without schema change                | Realtime scope                                                                                                              | v1 = read path + manual/seeded rows                         |
| A7  | S-1.2 is reached via a **sub-tab within /dashboard** ("Overview" / "Revenue"), since the sidebar only lists "Dashboard"                                 | Information architecture                                                                                                    | Tabs on the dashboard section                               |
| A8  | Chart zoom is out of scope for v1 (hover tooltips + accessible table only); "zoom" deferred to S-5.1 Analytics module                                   | Effort                                                                                                                      | Deferred, noted in UI                                       |

---

## 3. Current-State Assessment (Audit Results)

### 3.1 What exists and will be reused as-is

| Asset                                                                                                                                                                                                                                            | Location                                                                                            | Reuse                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| App shell: `SidebarProvider`/`AppSidebar`/`Header`/`SidebarInset`, auth guard via `requireAuthBeforeLoad(authServerFns)` returning `{ session }` into route context                                                                              | `src/routes/_app/route.tsx`                                                                         | Foundation for all four screens                                                                                      |
| shadcn UI kit (base-maia, hugeicons): `card, badge, tabs, dialog, dropdown-menu, sheet, sidebar, skeleton, tooltip, avatar, breadcrumb, collapsible, command, separator, spinner, alert, button, input, field, label, toggle…`                   | `src/components/ui/`                                                                                | Direct use; **missing** table/pagination/chart (Phase 0)                                                             |
| Command palette (⌘K) with recent-search persistence                                                                                                                                                                                              | `src/features/navigation/components/navigation.search-trigger.tsx`, `hooks/navigation.search.ts`    | S-1.3 entry point; hook is a stub to wire                                                                            |
| Breadcrumbs hook                                                                                                                                                                                                                                 | `features/navigation/hooks/navigation.breadcrumbs.ts`                                               | Page headers                                                                                                         |
| Auth server functions: `getServerSession`, `refreshServerSession`, `signOutServer`, `getServerAccessToken` + `useSession()` client hook                                                                                                          | `src/config/auth.config.ts`, `src/config/auth.server.ts`, `src/lib/auth-client.ts`, `features/auth` | Session for all screens; role resolution extends this                                                                |
| Singletons: env (`app.config.ts`, Zod-validated, ESLint-enforced), db (`db.config.ts` → `createClient(env.DATABASE_URL)`), query client in router context                                                                                        | `src/config/`, `src/integrations/tanstack-query/`                                                   | Mandatory singletons — no new instances                                                                              |
| **SSR query integration**: `setupRouterSsrQueryIntegration({ router, queryClient })` + `getContext()`                                                                                                                                            | `src/router.tsx`, `root-provider.tsx`                                                               | Established pattern: loaders call `context.queryClient.ensureQueryData(queryOptions(...))`; dehydration is automatic |
| Error/empty/not-found primitives                                                                                                                                                                                                                 | `components/common/error-message.tsx`, `not-found.tsx`                                              | Extend for retry-capable error state                                                                                 |
| Database tables: `users`, `enrollments`, `lesson_completions`, `course_reviews`, `courses`, `course_stats`, `course_stats_history`, `purchases`, `purchase_transactions`, `payment_gateways`, `roles/principals/permissions-reference` (unwired) | `packages/database/schema/{auth,learning,catalog,finance,ops}`                                      | Data sources for analytics/search                                                                                    |
| API module pattern (reference only): factory repo/service/handlers, Zod schemas, `{ data, meta }` envelope, RFC 9457 problem+json                                                                                                                | `app/api/src/modules/*`                                                                             | Convention template for dashboard server-side code                                                                   |
| Queue job types `AGGREGATE_METRICS` / `RECALCULATE_STATS` (stubs)                                                                                                                                                                                | `packages/queue/src/processors/statistics.ts`                                                       | Future writer for pre-aggregated metrics (not required for v1 compute-on-read)                                       |
| Toast lib `sonner` installed                                                                                                                                                                                                                     | `package.json`                                                                                      | Mount `Toaster` (Phase 0)                                                                                            |

### 3.2 Conventions that bind the implementation (from `app/dashboard/AGENTS.md`)

1. File naming **dot-separated** (`dashboard.stat-card.tsx`); components PascalCase exports; routes keep TanStack names.
2. Dependency direction `routes → features → lib/integrations`; import via feature `index.ts` only; no circular features.
3. **Never** touch `process.env` outside `app.config.ts`; client env only `import.meta.env.VITE_*`.
4. Server-only code: `src/server/`, `config/*.server.ts`, `features/*/server/`; boundary = `createServerFn`.
5. Single db client, single auth instance, single query client — never duplicate.
6. After route changes: `pnpm --filter @abugida/dashboard generate-routes`.
7. Code style: no semicolons, single quotes, printWidth 100, `import type`, `export function` preferred.
8. Commands: `pnpm dev|build|lint|typecheck|test|generate-routes` (test script currently absent — added in Phase 0).

### 3.3 Missing infrastructure (gap list driving the phases)

| Gap                                                                                                                                                                                                                            | Consequence                                              | Addressed in            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------- |
| No role on session; no RBAC helper in `@abugida/auth` or API; `organization()` plugin registered bare **and its `organization/member/invitation` tables are absent from the injected `authSchema`** (org endpoints would fail) | Cannot gate S-1.2; sidebar role filter currently fake    | **Phase 1**             |
| No analytics/metrics tables; `AGGREGATE_METRICS` processor stub; spec's `analytics.*` tables absent                                                                                                                            | Compute-on-read v1 (§4.3); pre-aggregation later         | Phases 2 (v1), future   |
| No refunds / subscription purchases / multi-gateway transactions (Telebirr only, status enum `INITIATED/PAYMENT_PENDING/COMPLETED/FAILED`)                                                                                     | S-1.2 partially unimplementable; degrade per A3          | Phase 2 contracts       |
| No `notifications` table or service; queue `NOTIFICATIONS` queue only does outbound SMS                                                                                                                                        | S-1.4 needs schema + read path                           | Phase 6                 |
| No search endpoint (only public `/search/bundles`); no admin user listing                                                                                                                                                      | S-1.3 server fn new                                      | Phase 5                 |
| No `asset_library` table                                                                                                                                                                                                       | Assets tab hidden                                        | Phase 5 deviation       |
| No `table`, `pagination`, `chart` shadcn primitives; no chart lib; `Toaster` unmounted; no bell in header; no test script in dashboard `package.json`                                                                          | UI + QA prerequisites                                    | Phase 0                 |
| Data-table UI for courses/students routes (S-2.x, S-4.x) not built                                                                                                                                                             | S-1.3 deep-link targets for lesson/student/asset missing | Graceful fallbacks (§9) |

---

## 4. Proposed Architecture

### 4.1 Route structure (TanStack file-based routing)

```
src/routes/
├── _app/
│   ├── route.tsx                  # existing — extended: resolves session + role into context (Phase 1)
│   ├── dashboard/
│   │   ├── index.tsx              # S-1.1 Analytics Overview  (replaces current _app/dashboard.tsx)
│   │   └── revenue.tsx            # S-1.2 Revenue Analytics   (beforeLoad role gate: admin|editor)
│   ├── search.tsx                 # S-1.3 Global Search Results (?q= validated search param)
│   └── notifications.tsx          # S-1.4 Notifications Center
```

- `_app/dashboard.tsx` (current placeholder) becomes `_app/dashboard/index.tsx` so `/dashboard/revenue` can nest as a sibling; both share a small layout route `_app/dashboard/route.tsx` rendering the section tab bar (Overview | Revenue — revenue tab rendered only for admin/editor per A7) and the page header slot.
- Route files stay **thin**: route definition + `beforeLoad`/`loader` + composition of feature components (AGENTS.md §3).
- `validateSearch` with Zod on `/dashboard` (date range params) and `/search` (`q`), so URL is the source of truth for filters and "refine without leaving the page" is just typing in the input.
- After any route addition: `pnpm --filter @abugida/dashboard generate-routes` (do not hand-edit `routeTree.gen.ts`).

### 4.2 Feature boundaries

```
src/features/
├── dashboard/                     # S-1.1 + S-1.2 domain (analytics + revenue)
│   ├── components/                # dashboard.stat-card, dashboard.date-range-picker,
│   │                              # dashboard.trend-line-chart, dashboard.enrollments-bar-chart,
│   │                              # dashboard.course-performance-table, dashboard.kpi-skeleton,
│   │                              # revenue.summary-cards, revenue.by-course-chart,
│   │                              # revenue.breakdown-pie, revenue.gateway-table
│   ├── hooks/                     # dashboard.queries.ts (queryOptions factories: overview, revenue, course-performance)
│   ├── schemas/                   # dashboard.date-range.schema.ts, dashboard.api.schemas.ts (Zod DTOs)
│   ├── server/                    # dashboard.overview.server.ts, dashboard.revenue.server.ts (createServerFn)
│   └── index.ts
├── search/                        # S-1.3
│   ├── components/                # search.results-tabs, search.result-group, search.result-row
│   ├── hooks/                     # search.queries.ts
│   ├── schemas/                   # search.params.schema.ts, search.results.schema.ts
│   ├── server/                    # search.global.server.ts
│   └── index.ts
├── notifications/                 # S-1.4
│   ├── components/                # notifications.bell, notifications.list, notifications.list-item,
│   │                              # notifications.empty
│   ├── hooks/                     # notifications.queries.ts (list, unread-count w/ refetchInterval),
│   │                              # notifications.mutations.ts (mark-read optimistic, mark-all-read)
│   ├── schemas/                   # notifications.filters.schema.ts, notifications.types.ts
│   ├── server/                    # notifications.list.server.ts, notifications.read.server.ts
│   └── index.ts
└── auth/                          # extended (existing feature)
    ├── hooks/auth.role.ts         # useRole() reading route context
    └── server/auth.roles.server.ts# getServerRole() (org member role resolution)
```

Shared/UI layer (no domain logic):

```
src/components/
├── ui/                            # + table.tsx, pagination.tsx, chart.tsx (shadcn primitives, Phase 0)
├── common/                        # + empty-state.tsx (S-7.3 standardized, two variants per spec 11),
│                                  # + retry-error-state.tsx (wraps existing error-message + retry button),
│                                  # + stat-trend.tsx (delta pill used by both S-1.1/S-1.2 cards)
└── layout/
    └── layout.notification-bell.tsx → thin composition over features/notifications (bell lives in header)
```

> Dependency rule check: `routes → features → lib/integrations`. The bell in `components/layout` composes the notifications feature — acceptable direction (layout already composes `features/navigation` and `features/auth`).

### 4.3 Data-fetching strategy (server/client boundaries)

**Pattern (one line):** route `loader` → `context.queryClient.ensureQueryData(queryOptions)` → `queryOptions.queryFn` calls a `createServerFn` in `features/*/server/` → handler uses the `db.config.ts` singleton with `@abugida/database/<domain>` schemas → Zod-validated DTO returned. SSR dehydrates the query cache automatically (`setupRouterSsrQueryIntegration` already configured); client interactions (date-range change, tab switch, refine query, mark-as-read) hit TanStack Query mutations/queries with the same server functions. **No component ever imports `db` or `@abugida/database` directly** — the `createServerFn` boundary is the only crossing (AGENTS.md §10/§13).

**Why server functions instead of new Hono `/admin/*` endpoints for v1:**

1. The dashboard already owns a db client and the pattern is explicitly sanctioned (`features/<domain>/server/`).
2. The API has **no RBAC**, so proxying through it today would mean building an admin auth surface in `app/api` too (its `FEATURE_ROUTE_PREFIXES`, middleware, role checks) — double the blast radius with zero product value yet.
3. Reads stay inside the SSR process: no cross-service auth, no client-side API tokens, minimal client JS.
4. Migration path is clean: the server-function handlers are thin over query logic that can later be lifted into an `analytics`/`admin` API module verbatim (repo→service→handlers), keeping the dashboard consuming the same DTOs. Record as ADR-style note in Phase 2.

**Queries and cache keys:**

| Query key                                         | Query                                         | Stale time                                                             |
| ------------------------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| `['dashboard','overview',{range}]`                | KPIs + deltas + trend series                  | 60s                                                                    |
| `['dashboard','revenue',{range}]`                 | revenue summary, by-course, by-gateway        | 60s                                                                    |
| `['dashboard','course-performance',{range,page}]` | paginated table                               | 30s                                                                    |
| `['search','global',{q,tab}]`                     | grouped results (enabled when `q.length ≥ 2`) | 15s                                                                    |
| `['notifications','list',{tab,page}]`             | paged feed                                    | 15s                                                                    |
| `['notifications','unread-count']`                | badge number                                  | 30s + `refetchInterval: 30_000` (S-1.4 "real-time" v1, per A-decision) |

- Date-range as **search params** (`/dashboard?range=30d`) → loaders re-run per navigation; back/forward works; shareable.
- Mutations: `markNotificationRead(id)`, `markAllNotificationsRead(tab)` with **optimistic update + rollback + error toast** (spec 11 optimistic-UI rule).
- Never fetch on the client what the loader already fetched (default `staleTime` set per table above; `defaultPreload: 'intent'` already warms links).

### 4.4 Authentication & authorization boundaries

- **Authentication** (existing, unchanged): `_app/route.tsx` `beforeLoad` → `requireAuthBeforeLoad(authServerFns)` → `{ session }` in route context; unauthenticated → redirect `/login?redirectTo=…`.
- **Role resolution** (Phase 1, decision A1 — recommendation: Better Auth organization plugin):
  - Add Better Auth's `organization`, `member`, `invitation` (and `twoFactor`) tables to the `authSchema` handed to `createAuth` in `@abugida/database` (they are required by the already-registered plugins but missing today).
  - Configure `organization({ ac, roles })` with the four platform roles mapping to spec 11: `admin` (full), `editor` (no settings/revenue-_edit_), `viewer` (read), `support` (no revenue). Users must belong to a default organization (seed script for existing users, or treat single-org as the workspace).
  - New `getServerRole()` server fn: session → active organization member role; cached per request in the `_app` route context (`{ session, role }`); `requireRolesBeforeLoad(['admin','editor'])` helper composes with the existing guard for `/dashboard/revenue`.
  - Client: `useRole()` from context drives the revenue tab, bell visibility (all roles), and nav filtering — replacing the `session?.user.role ?? 'viewer'` cast-hack in `layout.app-sidebar.tsx`.
  - Fallback (if A1 rejected): minimal `role` column on `users` (app-owned extension, Better Auth `additionalFields`) + seed migration. Simpler, but duplicates the `ops.roles` concept and diverges from the already-registered org plugin — hence not recommended first.
- **Enforcement layers:** route-level (`requireRolesBeforeLoad`) is the hard gate; component-level hiding is UX only (spec 11 permission-aware UI) — never the only guard. Server functions independently re-check role before executing privileged reads (defense in depth for revenue fn).
- **Session staleness:** better-auth cookie cache is 60s JWE — after any future role mutation use `refreshServerSession` (exists) so the sidebar/tab visibility updates immediately.

### 4.5 Loading / empty / error architecture

One standardized triad built once in `components/common/` and consumed everywhere (spec 09 S-7.3 + spec 11):

| State                      | Component                                                                                                                                            | Contract                                                                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Loading                    | `Skeleton` primitives per surface (stat card grid = 4 skeletons; charts = shimmer blocks; search = grouped skeleton rows; notifications = list rows) | Honors `prefers-reduced-motion` (opacity pulse, no shimmer movement)                                                                                                                                              |
| Empty (no data ever)       | `EmptyState` variant `icon + message + CTA`                                                                                                          | S-1.1: "No data available for the selected period." + "Adjust date range"; S-1.2: "No revenue data available."; S-1.4: "You're all caught up."; S-1.3 no-results: "No results for \"{q}\". Try a different term." |
| Zero-result (filtered out) | `EmptyState` variant `compact`                                                                                                                       | "No matches — adjust filters" + "Clear filters" (resets search params)                                                                                                                                            |
| Error                      | `RetryErrorState` (extends existing `error-message.tsx`)                                                                                             | "Unable to load analytics. Retry?" / "Unable to load revenue data. Retry?" — retry = `queryClient.refetch`                                                                                                        |

Loaders throw typed errors surfaced by TanStack Router `errorComponent` per route; partial-failure strategy: independent query observers per section (stats / charts / table) so a table failure doesn't blank the KPIs.

### 4.6 State management

- **Server state:** TanStack Query exclusively (no client caches of DTOs).
- **URL state:** TanStack Router search params (date range, search query + tab, notifications tab, table page).
- **Local UI state:** `useState` (dialog open, etc.). `@tanstack/react-store` available but not needed for v1 — do not introduce.
- **No new global providers.** Router context extension (`role`) is the only context change.

---

## 5. Route / File Structure (target, full)

```
app/dashboard/src/
├── routes/_app/
│   ├── route.tsx                              # MOD  — role resolution in beforeLoad, context { session, role }
│   ├── dashboard/
│   │   ├── route.tsx                          # NEW  — section layout: header + tab nav (Overview|Revenue)
│   │   ├── index.tsx                          # NEW  — S-1.1 (moved from ../dashboard.tsx)
│   │   └── revenue.tsx                        # NEW  — S-1.2 (gated)
│   ├── search.tsx                             # NEW  — S-1.3
│   └── notifications.tsx                      # NEW  — S-1.4
├── features/dashboard/{components,hooks,schemas,server}/…
├── features/search/{components,hooks,schemas,server}/…
├── features/notifications/{components,hooks,schemas,server}/…
├── features/auth/{hooks/auth.role.ts, server/auth.roles.server.ts}
├── components/ui/{table,pagination,chart}.tsx # NEW shadcn primitives
├── components/common/{empty-state,retry-error-state,stat-trend}.tsx
├── components/layout/layout.notification-bell.tsx
├── config/ (unchanged singletons)
└── routes/__root.tsx                          # MOD — mount <Toaster /> (sonner)

packages/database/
├── schema/auth/{organization,member,invitation}.ts   # NEW — Better Auth generated shape (Phase 1, per A1)
├── schema/auth/index.ts                              # MOD — export new tables into authSchema
├── schema/ops/notifications.ts                       # NEW — notifications table (Phase 6)
└── schema/ops/index.ts                               # MOD — export
```

New **DB schema — `ops.notifications` (Phase 6):** `id (bigint pk)`, `publicId (uuid unique)`, `userId → auth.users` (recipient), `type` enum `enrollment | payment | publish | mention | system | team_invite | review`, `title`, `body`, `linkEntityType`, `linkEntityPublicId` (deep-link pair), `readAt (timestamptz null)`, `createdAt` + indexes `(userId, readAt)`, `(userId, createdAt desc)`. Written by future producers (queue enrollment/purchase/publish processors or DB triggers); v1 ships read path + seed script for QA.

---

## 6. Implementation Phases

> Every phase ends with: `pnpm --filter @abugida/dashboard typecheck && pnpm --filter @abugida/dashboard lint && pnpm --filter @abugida/dashboard generate-routes` (when routes changed) all green, unless stated otherwise.

### Phase 0 — Foundations & dependency validation _(no spec behavior yet)_

**Files:** `components/ui/table.tsx`, `components/ui/pagination.tsx`, `components/ui/chart.tsx` (shadcn CLI or manual, base-maia style + hugeicons), `components/common/empty-state.tsx`, `components/common/retry-error-state.tsx`, `components/common/stat-trend.tsx`, `routes/__root.tsx` (+`<Toaster richColors position="top-right"/>`), `package.json` (+`recharts`, `@testing-library/react`, `happy-dom` devDeps, `test: "bun test"` script), optional repo `docs/architecture/adr/ADR-026-…` decision records.

**Do:** add the three primitives; mount Toaster; add test script; **decision gate** — record sign-off on A1–A3, A7 (§12).

**Depends on:** nothing. **Verify:** `typecheck`/`lint` green; a scratch route renders `Table`+`Chart`+`EmptyState`+toast (removed after check); `bun test` runs pass-with-no-tests.

### Phase 1 — RBAC foundation (critical path)

**Files:** `packages/database/schema/auth/{organization,member,invitation}.ts` + `schema/auth/index.ts` + migration (`pnpm --filter @abugida/database db:generate` → `db:migrate` against dev Docker stack), `src/config/auth.server.ts` (configure `organization({ ac, roles })` with admin/editor/viewer/support + `sendInvitationEmail` no-op dev impl), `features/auth/server/auth.roles.server.ts`, `features/auth/hooks/auth.role.ts`, `features/auth/index.ts`, `routes/_app/route.tsx` (context `{ session, role }`), `components/layout/layout.app-sidebar.tsx` (use real role), `scripts/seed` org+members seed.

**Depends on:** Phase 0 (decisions). **Verify:** unit tests for `getServerRole` (owner→admin mapping, no-org → `viewer` fallback); manual: support account sees no Revenue tab & direct URL `/dashboard/revenue` redirects to `/dashboard`; `refreshServerSession` clears staleness after role change.

### Phase 2 — Data contracts & analytics server functions

**Files:** `features/dashboard/schemas/dashboard.date-range.schema.ts` (presets 7d/30d/90d/12mo + custom `{from,to}`, Zod), `dashboard.api.schemas.ts` (KPI DTO with `delta` + `availability: 'ok'|'no-data'|'unsupported'` flags), `features/dashboard/server/dashboard.overview.server.ts` (SQL aggregates over `enrollments`, `courses`, `course_stats`, `purchases`: totals + period-over-period deltas + 30-day daily series), `dashboard.revenue.server.ts` (totals from `purchase_transactions` joined `payment_gateways`; **subscription/refund DTO fields return `availability:'unsupported'`** per A3), `features/dashboard/hooks/dashboard.queries.ts`.

**Depends on:** Phase 1 (role check inside revenue fn). **Verify:** `bun test` unit tests for date-range math (DST-safe via `date-fns`), delta computation, DTO `availability` flags; SQL smoke against dev DB; no `process.env` lint violations.

### Phase 3 — S-1.1 Analytics Overview

**Files:** `routes/_app/dashboard/route.tsx` (tabs layout), `routes/_app/dashboard/index.tsx` (loader = `ensureQueryData(overviewOptions)`; `validateSearch` for `range`), `features/dashboard/components/dashboard.{stat-card,date-range-picker,trend-line-chart,enrollments-bar-chart,course-performance-table,kpi-skeleton}.tsx`, accessible `<ChartDataTable>` alternative inside chart components (spec 11 a11y), export util `dashboard.export-csv.ts` (client-side CSV of loaded data — S-5.4 deferred).

**Depends on:** Phases 0–2. **Verify:** all four spec states reachable (throttle network / empty DB / 500 mock); course row navigates to `/courses/$courseId` (route not built → graceful fallback §9); horizontal scroll stat row at <640px; charts have `role="img"` + visually-hidden data table; tabular-nums on all money.

### Phase 4 — S-1.2 Revenue Analytics (gated)

**Files:** `routes/_app/dashboard/revenue.tsx` (`requireRolesBeforeLoad(['admin','editor'])`), `features/dashboard/components/revenue.{summary-cards,by-course-chart,breakdown-pie,gateway-table,gateway-filter}.tsx` (gateway filter fed by `payment_gateways`), PDF Report button → `disabled` + tooltip "Coming with Export Reports (S-5.4)".

**Depends on:** Phases 2–3 (shared tabs layout, cards, chart primitives). **Verify:** admin/editor see page; support/viewer/reviewer get redirect; unsupported-metric cards render "—" + tooltip; gateway filter updates query via search param; empty/error states per spec copy.

### Phase 5 — S-1.3 Global Search Results

**Files:** `features/search/schemas/search.{params,results}.schema.ts`, `features/search/server/search.global.server.ts` (bounded `ILIKE` search over `courses`, `lessons` (via module join for course context), `users` (admin-visible fields only: name/email-publicId); grouped `{type, count, top[]}` + per-tab paged queries; strict result caps e.g. 20/group), `routes/_app/search.tsx` (`validateSearch` `q` + `tab`), `features/search/components/search.{results-tabs,result-group,result-row}.tsx`, wire `features/navigation/hooks/navigation.search.ts` → real query (keep ⌘K dialog + recents), hide Assets tab (A-scope) until Content Library.

**Depends on:** Phases 0–1 (role context for student-visible-field decisions). **Verify:** typing refines results without leaving page (URL param updates); counts match per tab; deep links: course → `/courses/$courseId` fallback dashboard, lesson/student → fallback with toast "Coming soon" (§9); no-results → S-7.3 variant; skeleton rows per group while loading.

### Phase 6 — S-1.4 Notifications Center

**Files:** `packages/database/schema/ops/notifications.ts` + export + migration, `features/notifications/schemas/*`, `features/notifications/server/notifications.{list,read}.server.ts` (list w/ tab filter + cursor pagination; `unread-count`; `mark-read`; `mark-all-read` — all re-check recipient userId), `features/notifications/hooks/notifications.{queries,mutations}.ts` (optimistic read/unread-all with rollback + error toast; `refetchInterval` 30s on unread-count), `components/layout/layout.notification-bell.tsx` (badge + dropdown preview of 5 recent + "View all"), `routes/_app/notifications.tsx` (tabs All/Mentions/System — _Mentions/System map to type subsets; System = `system|publish|team_invite`_, mark-all button, gear → `/settings` placeholder toast), seed script for demo rows.

**Depends on:** Phase 1 (user id); independent of 3–5 (parallelizable). **Verify:** badge decrements optimistically and rolls back on simulated failure; tab filters; empty state copy exact; deep links degrade for unbuilt targets; unread persists across reloads; polling visible in devtools without user action.

### Phase 7 — Cross-cutting polish (responsive, a11y, motion)

**Files:** edits across the four features + `styles.css` only where tokens missing.

**Do:** reduced-motion overrides for shimmer; focus-trap order in dialogs (already from primitives — verify); `aria-live="polite"` region announcing query refetch results; contrast pass on delta pills (4.5:1); 40px touch targets on tabs/rows; mobile stacked cards for course-performance + gateway tables (hidden-column pattern); wide-screen `max-w-[1440px] mx-auto` canvas.

**Depends on:** Phases 3–6. **Verify:** keyboard-only walkthrough script (§10 checklist); 320/375/768/1024/1440/1920 visual pass; axe scan clean of critical violations.

### Phase 8 — Testing

See §7 strategy; tests are written alongside phases 2–6 but Phase 8 hardens coverage + CI wiring (`turbo test` already invokes `test` per package).

### Phase 9 — Build & production verification

**Do:** `pnpm build` (turbo, all workspaces); `pnpm --filter @abugida/dashboard build` artifact check; run dashboard Dockerfile build (`docker build -f app/dashboard/Dockerfile .` from repo root — multi-stage expects monorepo context); smoke `bun run vite preview`; verify no server-only imports leaked into client bundle (vite output inspection / `#config/app.config` must not appear client-side).

**Depends on:** all. **Verify:** §10 final checklist all green.

---

## 7. Testing Strategy

**Runner:** `bun test` (repo convention — `app/api` uses it; add `test: "bun test"` to dashboard). Component tests need `happy-dom` + `@testing-library/react` (small, justified devDeps — the only test-specific additions). DB-backed tests reuse the dev compose Postgres (`DATABASE_URL` from `.env.test`), or run pure-SQL against a throwaway schema; avoid mocking Drizzle internals.

| Layer                | Scope                                                                                                                                                                           | Priority                  | Notes                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------- |
| Unit (pure)          | date-range math, deltas, CSV serializer, DTO mappers, `availability` flags                                                                                                      | P0                        | No DB                             |
| Unit (server fns)    | `dashboard.overview/revenue`, `search.global`, `notifications.list/read` against seeded test DB: row math, role re-check (403 path), tenant scoping (`userId` on notifications) | P0                        | Critical journey = revenue gating |
| Component            | `stat-card` (delta + availability), `empty-state` variants, `retry-error-state`, `result-row` deep-link fallback, bell badge                                                    | P1                        | happy-dom + testing-library       |
| Route/integration    | loaders with `queryClient` + MSW-free approach: call server fns directly; `validateSearch` parsing; `requireRolesBeforeLoad` redirect behavior                                  | P1                        |                                   |
| Auth/authz scenarios | admin/editor/viewer/support × {/dashboard, /dashboard/revenue, /search, /notifications} matrix (S-1.2 hard gate)                                                                | P0                        |                                   |
| Error/empty states   | simulated 500 / empty DB / zero-result filter for every surface                                                                                                                 | P1                        | Spec copy asserted verbatim       |
| Responsive           | Playwright _optional_ (not installed — flag as decision); otherwise manual matrix + component-level media-query tests                                                           | P2                        |                                   |
| E2E journeys         | "admin opens dashboard → changes range → opens course from table → marks notification read"; "support cannot reach revenue"                                                     | P1 manual / P2 Playwright |                                   |

**Prioritized critical journeys (from spec):** ① role isolation of revenue data ② overview states quartet ③ search refine-without-leaving-page ④ optimistic notification read + rollback.

---

## 8. Dependency Graph / Order of Work

```
Phase 0 (primitives, Toaster, decisions)
  └─ Phase 1 (RBAC: org tables, role ctx, sidebar fix)
       ├─ Phase 2 (DTOs + server fns)  ──┬─ Phase 3 (S-1.1) ── Phase 4 (S-1.2)
       │                                 └─ Phase 5 (S-1.3, needs role ctx only)
       ├────────────────────────────────── Phase 6 (S-1.4 — needs DB migration; parallel with 3–5)
       └─────────────── Phase 7 (polish, after 3–6) ── Phase 8 (hardening) ── Phase 9 (build)
```

Parallelizable: Phases 3 and 6 (different features, no shared files beyond Phase 0 primitives); Phases 5 and 6 likewise. Sequence-critical: 1 → 2 → 4 (revenue unreachable without roles) and 0 → everything (primitives/Toaster).

---

## 9. Risk & Edge-Case Analysis

| #   | Risk / edge case                                                                                         | Likelihood      | Mitigation                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | RBAC decision (A1) changes shape of Phase 1                                                              | Medium          | Decision gate before code; fallback (role column) isolated to `auth.roles.server.ts` — single swap point                                                             |
| R2  | Revenue spec (subscriptions/refunds/Stripe/PayPal) has **no data source** — risk of fake-looking UI      | Certain         | `availability:'unsupported'` DTO contract; honest "—" + tooltip; product review before hiding vs showing                                                             |
| R3  | Large aggregates on-read get slow as data grows                                                          | Medium          | Bound queries (`LIMIT`, indexed date columns, cursor pagination); `course_stats` reuse; ADR notes upgrade to `AGGREGATE_METRICS` pre-computation (queue stub exists) |
| R4  | "Real-time" notifications expectation vs 30s polling                                                     | Medium          | Documented deviation + upgrade path (SSE endpoint or WebSocket); badge also refetches on window focus                                                                |
| R5  | Deep-link targets (S-2.6/2.7, S-4.2, S-3.3, S-6.x) don't exist yet                                       | Certain         | Central `entityLink()` mapper returns existing route or dashboard fallback + info toast; mapper is the single touch-point when routes land                           |
| R6  | Missing org tables break `organization()` plugin at runtime (pre-existing landmine)                      | High if touched | Phase 1 adds tables + seed **before** any org API call; flag to backend owners — API app's auth instance doesn't register the plugin at all (asymmetry)              |
| R7  | Session role staleness (60s cookie cache) after role change                                              | Low             | Use existing `refreshServerSession` in role-mutation flows; document                                                                                                 |
| R8  | Search cost/abuse (unbounded `ILIKE`)                                                                    | Medium          | Min query length 2, per-type caps, debounce 300ms (exists), rate-limit friendly (server fn on same origin), later pg_trgm index or the planned search index          |
| R9  | routeTree drift                                                                                          | Low             | `generate-routes` in every phase verification; CI typecheck would fail on drift                                                                                      |
| R10 | Router patch (`patches/@tanstack__react-router@1.170.38.patch`) — upgrading router for chart/table needs | Low             | No router version changes in this plan; pnpm patches respected                                                                                                       |
| R11 | Timezones in date ranges (server UTC vs user local, Ethiopia UTC+3)                                      | Medium          | All DTO boundaries ISO-8601 with explicit TZ; ranges computed client-side in user TZ, compared server-side as instants                                               |
| R12 | Money rounding/precision (`numeric(10,2)` vs float)                                                      | Low             | Keep `numeric` → serialize as string cents-aware; format with `Intl.NumberFormat('EN', {style:'currency', currency:'USD'})` per product decision                     |
| R13 | Toast/notification spam during polling failures                                                          | Low             | Query `retry: 2`, toasts only on mutation failures, not background refetch                                                                                           |

---

## 10. Acceptance Criteria (spec-verbatim, testable)

**S-1.1**

- [ ] Header shows "Dashboard", date-range selector, Export
- [ ] 4 KPI cards (Revenue, Courses, Students, Avg Rating) with delta indicators
- [ ] Revenue Trend line chart (30d) + Enrollments bar chart render; hover shows details
- [ ] Course performance table paginated; row click navigates (or graceful fallback)
- [ ] Loading: 4 skeleton cards + shimmer charts; Empty: exact copy + adjust-range CTA; Error: exact copy + Retry that recovers
- [ ] Date-range change updates cards + charts
- [ ] Charts expose accessible data tables

**S-1.2**

- [ ] Reachable only by admin/editor (support/viewer/reviewer redirected; UI affordances hidden)
- [ ] Summary cards Total/One-Time/Subscription/Refund (unsupported metrics render honestly)
- [ ] Revenue-by-course horizontal bar chart; breakdown pie + gateway table
- [ ] Gateway filter re-queries; Export CSV works; PDF button visibly deferred
- [ ] Empty/error copies exact

**S-1.3**

- [ ] `/search?q=…` renders grouped results with per-type counts and tabs
- [ ] Refining the query updates results without navigation
- [ ] Course/lesson/student rows deep-link (fallback where unbuilt)
- [ ] No-results shows S-7.3 empty variant; loading shows per-group skeletons
- [ ] ⌘K dialog navigates here on submit

**S-1.4**

- [ ] Header bell with unread badge (count = unread, 30s auto-refresh)
- [ ] `/notifications` lists All/Mentions/System tabs with relative times
- [ ] Mark single + mark all as read; **optimistic with rollback toast on failure**
- [ ] Notification click deep-links per type (fallback where unbuilt)
- [ ] Empty state "You're all caught up."

**Cross-cutting**

- [ ] All keyboard-operable, visible focus, WCAG 2.2 AA contrast, reduced-motion honored
- [ ] Breakpoints per spec 11 (mobile stacked/h-scroll, tablet stacked charts, desktop 2-col, wide 1440 cap)
- [ ] Money uses tabular numerals; no color-only status
- [ ] `pnpm build` + `typecheck` + `lint` green; no client bundle leak of server-only code

---

## 11. Verification Checklist (execute before hand-off)

```bash
# from repo root
pnpm --filter @abugida/database db:generate && pnpm --filter @abugida/database db:migrate
pnpm --filter @abugida/dashboard generate-routes
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

- [ ] Migrations apply clean on a fresh dev DB (`just dev` stack up); rollback safe
- [ ] Role matrix walkthrough: seed admin/editor/viewer/support accounts; verify nav visibility + route gates + revenue fn 403
- [ ] Spec-state walkthrough per screen (default/loading/empty/zero-result/error)
- [ ] Keyboard-only pass: tab order, ⌘K, dialogs return focus
- [ ] Manual responsive pass at 320/375/768/1024/1440/1920
- [ ] `rg "process.env" app/dashboard/src` → only `app.config.ts`
- [ ] No feature crosses imports (`rg "from '#/features/[a-z]+/" app/dashboard/src/features` — only `index.ts` entries)
- [ ] Client bundle grep: `rg -l "config/app.config|config/db.config|config/auth.server" app/dashboard/dist` → no hits
- [ ] Worklog updated (`/home/z/my-project/worklog.md`)

---

## 12. Decisions Requiring Sign-off (gate before Phase 1)

| #   | Decision         | Recommendation                                                                                                             | Alternative                                                                                   |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| D1  | Role mechanism   | Better Auth `organization` plugin with `ac` roles (admin/editor/viewer/support) + missing org tables added to `authSchema` | `role` column on `users` via Better Auth `additionalFields` (simpler, duplicates `ops.roles`) |
| D2  | Read path        | Server functions + `db.config` singleton (v1); API admin module = future extraction                                        | Build `/admin/*` Hono module + RBAC middleware in `app/api` first                             |
| D3  | Chart dependency | Add `recharts` (shadcn `chart.tsx` wrapper) — the single new runtime dep                                                   | Hand-rolled SVG (high effort, poor a11y)                                                      |
| D4  | Realtime         | TanStack Query polling (30s) + focus refetch                                                                               | SSE endpoint (later ADR)                                                                      |
| D5  | Revenue honesty  | Unsupported metrics show "—" + tooltip; hide card only after product review                                                | Hide cards entirely                                                                           |
| D6  | Fonts            | Keep Outfit/Raleway app ramp (spec's Inter already installed for future per spec 11 alignment)                             | Switch to Inter globally (touches whole app, not this module)                                 |
