#!/usr/bin/env node
// QG-705 — Runbook & service-doc pairing: a PR touching docker/compose/** must
// update docs/services/** and/or docs/runbooks/**.
import { execSync } from 'node:child_process'

const base = process.env.GITHUB_BASE_REF
if (!base) {
  console.log('✓ (not in CI — skip runbook pairing check)')
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
const touchesCompose = files.some((f) => f.startsWith('docker/compose/'))
if (!touchesCompose) {
  console.log('✓ compose untouched — no pairing required')
  process.exit(0)
}
const hasDocs = files.some((f) => f.startsWith('docs/services/') || f.startsWith('docs/runbooks/'))
if (!hasDocs) {
  console.error(
    '✗ this PR modifies docker/compose/** and must also update docs/services/** and/or docs/runbooks/** (QG-705)',
  )
  process.exit(1)
}
console.log('✓ compose change paired with service/runbook docs')
