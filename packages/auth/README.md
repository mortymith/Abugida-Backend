# @abugida/auth

Shared Better Auth configuration and schema for the Abugida monorepo.

## Commands

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint .
```

## Usage

```ts
import { auth } from "@abugida/auth";
```

Environment variables (loaded via `dotenv`):

- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
