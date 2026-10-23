# Runbook — gate failure triage (QGS-001 §7.6)

| Symptom                                | Owner          | First action                                                                            |
| -------------------------------------- | -------------- | --------------------------------------------------------------------------------------- |
| `quality-gate` red, **static** job red | PR author      | Fix locally: `pnpm lint && pnpm typecheck`                                              |
| `quality-gate` red, **flaky test**     | Feature owner  | QG-202 flake check; if genuinely flaky → quarantine (`tests/quarantine/`) or §13 waiver |
| **Infrastructure** job red             | Platform owner | Check Docker availability; the job may be retried once                                  |
| **Coverage regression**                | PR author      | Add tests; for untestable code use `/* v8 ignore next */` with a comment explaining why |
| **Secret detected**                    | Security owner | **Rotate the secret immediately** — the failing gate is the least important outcome     |

## Waiver path

1. Create `docs/quality/waivers/<gate-id>-<yyyy-mm-dd>-<slug>.md` with: gate ID, scope, justification, compensating control, owner, expiry (≤ 30 days).
2. Reference it in the PR body: `<!-- waiver: QG-xxx -->`.
3. Approval by the gate owner (§12 RACI); security gates additionally require the security owner.
4. CI validates via `tooling/quality/waiver-check.mjs`; expired waivers fail the build.

Hard-limit gates (§13.5) can never be waived: QG-401/402, QG-101/104, QG-301, QG-302, QG-109/501, CRITICAL CVEs (QG-403).

## Metrics

Flake rate, coverage drift, waiver count and gate pass rates are computed from
CI artifacts weekly (§15). Three or more open waivers for the same gate is a
quality incident.
