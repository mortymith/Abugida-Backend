#!/usr/bin/env node
// QGS-001 §10 — local fast gate runner (G1 static + test mirror, < 60 s, no Docker).
import { spawnSync } from 'node:child_process'

function run(label, cmd, args) {
  console.log(`\n▶ ${label}: ${cmd} ${args.join(' ')}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: false })
  if (r.status !== 0) {
    console.error(`\n✗ ${label} failed (exit ${r.status})`)
    process.exit(r.status ?? 1)
  }
}

run('typecheck', 'pnpm', ['typecheck'])
run('lint', 'pnpm', ['lint'])
run('syncpack', 'pnpm', ['lint:deps'])
run('spelling', 'pnpm', ['lint:spelling'])

console.log('\n✓ quality:fast — all local fast gates green.')
