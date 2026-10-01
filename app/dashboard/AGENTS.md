# Dashboard App — Agent Instructions

TanStack Start admin/instructor app for the Abugida platform (port 3000). Repo-wide tooling, monorepo layout, the shared-package list, and code style live in the root `AGENTS.md`. This file covers only what is dashboard-specific.

## Sources of truth

| File                                  | Owns                                                                                                                                                                                                          | Read when                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `DESIGN.md`                           | Design system of record: tokens, layout, components, roles, a11y, i18n, resilience, spec-conflict register (§15)                                                                                              | Any UI, layout, copy, or state decision     |
| `theme.css`                           | Tailwind v4 implementation of those tokens — **not wired in yet, see below**                                                                                                                                  | Picking a token value                       |
| `spec /` (trailing space in the name) | Product specs `00`–`13`. Owns **screen behaviour**. Read `00` § _How to Read This Specification_ first — it holds the precedence rules, the screen template, the glossary, and the Revision 3 change register | Building or changing a screen               |
| `spec /13-Identity-and-Workspaces.md` | **Identity authority** — workspace model, the two role systems, effective role, what is configurable where. Read before writing any role or permission check                                                  | Touching roles, workspaces, invites, or MFA |
| `spec /archive/`                      | Superseded snapshots (Rev 1 HTML export). Never a source of truth                                                                                                                                             | Checking what changed across revisions      |
| `.env.example`                        | Env var contract                                                                                                                                                                                              | Adding a config value                       |

`DESIGN.md` owns visual/interaction rules, `spec /` owns screen behaviour. When they disagree, `DESIGN.md` §15 records the resolution — follow it, don't pick a side and don't edit the spec to match code. All 20 rows in that register are **Resolved**; rows 21–22 cover the identity model. If you find a new disagreement, add a row rather than silently resolving it in one file.

**The UI ships English and Amharic** (`en-US`, `am-ET`, both LTR). Two independent settings: a per-user choice in [S-6.5](08-Settings.md#scr-6-5) and a workspace default in [S-6.1](08-Settings.md#scr-6-1). A user's explicit choice survives a later change to the workspace default — the default only reaches users who have not chosen. Resolution order, missing-string fallback, and the build gate are in `spec /11` § _UI Language Resolution_. Course **content** language is a separate setting (`courses.content_language`, `en`/`am`/`ti`/`gez`); the two never infer each other.

**Screens follow a required field set** (Purpose, User Roles, Wireframe, Primary Actions, Data, States, **Resilience**, Navigation). `- **Resilience:**` is mandatory on all 76 screens and covers 403, 404, offline, session expiry, and conflict — a screen without it is unfinished. Which of loading/empty/error apply to a given surface type is tabulated in `spec /11-Global-Standards.md` § _Resilience States_; a toast legitimately has no empty state.

## Layout

```text
src/
├── routes/            # File-based routes: _auth/, _app/, __root.tsx, index.tsx
├── features/          # 13 domains: analytics, auth, courses, dashboard, media,
│                      #   marketing, navigation, notifications, onboarding, search,
│                      #   settings, students, support
├── components/
│   ├── ui/            # shadcn primitives — shadcn owns naming and content
│   ├── common/        # App-wide shared: empty/error/confirm/palette/toast
│   └── layout/        # App shell — layout.<name>.tsx
├── config/            # Singletons: app, auth, auth.server, db, observability
├── lib/               # Cross-cutting utils: format, entity-links, auth-client, utils
├── hooks/             # Generic hooks only
├── server/functions/  # App-wide server functions; domain ones live in features/*/server
├── integrations/      # TanStack Query root provider
├── default-entry/     # Server entry — auth path dispatch, then the Start handler
├── styles.css         # The only live global stylesheet
└── router.tsx
```

Create a directory only when code needs it. Never scaffold empty folders.

## Routing

- `_auth/` — unauthenticated: `login`, `signup`, `mfa`. No guard.
- `_app/` — authenticated. `_app/route.tsx` `beforeLoad` runs `requireAuthBeforeLoad` and resolves the platform role once per navigation. Put new screens in an `_app/<area>/` folder with its own `route.tsx` layout, mirroring the existing areas.
- `__root.tsx` is the document shell; `index.tsx` is the root redirect.
- Route files stay thin: define the route, compose features, delegate logic to `features/`.

After adding or renaming a route, regenerate the tree:

```bash
pnpm --filter @abugida/dashboard generate-routes   # writes routeTree.gen.ts (never hand-edit)
```

## Features

```
features/<domain>/
├── components/   # Domain UI
├── hooks/        # Domain hooks (queries, mutations, local state)
├── schemas/      # Zod schemas
├── server/       # Server functions + server-only impls
└── index.ts      # Public API — import this, not internal files
```

- Create only the subdirectories the domain needs.
- Cross-feature and route imports go through `index.ts`. A few legacy deep type/const imports exist; don't add more.
- Keep pure logic (math, parsing, reducers, permission and state machines) in framework-free `<domain>.<topic>.ts` modules at the feature root. This is what the 37 `bun test` suites exercise directly.
- `features/*/server/` pairs a thin `createServerFn` wrapper (`<domain>.<topic>.ts`) with the real work in `<domain>.<topic>.impl.server.ts`, imported dynamically inside the handler. **Follow this pattern** for new server code — it keeps the wrapper safe for the client bundle.

## Naming

- Application files: dot-separated `<domain>.<purpose>.<ext>` — `auth.session.ts`, `courses.markdown.ts`, `layout.app-sidebar.tsx`.
- Server-only: `.server.ts` suffix, with the implementation in `.impl.server.ts`.
- Components: PascalCase export inside a dot-named file (`auth.login-form.tsx` → `export function LoginForm()`).
- Route files: TanStack Router naming (`__root.tsx`, `route.tsx`, `$param.tsx`, `index.tsx`).
- `src/components/ui/` is kebab-case and shadcn-managed — add components via shadcn, don't hand-convert.
- Tests: `tests/<domain>.<purpose>.test.ts`, colocated in the flat `tests/` dir, not next to source. Run with `pnpm test` (bun test).
- Seed/migration scripts: `scripts/<app>.<purpose>.ts`.

## Config and singletons

**`process.env` is banned by an ESLint rule** (only `src/config/app.config.ts` and `server.mjs` are exempt). To add a variable: add it to the Zod schema in `src/config/app.config.ts`, document it in `.env.example`, then read it as `env.VAR_NAME` on the server. Client code may only read `import.meta.env.VITE_*` — which is why most vars exist in server/`VITE_` pairs.

Never create a second instance of anything in this table:

| Singleton             | Lives in                                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Env                   | `src/config/app.config.ts` → `env`                                                                                        |
| DB client             | `src/config/db.config.ts` → `db`                                                                                          |
| Auth server instance  | `src/config/auth.server.ts` → `getAuth()`                                                                                 |
| Auth server functions | `src/config/auth.config.ts` → `authServerFns` (RPC declarations; behaviour from `serverSession` & co. in `@abugida/auth`) |
| Auth client           | `src/lib/auth-client.ts` → `authClient`                                                                                   |
| Query client          | `src/integrations/tanstack-query/root-provider.tsx`                                                                       |
| Observability         | `src/config/observability.config.ts`                                                                                      |

Shared packages: import from `@abugida/{auth,database,queue,storage,observability}`. Subpaths in use are `@abugida/auth/tanstack/{client,guard,server}`, `@abugida/auth/{env,roles}`, `@abugida/database/{client,auth,catalog,finance,learning,marketing,ops}`, and `@abugida/queue/tanstack`. Never reimplement their logic locally.

`@abugida/auth` owns the auth instance, plugin registry, env contract, role vocabulary, organization authorization and the behaviour behind the auth server functions. The four `authServerFns` in `src/config/auth.config.ts` are RPC _declarations_ only: TanStack Start's server-function transform does not reach a workspace package's `dist/`, and its import protection denies a route-reachable module from importing `*.server.*` (where the instance lives) — so the app declares, the package implements. The dashboard contributes environment, db client and logger only (`createAbugidaAuth({ env: resolveAuthEnv(env), db, logger })`), and reaches the instance through `getAuth()`. Auth env variables come from `authEnvShape`, not from `app.config.ts`.

Auth is Google + Telegram only. The `twoFactor` and `organization` plugins are registered by `@abugida/auth` (the client side registers the matching client plugins), so the dashboard cannot enable or extend them. Never add password, email, or password-reset UI. Any flow that assumes an email address (invites, receipts, notifications) needs a Telegram-safe path — a claimable link or code.

**Roles are enforced by capability, not by the role string.** There are two independent systems: `member.role` (workspace-wide, one text value) and `course_roles` (per course, grantable and revocable). The **effective role** is the union of both, **capped by** the member role — a course role never grants what the member role denies. Because `member.role` is a bare text column, **Reviewer and Support are not member roles**; they are capability-shaped and come from course roles or member flags. `spec /13-Identity-and-Workspaces.md` § _The Two Role Systems_ is the authority, and `Part 11` § _Course Lifecycle Capabilities_ is the enforcement table. Permission checks stay server-side; the UI role badge is context, never a gate.

**Four gaps block parts of the spec** and are recorded in `spec /13` § _Implementation Gaps_. The critical one: **`invitation.email` is `notNull()`**, so the claimable-link invite the Telegram-safe delivery rule requires cannot be stored — make it nullable and add `handle` + `token` before building any invite flow in Parts 01, 06, 08, 10, or 13. The auth client registers `organizationClient()`/`twoFactorClient()` through `@abugida/auth`, so workspace switching is available client-side.

## Server / client boundary

- **Server-only:** `src/config/{app,auth,auth.server,db,observability}.config.ts`, every `*.server.ts`, `src/default-entry/`.
- **Client-safe:** `src/components/`, `src/lib/auth-client.ts`, `src/hooks/`, `features/*/{components,hooks,schemas}`.
- `createServerFn` from `@tanstack/react-start` is the boundary. Reach server-only modules through a dynamic `await import()` inside the handler, never a top-level import.
- Permission checks are server-side. Hiding a nav item, route, or count in the UI is convenience, not security — enforce with `requireRolesBeforeLoad` in `beforeLoad`.

## UI stack

- shadcn (`base-maia`) + Tailwind v4 via `@tailwindcss/vite`; shadcn config in `components.json`.
- `hugeicons` (`@hugeicons/react`) is the shipped icon set. One set only, no emoji.
- `cn()` from the `cn` package, re-exported by `src/lib/utils.ts`.
- `src/components/ui/` stays generic — no domain logic. Shared app pieces go in `components/common/`, shell pieces in `components/layout/`.
- Global styles: `src/styles.css`.

## TanStack AI

`@tanstack/ai` with OpenAI / Anthropic / Gemini / Ollama adapters is installed. Use the `chat()` API — not Vercel AI SDK's `streamText()`. Read API keys from `env.*`; never hardcode or pass them from the client. Existing bridges: `features/courses/server/courses.ai.impl.server.ts`, `features/media/server/media.transcripts.impl.server.ts`.

## Design-system migration state

`theme.css` is the token target but is **not imported anywhere**. `src/styles.css` is the only live stylesheet, so:

- **The only tokens that resolve today are the shadcn `base-maia` ones** in `styles.css`: `bg-background`, `text-foreground`, `text-muted-foreground`, `bg-primary`, `border-border`, `bg-card`, `bg-chart-*`, etc.
- The `theme.css` utilities — `bg-surface`, `bg-app`, `text-ink`, `border-hairline`, `.pill-*`, `.btn-*`, `.card`, `.input`, `.skeleton`, `.nav-item`, `min-w-target`, `num`, `z-toast` — **do not exist yet**. Using them ships unstyled markup.
- Current fonts are Outfit Variable + Raleway Variable. `theme.css` targets Inter + Noto Sans Ethiopic + JetBrains Mono; the swap is pending with the import.
- To land the migration: `@import '../../theme.css';` after `@import 'tailwindcss';` in `src/styles.css`, then migrate component by component. Don't fork a copy into `src/`, and don't add a new hardcoded colour to either system while the split exists.
- Dark mode is a scaffolded token set, not a finished theme. Don't add dark-only styling.

Rules that hold on either palette — details in `DESIGN.md` §§3, 5, 7, 9, 10, 12:

- Semantic tokens only in components; never consume palette values (`--color-violet-*`) directly.
- WCAG 2.2 AA: 4.5:1 text, 3:1 UI. One meaning per colour — purple is brand/interaction, `Published` is success, AI is never signalled by hue alone (sparkle + "AI draft" + dashed border + human accept).
- Focus ring is never removed; every interactive element is keyboard operable with default/hover/focus/active/disabled/loading/error states.
- Every screen ships loading, empty, zero-result, error, 403, and offline states, plus autosave, resumable uploads, session-expiry, and concurrent-edit handling per `DESIGN.md` §12.
- Externalize all strings. Ethiopic is first-class: Noto Sans Ethiopic, `line-height: 1.6`, no letter-spacing, no fixed-px line clamps, no required name split.
- Revenue is redacted **server-side** for the Support role. Charts: max 6 series then "Other", plus a data-table and text alternative; pie only for ≤4 slices.
