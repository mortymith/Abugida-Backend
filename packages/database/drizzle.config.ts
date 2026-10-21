import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Resolve the repository `.env` relative to this file so the config works
// no matter which directory the command (drizzle-kit, knip, …) runs from.
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

config({ path: path.join(repoRoot, '.env') })

const url = process.env.DATABASE_URL

if (!url) {
  throw new Error('DATABASE_URL is required (set it in root .env or as env var)')
}

export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
})
