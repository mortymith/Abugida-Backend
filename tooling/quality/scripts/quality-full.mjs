#!/usr/bin/env node
// QGS-001 §10 — full local mirror of G1 including Docker-dependent gates.
// Runs the fast gates first, then the system-binary linters. Every command
// failure aborts with a non-zero exit.
import { spawnSync } from 'node:child_process'

const STEPS = [
  ['typecheck', 'pnpm', ['typecheck']],
  ['lint', 'pnpm', ['lint']],
  ['syncpack', 'pnpm', ['lint:deps']],
  ['spelling', 'pnpm', ['lint:spelling']],
  ['docker', 'pnpm', ['lint:docker']],
  ['yaml', 'pnpm', ['lint:yaml']],
  ['shell', 'pnpm', ['lint:shell']],
  ['env', 'pnpm', ['lint:env']],
  ['editorconfig', 'pnpm', ['lint:editorconfig']],
  ['markdown', 'pnpm', ['lint:markdown']],
  ['secrets', 'pnpm', ['lint:secrets']],
  ['tests', 'pnpm', ['test']],
]

for (const [label, cmd, args] of STEPS) {
  console.log(`\n▶ ${label}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit' })
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
}
console.log('\n✓ quality — full local gate mirror green.')
