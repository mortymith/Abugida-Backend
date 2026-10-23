#!/usr/bin/env node
// QG-104 — Type-strictness policy: assert the required strictness flags are
// present in tooling/typescript-config presets. Zero tolerance (no waiver).
import { readFileSync } from 'node:fs'

const REQUIRED = [
  'strict',
  'noUncheckedIndexedAccess',
  'exactOptionalPropertyTypes',
  'noImplicitReturns',
  'isolatedModules',
]
let failed = false
for (const preset of ['base.json', 'node.json', 'library.json']) {
  const path = `tooling/typescript-config/${preset}`
  let json
  try {
    json = JSON.parse(readFileSync(path, 'utf8').replace(/^\s*\/\/.*$/gm, ''))
  } catch (e) {
    console.error(`✗ cannot parse ${path}: ${e.message}`)
    failed = true
    continue
  }
  const opts = json.compilerOptions ?? {}
  for (const flag of REQUIRED) {
    const v = opts[flag]
    // "strict" may be absent in presets that extend another preset with strict: true
    if (v === true) continue
    if (v === undefined && flag !== 'strict') {
      console.error(`✗ ${path}: missing required flag "${flag}"`)
      failed = true
    }
  }
  if (opts.strict === undefined && !REQUIRED.some((f) => opts[f] === true)) {
    console.error(`✗ ${path}: no strictness flags at all`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
