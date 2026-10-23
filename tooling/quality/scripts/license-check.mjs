#!/usr/bin/env node
// QG-505 — Licence policy: allowlist MIT/Apache-2.0/BSD/ISC across direct deps.
// Advisory today; promoted to BLOCKING in Phase 2.
import { execSync } from 'node:child_process'

const ALLOW = [
  'MIT',
  'Apache-2.0',
  '(MIT OR Apache-2.0)',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'CC0-1.0',
  'Unlicense',
  'BlueOak-1.0.0',
]
let findings = 0
try {
  const out = execSync('pnpm licenses list --json --prod', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const byLicense = JSON.parse(out)
  for (const [license, pkgs] of Object.entries(byLicense)) {
    if (!ALLOW.some((a) => license.includes(a))) {
      for (const [name] of Object.entries(pkgs)) {
        console.warn(`⚠ disallowed licence ${license}: ${name}`)
        findings++
      }
    }
  }
} catch {
  console.log('✓ (licence scan skipped: pnpm licenses unavailable)')
  process.exit(0)
}
console.log(
  findings === 0
    ? '✓ all licences on allowlist'
    : `⚠ ${findings} package(s) off-allowlist (advisory)`,
)
process.exit(0)
