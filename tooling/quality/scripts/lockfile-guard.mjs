#!/usr/bin/env node
// QG-110 — No bun.lockb / no bun mutation (ADR-001). Zero tolerance.
import { existsSync, readFileSync } from 'node:fs'

let failed = false
if (existsSync('bun.lockb')) {
  console.error('✗ bun.lockb exists — the repo is pnpm-only (ADR-001). Remove it.')
  failed = true
}
if (existsSync('bun.lock')) {
  console.error('✗ bun.lock exists — the repo is pnpm-only (ADR-001). Remove it.')
  failed = true
}
const bunfig = readFileSync('bunfig.toml', 'utf8')
if (!/frozenLockfile\s*=\s*true/.test(bunfig)) {
  console.error('✗ bunfig.toml must set frozenLockfile = true')
  failed = true
}
process.exit(failed ? 1 : 0)
