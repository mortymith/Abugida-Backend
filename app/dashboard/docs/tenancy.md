# Workspace (tenant) scope — status

Spec 13 makes a **workspace** (`organization`) the unit that owns data. Spec 02
S-A.1 requires the navigation shell to be built on it. This file records what is
enforced today and what is still open, so the next change does not have to
rediscover it.

## The rule

The active workspace comes from the **session**, server-side:

```ts
// features/workspaces/server/workspaces.impl.server.ts
requireActiveOrganizationIdImpl(): Promise<string> // throws NO_ACTIVE_WORKSPACE
```

It throws rather than returning `null`. A read with no workspace is the 403 case
in spec 11 — it must never degrade into "no filter", which would read every
workspace's rows. `courses.server-helpers.server.ts` and
`library.server-helpers.server.ts` both re-export it so the two features cannot
drift on the rule.

## Schema

`courses.organization_id` and `asset_library.organization_id` (`text`, FK to
`organization.id` `ON DELETE CASCADE`, indexed).

- `drizzle/0025` adds the columns and **backfills** rows that predate tenancy to
  the earliest workspace — the only deterministic owner, and it deletes nothing.
- `drizzle/0026` then sets `NOT NULL`. A database with no organization fails here
  loudly, which is intentional: silently unscoped rows are worse than refusing to
  run.

Every insert path stamps the active workspace (`courses`: details, import,
duplication, templates; `asset_library`: upload, duplicate — a duplicate keeps
the source's workspace so it is only ever reachable to members who could already
see the original). `tests/tenancy.spec-13.test.ts` fails the build if a new
insert site forgets.

## Scoped reads (enforced)

| Surface                                                                | Where                                                        |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| Course resolution (details, curriculum, publish, duplicate, delete, …) | `resolveCourse()` — everything downstream inherits the scope |
| Course catalog list + counts                                           | `courses.catalog.impl.server.ts`                             |
| Review queue + nav badges                                              | `courses.reviews.impl.server.ts`                             |
| Global search (courses, lessons, assets)                               | `search.global.impl.server.ts`                               |
| Library: asset resolve, list, counts, folders, duplicate, usage links  | `features/library/server/*`                                  |

A cross-workspace course or asset reads as **not found**, not as "forbidden" —
confirming that it exists somewhere is itself a leak.

One deliberate exception: the nav **badge** returns zero instead of throwing when
the caller has no workspace at all. There is nothing to count in that case, and a
count must never take the navigation shell down. It still never counts another
workspace's rows.

## Still open

These read courses without a workspace condition and will show another
workspace's data once a second workspace exists:

- `students/*` — directory, rules, requests, messaging
- `analytics/*` (incl. export) and `dashboard/*` overview + course performance
- `marketing/*` — campaigns, coupons, affiliates, testimonials
- `onboarding/checklist`
- `asset_folders` — folder **names** are workspace-agnostic (their asset counts
  are scoped); folders would need the same `organization_id` treatment
- `app/api` — the learner-facing API reads courses independently of the
  dashboard shell and has its own scope problem

The pattern to follow is the one in `resolveCourse()` / `activeWorkspaceScope()`:
resolve the active workspace once per request and fold it into the query's
predicate. Two options beyond that, when the open surfaces get worked:

1. Add `organization_id` to the remaining tenant tables (enrollments, coupons,
   campaigns, …) — required for students/marketing regardless, since their rows
   belong to a workspace even when no course join is involved.
2. Consider Postgres row-level security keyed on a per-request `SET LOCAL`
   setting, so new queries are scoped by default rather than by review. That is a
   data-layer change, not a feature change, and fails closed by default.

## Verification note

The scoped paths were verified by typecheck, lint, unit tests and by an SSR
harness against a live database (`shell contract verified for all roles`). The
migrations in this change have **not** been applied to a running database in the
session that produced it — run `pnpm --filter @abugida/database db:migrate`
before starting the dashboard.
