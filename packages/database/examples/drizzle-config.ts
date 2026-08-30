import { defineConfig } from 'drizzle-kit'

/**
 * Example: Drizzle Kit configuration
 *
 * This file configures drizzle-kit for schema management,
 * migrations, and database introspection.
 *
 * Usage:
 *   pnpm --filter @abugida/database db:generate  # Generate migrations
 *   pnpm --filter @abugida/database db:push      # Push schema changes
 *   pnpm --filter @abugida/database db:migrate    # Run migrations
 *   pnpm --filter @abugida/database db:studio     # Open Drizzle Studio
 *   pnpm --filter @abugida/database db:pull       # Introspect database
 */
export default defineConfig({
  schema: './schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
