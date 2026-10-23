#!/usr/bin/env node
// QG-204/205/206 — Coverage threshold + ratchet check against
// tooling/quality/coverage-policy.json. Consumes a coverage-summary.json
// (path from argv or COVERAGE_SUMMARY) keyed by workspace with
// { lines: { pct }, functions: { pct }, branches: { pct } }.
import { readFileSync, existsSync } from 'node:fs'

const summaryPath = process.argv[2] ?? process.env.COVERAGE_SUMMARY ?? 'coverage-summary.json'
if (!existsSync(summaryPath)) {
  console.log(
    `✓ (no coverage summary at ${summaryPath} — coverage gate skipped until Phase 3 baseline lands)`,
  )
  process.exit(0)
}
const policy = JSON.parse(readFileSync('tooling/quality/coverage-policy.json', 'utf8'))
const summary = JSON.parse(readFileSync(summaryPath, 'utf8'))
let failed = false
for (const [ws, totals] of Object.entries(summary)) {
  const key = Object.keys(policy.workspaces).find(
    (k) => ws === k || (k.endsWith('/*') && ws.startsWith(k.slice(0, -1))),
  )
  if (!key) continue
  const floors = policy.workspaces[key]
  const eff = { ...floors }
  // ratchet: floor = max(policy floor, baseline)
  for (const metric of ['lines', 'functions', 'branches']) {
    const baseline = floors.baseline?.[metric]
    if (typeof baseline === 'number' && (eff[metric] == null || baseline > eff[metric]))
      eff[metric] = baseline
    const actual = totals?.[metric]?.pct
    if (eff[metric] == null) continue
    if (typeof actual !== 'number' || actual < eff[metric]) {
      console.error(`✗ ${ws}: ${metric} coverage ${actual ?? 'n/a'} < floor ${eff[metric]}`)
      failed = true
    }
  }
}
const diffPct = summary['diff-coverage']?.lines
if (typeof diffPct === 'number' && diffPct < policy.diffCoverage.lines) {
  console.error(`✗ diff coverage ${diffPct}% < ${policy.diffCoverage.lines}% (QG-205/206)`)
  failed = true
}
console.log(failed ? '✗ coverage gate failed' : '✓ coverage meets floors')
process.exit(failed ? 1 : 0)
