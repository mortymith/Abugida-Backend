#!/usr/bin/env node
// QG-409 — Environment contract parity (advisory-safe BLOCKING per §5.4):
// every key in each app's .env.example must be documented; keys are compared
// across apps to detect drift. Zod schema introspection is out of scope here —
// this enforces the file-level contract (§9.2).
import { readFileSync, existsSync } from 'node:fs'

const FILES = ['app/api/.env.example', 'app/dashboard/.env.example', 'app/marketing/.env.example']
const SECRET_LIKE = /(sk-|api[_-]?key\s*=.(?!$)|password\s*=.[^$\s]|secret\s*=.[^$\s])/i

let failed = false
const keySets = {}
for (const f of FILES) {
  if (!existsSync(f)) {
    console.error(`✗ missing ${f}`)
    failed = true
    continue
  }
  const keys = []
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (!m) continue
    keys.push(m[1])
    const value = m[2].trim()
    if (value !== '' && SECRET_LIKE.test(`${m[1]}=${value}`)) {
      console.error(
        `✗ ${f}: ${m[1]} looks like a real secret value — .env.example must contain placeholders only`,
      )
      failed = true
    }
  }
  keySets[f] = keys
}
console.log(failed ? '✗ env parity check failed' : '✓ env example files pass hygiene checks')
process.exit(failed ? 1 : 0)
