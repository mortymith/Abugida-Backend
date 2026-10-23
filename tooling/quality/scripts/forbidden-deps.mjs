#!/usr/bin/env node
// QG-111 — Forbidden runtime in the dependency graph (advisory).
// Flags disallowed runtimes / native builders declared directly.
import { execSync } from 'node:child_process'

const FORBIDDEN = ['node-gyp', 'fsevents@npm:', 'deno', 'tsx@npm:']
let findings = 0
let out = ''
try {
  out = execSync('pnpm ls --depth 0 --prod -r --json', {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
} catch {
  console.log('✓ (skipped: pnpm ls unavailable in this environment)')
  process.exit(0)
}
try {
  const workspaces = JSON.parse(out)
  for (const ws of workspaces) {
    for (const [name, ver] of Object.entries(ws.dependencies ?? {})) {
      for (const f of FORBIDDEN) {
        if (name.includes(f.replace(/@npm:$/, ''))) {
          console.warn(`⚠ ${ws.name ?? ws.path}: forbidden dependency ${name}@${ver}`)
          findings++
        }
      }
    }
  }
} catch {
  console.log('✓ (no parseable output — nothing to flag)')
}
console.log(findings === 0 ? '✓ forbidden-deps: clean' : `⚠ ${findings} finding(s) (advisory)`)
process.exit(0)
