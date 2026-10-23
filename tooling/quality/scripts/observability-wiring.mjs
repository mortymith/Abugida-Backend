#!/usr/bin/env node
// QG-610 — Observability wiring: each app must reference the observability
// package (OTLP exporter wiring must exist).
import { readFileSync, existsSync, readdirSync } from 'node:fs'

let failed = false
for (const app of readdirSync('app')) {
  const pkgPath = `app/${app}/package.json`
  if (!existsSync(pkgPath)) continue
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  const hasObs =
    (pkg.dependencies ?? {})['@abugida/observability'] ||
    (pkg.devDependencies ?? {})['@abugida/observability']
  if (!hasObs) {
    console.error(
      `✗ app/${app}: @abugida/observability is not a dependency — a deploy without telemetry is a failed deploy`,
    )
    failed = true
  }
}
console.log(
  failed ? '✗ observability wiring check failed' : '✓ all apps wire @abugida/observability',
)
process.exit(failed ? 1 : 0)
