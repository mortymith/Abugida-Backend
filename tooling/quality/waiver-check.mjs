#!/usr/bin/env node
// QGS-001 §13 — CI waiver check.
// Verifies that every failing BLOCKING gate referenced in the waiver registry
// has a non-expired waiver file at docs/quality/waivers/<gate-id>-<yyyy-mm-dd>-<slug>.md
// Usage: node tooling/quality/waiver-check.mjs [--gate QG-xxx]...
// Exit 0 = all waivers valid; exit 1 = expired/missing/invalid waiver.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const WAIVER_DIR = 'docs/quality/waivers'
const MAX_AGE_DAYS = 30
const HARD_LIMIT_GATES = new Set([
  'QG-401',
  'QG-402',
  'QG-101',
  'QG-104',
  'QG-301',
  'QG-302',
  'QG-109',
  'QG-501',
])

const args = process.argv.slice(2)
const requestedGates = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--gate') requestedGates.push(args[++i])
}

const errors = []
const active = []

let files = []
try {
  files = readdirSync(WAIVER_DIR).filter((f) => f.endsWith('.md'))
} catch {
  files = []
}

for (const file of files) {
  const m = file.match(/^(QG-\d+)-(\d{4}-\d{2}-\d{2})-(.+)\.md$/)
  if (!m) {
    errors.push(`INVALID name: ${file} (expected <gate-id>-<yyyy-mm-dd>-<slug>.md)`)
    continue
  }
  const [, gateId, createdStr, slug] = m
  const created = new Date(`${createdStr}T00:00:00Z`)
  const expiry = new Date(created)
  expiry.setUTCDate(expiry.getUTCDate() + MAX_AGE_DAYS)
  const now = new Date()
  if (now > expiry) {
    errors.push(
      `EXPIRED: ${file} (expired ${expiry.toISOString().slice(0, 10)}; archive it to docs/quality/waivers/archive/ and remove it)`,
    )
    continue
  }
  if (HARD_LIMIT_GATES.has(gateId)) {
    errors.push(`HARD-LIMIT: ${file} — gate ${gateId} may never be waived (QGS-001 §13.5)`)
    continue
  }
  const body = readFileSync(join(WAIVER_DIR, file), 'utf8')
  for (const field of [
    'Gate ID',
    'Scope',
    'Justification',
    'Compensating control',
    'Owner',
    'Expiry',
  ]) {
    if (!body.includes(field)) errors.push(`INCOMPLETE: ${file} is missing the "${field}" field`)
  }
  active.push({ gateId, file, slug })
}

if (requestedGates.length > 0) {
  for (const gate of requestedGates) {
    if (!active.some((w) => w.gateId === gate)) {
      errors.push(`MISSING: no valid waiver found for failing gate ${gate}`)
    }
  }
}

if (errors.length > 0) {
  console.error('Waiver check FAILED:')
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log(
  `Waiver check OK: ${active.length} active waiver(s), none expired, none on hard-limit gates.`,
)
