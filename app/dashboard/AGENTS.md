# Dashboard App — Agent Instructions

TanStack Start admin/instructor app for the Abugida platform (port 3000). Repo-wide tooling, monorepo layout, the shared-package list, and code style live in the root `AGENTS.md`. This file covers only what is dashboard-specific.

## Sources of truth

| File                                  | Owns                                                                                                             | Read when                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `DESIGN.md`                           | Design system of record: tokens, layout, components, roles, a11y, i18n, resilience, spec-conflict register (§15) | Any UI, layout, copy, or state decision |
| `theme.css`                           | Tailwind v4 implementation of those tokens — **not wired in yet, see below**                                     | Picking a token value                   |
| `spec /` (trailing space in the name) | Product specs `00`–`12`. Owns **screen behaviour**                                                               | Building or changing a screen           |
| `.env.example`                        | Env var contract                                                                                                 | Adding a config value                   |

`DESIGN.md` owns visual/interaction rules, `spec /` owns screen behaviour. When they disagree, `DESIGN.md` §15 records the resolution — follow it, don't pick a side and don't edit the spec to match code.

## Layout

```text
src/
├── routes/            # File-based routes: _auth/, _app/, __root.tsx, index.tsx
├── features/          # 13 domains: analytics, auth, courses, dashboard, library,
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

| Singleton             | Lives in                                                              |
| --------------------- | --------------------------------------------------------------------- |
| Env                   | `src/config/app.config.ts` → `env`                                    |
| DB client             | `src/config/db.config.ts` → `db`                                      |
| Auth server instance  | `src/config/auth.server.ts` → `auth`                                  |
| Auth server functions | `src/config/auth.config.ts` → `authServerFns` (consumed by the guard) |
| Auth client           | `src/lib/auth-client.ts` → `authClient`                               |
| Query client          | `src/integrations/tanstack-query/root-provider.tsx`                   |
| Observability         | `src/config/observability.config.ts`                                  |

Shared packages: import from `@abugida/{auth,database,queue,storage,observability}`. Subpaths in use are `@abugida/auth/tanstack/{client,guard,server}`, `@abugida/database/{client,auth,catalog,finance,learning,marketing,ops}`, and `@abugida/queue/tanstack`. Never reimplement their logic locally.

Auth is Google + Telegram only, via the `twoFactor` and `organization` plugins. Never add password, email, or password-reset UI. Any flow that assumes an email address (invites, receipts, notifications) needs a Telegram-safe path — a claimable link or code.

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

`@tanstack/ai` with OpenAI / Anthropic / Gemini / Ollama adapters is installed. Use the `chat()` API — not Vercel AI SDK's `streamText()`. Read API keys from `env.*`; never hardcode or pass them from the client. Existing bridges: `features/courses/server/courses.ai.impl.server.ts`, `features/library/server/library.transcripts.impl.server.ts`.

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
