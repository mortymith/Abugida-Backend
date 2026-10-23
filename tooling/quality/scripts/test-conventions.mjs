#!/usr/bin/env node
// QG-212 — Test naming & placement convention (advisory): tests live under
// tests/** or are colocated as *.test.ts(x); quarantine is reported.
import { execSync } from 'node:child_process'

let findings = 0
let out = ''
try {
  out = execSync('git ls-files "*.test.ts" "*.test.tsx"', { encoding: 'utf8' })
} catch {
  console.log('✓ (no tests found)')
  process.exit(0)
}
const tests = out.split('\n').filter(Boolean)
let quarantine = 0
for (const t of tests) {
  if (t.includes('/tests/quarantine/')) {
    quarantine++
    console.warn(`⚠ quarantined test (must be fixed or deleted within 14 days): ${t}`)
  }
  if (!/\.test\.(ts|tsx)$/.test(t)) {
    console.warn(`⚠ unexpected test file name: ${t}`)
    findings++
  }
}
const quota = Math.ceil(tests.length * 0.02)
if (quarantine > quota) {
  console.warn(
    `⚠ quarantine holds ${quarantine} files > 2% budget (${quota}) — ADR required (§8.4)`,
  )
}
console.log(
  `✓ ${tests.length} test file(s) checked, ${findings} naming finding(s), ${quarantine} quarantined`,
)
process.exit(0)
