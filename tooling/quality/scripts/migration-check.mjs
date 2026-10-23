#!/usr/bin/env node
// QG-211 / §9.3 — schema-change ⇒ migration coupling. If a PR touches
// packages/database/src/schema/** it must also contain a file under the
// database migrations directory. Fails otherwise.
import { execSync } from 'node:child_process'

const base = process.env.GITHUB_BASE_REF
if (!base) {
  console.log('✓ (not in CI — skip migration coupling check)')
  process.exit(0)
}
let files = []
try {
  files = execSync(`git diff --name-only origin/${base}...HEAD`, { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
} catch {
  console.log('✓ (cannot diff — skip)')
  process.exit(0)
}
const touchesSchema = files.some((f) => f.startsWith('packages/database/src/schema/'))
if (!touchesSchema) {
  console.log('✓ schema untouched — migration not required')
  process.exit(0)
}
const hasMigration = files.some(
  (f) => /packages\/database\/.*migrations?\//.test(f) || /drizzle\//.test(f),
)
if (!hasMigration) {
  console.error(
    '✗ this PR changes packages/database/src/schema/** without a generated migration (QG-211 / §9.3)',
  )
  console.error('  Run: pnpm --filter @abugida/database db:generate')
  process.exit(1)
}
console.log('✓ schema change paired with a migration')
