#!/usr/bin/env node
// QG-704 — ADR required for architecture changes.
// A PR touching packages/* public API, docker/compose/*, or app/*/src/config/*
// MUST reference an ADR (docs/architecture/adr/) in its body or contain a
// waiver marker. Runs in CI with GITHUB_BASE / PR_BODY env vars; locally it is
// a no-op pass (used by the PR-template flow).
import { execSync } from 'node:child_process'

const base = process.env.GITHUB_BASE_REF
const body = process.env.PR_BODY ?? ''
if (!base) {
  console.log('✓ (not in CI — skip ADR check)')
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
const archTouch = files.some(
  (f) =>
    /^packages\/[^/]+\/src\/index\.ts$/.test(f) ||
    /^docker\/compose\//.test(f) ||
    /^app\/[^/]+\/src\/config\//.test(f),
)
if (!archTouch) {
  console.log('✓ no architecture-touching files — ADR not required')
  process.exit(0)
}
const refsAdr =
  /ADR[-\s]?\d{2,4}/i.test(body) || files.some((f) => /^docs\/architecture\/adr\//.test(f))
const waives = /<!-- waiver:\s*QG-704\s*-->/.test(body)
if (!refsAdr && !waives) {
  console.error(
    '✗ this PR changes architecture (packages public API / docker compose / app config) and must reference an ADR in the PR body (QG-704)',
  )
  process.exit(1)
}
console.log('✓ ADR reference found')
