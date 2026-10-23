#!/usr/bin/env node
// QG-410 — No secret material tracked: only *.example env files may be committed.
import { execSync } from 'node:child_process'

let out = ''
try {
  out = execSync('git ls-files', { encoding: 'utf8' })
} catch (e) {
  console.error(`✗ git ls-files failed: ${e.message}`)
  process.exit(1)
}
const tracked = out.split('\n').filter(Boolean)
const bad = tracked.filter(
  (f) => /(^|\/)\.env/.test(f) && !f.endsWith('.example') && !/\.env\.example/.test(f),
)
if (bad.length > 0) {
  console.error('✗ tracked .env files that are not *.example:')
  for (const f of bad) console.error(`  - ${f}`)
  process.exit(1)
}
console.log('✓ no secret material tracked in git')
