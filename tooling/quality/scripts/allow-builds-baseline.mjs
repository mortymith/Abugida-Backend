#!/usr/bin/env node
// QG-503 — No unapproved native builds: diff pnpm-workspace.yaml allowBuilds
// against the committed baseline.
import { readFileSync, existsSync } from 'node:fs'

const BASELINE = 'tooling/quality/allow-builds-baseline.txt'
const ws = readFileSync('pnpm-workspace.yaml', 'utf8')
const current = [...ws.matchAll(/^\s{2}-\s*(.+)$/gm)].map((m) => m[1])
const section = ws.match(/allowBuilds:([\s\S]*?)(\n\S|$)/)
const builds = section
  ? [...section[1].matchAll(/^\s+-\s*(.+)$/gm)].map((m) => m[1].trim().replace(/^['"]|['"]$/g, ''))
  : []
void current

if (!existsSync(BASELINE)) {
  if (builds.length > 0) {
    console.error(
      `✗ ${BASELINE} missing — commit the baseline of ${builds.length} allowBuilds entries first`,
    )
    process.exit(1)
  }
  console.log('✓ no native builds allowed, none declared')
  process.exit(0)
}
const baseline = readFileSync(BASELINE, 'utf8')
  .split('\n')
  .map((s) => s.trim())
  .filter(Boolean)
const added = builds.filter((b) => !baseline.includes(b))
if (added.length > 0) {
  console.error('✗ new native builds without an ADR (QGS-001 QG-503):')
  for (const a of added) console.error(`  - ${a}`)
  process.exit(1)
}
console.log('✓ allowBuilds matches baseline')
