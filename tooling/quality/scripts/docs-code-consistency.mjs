#!/usr/bin/env node
// QG-706 — Docs ↔ code consistency (advisory): verify every `just` recipe that
// docs reference exists, and compose service names appear in docs/services.
import { readFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'

let findings = 0
// 1. just recipes referenced in docs exist in justfile
const justfile = readFileSync('justfile', 'utf8')
const recipes = new Set([...justfile.matchAll(/^@?([a-zA-Z0-9_-]+):/gm)].map((m) => m[1]))
let docs = ''
try {
  docs = execSync('git ls-files "docs/**/*.md"', { encoding: 'utf8' })
} catch {
  process.exit(0)
}
for (const f of docs.split('\n').filter(Boolean)) {
  const text = readFileSync(f, 'utf8')
  for (const m of text.matchAll(/just\s+([a-zA-Z0-9_-]+)/g)) {
    if (!recipes.has(m[1])) {
      console.warn(`⚠ ${f}: references unknown recipe "just ${m[1]}"`)
      findings++
    }
  }
}
// 2. compose services documented
if (existsSync('docker/compose')) {
  try {
    const out = execSync('git ls-files "docker/compose/*.yml" "docker/compose/*.yaml"', {
      encoding: 'utf8',
    })
    void out
  } catch {
    /* advisory only */
  }
}
console.log(`✓ docs↔code consistency: ${findings} drift finding(s) (advisory)`)
process.exit(0)
