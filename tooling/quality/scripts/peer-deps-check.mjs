#!/usr/bin/env node
// QG-302 — Sibling packages are peer dependencies (AGENTS.md rule).
// No @abugida/* in `dependencies` of packages/*; must be in peerDependencies + devDependencies.
import { readFileSync, readdirSync } from 'node:fs'

let failed = false
for (const dir of readdirSync('packages')) {
  const path = `packages/${dir}/package.json`
  let pkg
  try {
    pkg = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    continue
  }
  for (const [name] of Object.entries(pkg.dependencies ?? {})) {
    if (name.startsWith('@abugida/')) {
      console.error(
        `✗ ${path}: @abugida/* "${name}" must not be in dependencies (use peerDependencies + devDependencies)`,
      )
      failed = true
    }
  }
  for (const name of Object.keys(pkg.peerDependencies ?? {})) {
    if (name.startsWith('@abugida/') && !(pkg.devDependencies ?? {})[name]) {
      console.error(`✗ ${path}: peer dependency "${name}" must also be a devDependency`)
      failed = true
    }
  }
}
process.exit(failed ? 1 : 0)
