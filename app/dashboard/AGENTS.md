# Dashboard App — Agent Instructions

You are working on the **Abugida Academy dashboard**, a TanStack Start application that serves as the admin/instructor interface for the Abugida education platform.

---

## 1. Architecture Overview

- **Framework:** TanStack Start (file-based routing via TanStack Router, SSR, server functions).
- **Runtime:** Bun >= 1.4.2. Never use Node-specific APIs.
- **Package manager:** pnpm >= 12 (workspace protocol). Never run `bun install` or `bun add`.
- **Monorepo scope:** This app lives at `app/dashboard`. Shared packages: `@abugida/auth`, `@abugida/database`, `@abugida/queue`, `@abugida/storage`.

---

## 2. Directory Structure

```text
src/
├── routes/          # TanStack Router file-based routes
├── features/        # Domain features (auth, courses, lessons, etc.)
├── components/      # Globally reusable UI components
│   ├── ui/          # Design-system primitives (shadcn)
│   └── common/      # Application-level shared components
├── config/          # Centralized configuration (env, auth, db)
├── lib/             # Generic utilities (auth client, cn helper)
├── server/          # Server-only code
│   └── functions/   # TanStack Start server functions
├── integrations/    # Third-party integration wiring (TanStack Query)
├── styles.css       # Global styles (Tailwind v4 + shadcn)
└── router.tsx       # Router factory
```

Only create directories that are actually needed. Never create empty folders to match a template.

---

## 3. Routing Conventions

All routes live under `src/routes/`. Use TanStack Router's file-based routing.

Route groups:

- `_auth/` — Unauthenticated pages (login, signup, mfa). No auth guard.
- `_app/` — Authenticated pages. Protected by `requireAuthBeforeLoad` in `_app/route.tsx`.
- `__root.tsx` — Root document shell (HTML, head, devtools, scripts).

After adding or renaming routes, regenerate the route tree:

```bash
pnpm --filter @abugida/dashboard generate-routes
```

Route files should stay thin: define the route, compose features, and delegate business logic to `features/`. Do not place substantial logic directly in route files.

---

## 4. Feature Organization

Business logic belongs in `src/features/<domain>/`. Each feature follows:

```text
features/<domain>/
├── components/      # Domain-specific UI
├── hooks/           # Domain-specific hooks (queries, mutations, state)
├── schemas/         # Zod validation schemas
├── server/          # Server-only domain logic
└── index.ts         # Public exports for this feature
```

Only create the subdirectories a feature actually needs. A feature's `index.ts` exports its public API — other features and routes import through it, never through internal files directly.

Existing feature: `features/auth/` (login, signup, MFA, session, provider auth).

---

## 5. File Naming

Use **dot-separated** names for all application files:

```text
<domain>.<purpose>.<extension>
```

Examples: `auth.login-form.tsx`, `auth.session.ts`, `auth.signup.schema.ts`.

Avoid kebab-case (`auth-login-form.tsx`) or bare names (`schema.ts`).

React component names use PascalCase while filenames stay dot-based:

```text
File: auth.login-form.tsx
Export: function LoginForm() { ... }
```

Route files follow TanStack Router's required naming (`__root.tsx`, `route.tsx`, `$param.tsx`, `index.tsx`).

---

## 6. Shared Package Usage

The dashboard depends on four workspace packages. Always import from these instead of reimplementing functionality locally.

| Package             | Import paths                                                                       | Purpose                         |
| ------------------- | ---------------------------------------------------------------------------------- | ------------------------------- |
| `@abugida/auth`     | `@abugida/auth`, `@abugida/auth/tanstack`, `@abugida/auth/providers`               | Auth server, client, middleware |
| `@abugida/database` | `@abugida/database/client`, `@abugida/database/auth`, `@abugida/database/<schema>` | Drizzle client, domain schemas  |
| `@abugida/queue`    | `@abugida/queue`, `@abugida/queue/tanstack`                                        | BullMQ queue management         |
| `@abugida/storage`  | `@abugida/storage`, `@abugida/storage/tanstack`                                    | S3-compatible object storage    |

Each shared package has framework-specific subpaths. Use the `/tanstack` subpath for TanStack Start integrations. Never create local copies of auth, database, queue, or storage logic.

---

## 7. Environment Variables — Centralized Config

**Never access `process.env` directly in application code.** An ESLint rule enforces this — only `src/config/app.config.ts` and `server.mjs` are exempt.

All environment access goes through `src/config/app.config.ts`:

```ts
import { env } from '#/config/app.config'

// Use env.DATABASE_URL, env.BETTER_AUTH_SECRET, etc.
```

The config file:

1. Calls `dotenv` to load `.env` into `process.env`.
2. Validates with a Zod schema.
3. Exports a fully typed `env` object.

If you need a new env var:

1. Add it to the Zod schema in `src/config/app.config.ts`.
2. Add it to `.env.example` with a comment.
3. Reference it via `env.VAR_NAME` — never `process.env.VAR_NAME`.

---

## 8. Better Auth Integration

Auth is configured in `src/config/auth.config.ts` using the shared `@abugida/auth` package:

- `createAuth(...)` — Server-side auth instance (Better Auth with two-factor + organization plugins).
- `getServerSession` / `refreshServerSession` / `signOutServer` / `getServerAccessToken` — Server functions for session management.
- `authServerFns` — Exported bundle of server functions, consumed by `requireAuthBeforeLoad`.

Client-side auth: `src/lib/auth.client.ts` creates an auth client via `createAuthClient` from `@abugida/auth/tanstack`.

When adding new auth features, use the existing `createServerFn` pattern from `@tanstack/react-start` and access auth through the shared config — do not create separate auth instances.

---

## 9. Database Usage

The database client is instantiated once in `src/config/db.config.ts`:

```ts
import { createClient } from '@abugida/database/client'
import { env } from './app.config'
export const db = createClient(env.DATABASE_URL)
```

Domain schemas are imported from `@abugida/database/<domain>` (e.g., `@abugida/database/auth`).

For database scripts (generate, migrate, push, pull, studio), run from the database package:

```bash
pnpm --filter @abugida/database db:generate
pnpm --filter @abugida/database db:migrate
pnpm --filter @abugida/database db:push
```

---

## 10. Server Functions

Server-only code lives in `src/server/functions/`. Use `createServerFn` from `@tanstack/react-start`:

```ts
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
```

Pattern:

- `.validator(...)` — Define and validate input with Zod or a type assertion.
- `.handler(...)` — Implement the server logic.

Feature-specific server logic should live in `features/<domain>/server/` instead of `src/server/functions/` when it is domain-owned.

Never expose server-only imports to client code. Use `createServerFn` as the boundary.

---

## 11. UI and Component Conventions

- **Component library:** shadcn (base-maia style, hugeicons icon library).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite`. Global styles in `src/styles.css`.
- **Fonts:** Outfit Variable (body), Raleway Variable (headings), via `@fontsource-variable`.
- **Utility:** `cn()` from the `cn` package, re-exported via `src/lib/utils.ts`.
- **Additional UI libs:** `@base-ui/react`, `@dnd-kit/*`, `@tiptap/*`, `class-variance-authority`, `input-otp`, `sonner`, `date-fns`.

UI components go in `src/components/ui/`. They must be generic — no domain-specific business logic.

Common reusable components (empty states, loading states, error states) go in `src/components/common/`.

Layout components go in `src/components/layout/` (create when needed).

---

## 12. Import and Dependency Rules

Path aliases:

- `#/` → `./src/*` (preferred, matches `package.json` imports field)
- `@/` → `./src/*` (also configured in tsconfig)

Dependency direction (strict):

```text
routes → features → lib / integrations
```

- Routes import from features. Features import from lib/integrations.
- Never create circular dependencies between features.
- Import from a feature's `index.ts` — never reach into its internal files.

---

## 13. Server/Client Boundaries

- **Server-only:** `src/server/`, `src/config/auth.config.ts`, `src/config/db.config.ts`, `features/*/server/`.
- **Client-safe:** `src/components/`, `src/lib/auth.client.ts`, `src/features/*/components/`, `src/features/*/hooks/`.
- `src/config/app.config.ts` is server-only despite its name (uses `process.env`, `dotenv`).
- Client-side env access uses `import.meta.env.VITE_*` — never bare `env.*` for browser code.

---

## 14. Duplicate Configuration Rules

- Never create a second database client, auth instance, or query client. Use the singletons in `src/config/db.config.ts`, `src/config/auth.config.ts`, and `src/integrations/tanstack-query/root-provider.tsx`.
- Never re-instantiate a shared package locally. If `@abugida/database` provides `createClient`, use it — don't write your own Drizzle setup.
- The auth client in `src/lib/auth.client.ts` is the single client-side auth instance.

---

## 15. Naming Conventions Summary

| Category         | Convention                  | Example                                |
| ---------------- | --------------------------- | -------------------------------------- |
| Files            | Dot-separated, lowercase    | `auth.login-form.tsx`                  |
| React components | PascalCase export           | `export function LoginForm()`          |
| Hooks            | `use` prefix, dot-separated | `useSession`, `useLastProvider`        |
| Schemas          | `<domain>.schema.ts`        | `auth.signup.schema.ts`                |
| Server functions | `<domain>.<action>.ts`      | `auth.login-event.ts`                  |
| Config files     | `<domain>.config.ts`        | `app.config.ts`, `auth.config.ts`      |
| Route files      | TanStack Router conventions | `__root.tsx`, `route.tsx`, `login.tsx` |

---

## 16. Development Commands

Run from the dashboard directory (`app/dashboard/`):

```bash
pnpm dev                    # Start dev server (port 3000)
pnpm build                  # Production build
pnpm lint                   # ESLint
pnpm format                 # Prettier + ESLint fix
pnpm check                  # Prettier check only
pnpm typecheck              # TypeScript --noEmit
pnpm generate-routes        # Regenerate routeTree.gen.ts
pnpm clean                  # Remove dist, .turbo, node_modules
```

Monorepo-scoped (from repo root):

```bash
pnpm --filter @abugida/dashboard <script>
```

---

## 17. Code Style

- No semicolons, single quotes, trailing commas, printWidth 100.
- React 19, TypeScript 6 (strict mode).
- Prefer `export function` over arrow functions for components.
- Use `import type` for type-only imports (`verbatimModuleSyntax` is enabled).

---

## 18. Before Creating a File

1. Search for existing functionality that solves the same problem.
2. Determine which feature domain owns the functionality.
3. Follow the dot-based naming convention.
4. Keep route files thin — delegate to features.
5. Do not duplicate logic already in a shared package.
6. Do not reorganize unrelated code.

---

## 19. TanStack AI

The dashboard includes TanStack AI packages (`@tanstack/ai`, adapters for OpenAI, Anthropic, Gemini, Ollama). When implementing AI features, use the `chat()` API (not Vercel AI SDK's `streamText()`). Import from `@tanstack/ai` and framework-specific adapters. Configure via the centralized env config — never hardcode API keys.
