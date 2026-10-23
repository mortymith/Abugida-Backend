#!/usr/bin/env node
// QG-504 — Patches are applied and reviewed: every file in patches/ must be
// referenced from pnpm-workspace.yaml patchedDependencies.
import { readFileSync, existsSync } from 'node:fs'

const ws = readFileSync('pnpm-workspace.yaml', 'utf8')
const patchedSection = ws.match(/patchedDependencies:([\s\S]*?)(\n\S|$)/)
const declaredPkgs = patchedSection
  ? [...patchedSection[1].matchAll(/^\s+'?([^:'\s]+)'?\s*:/gm)].map((m) => m[1])
  : []

if (!existsSync('patches')) {
  console.log('✓ no patches directory, nothing to check')
  process.exit(0)
}
import { readdirSync } from 'node:fs'
const patchFiles = readdirSync('patches').filter((f) => f.endsWith('.patch'))
let failed = false
for (const p of patchFiles) {
  // patch file name convention: <pkg-without-scope>+<version>.patch
  const pkg = p.split('+')[0]
  if (
    !declaredPkgs.some(
      (d) => d.replace(/^@/, '').includes(pkg) || pkg.includes(d.replace(/^@[^/]+\//, '')),
    )
  ) {
    console.error(`✗ patches/${p} is not referenced in pnpm-workspace.yaml patchedDependencies`)
    failed = true
  }
}
console.log(failed ? '✗ patch check failed' : `✓ ${patchFiles.length} patch file(s) all declared`)
process.exit(failed ? 1 : 0)
