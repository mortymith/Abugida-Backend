# Quality gate system (QGS-001)

This directory is the home of the Abugida quality-gate system, defined by
[QGS-001 — Quality Gate Specification](./quality-gate-specification.md).

## Index

| Artifact                                                         | Purpose                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------- |
| [quality-gate-specification.md](./quality-gate-specification.md) | Normative specification (QGS-001 v1.0.0)                            |
| `tooling/quality/gates.json`                                     | Machine-readable gate catalogue (ID, command, scope, policy)        |
| `tooling/quality/coverage-policy.json`                           | Coverage floors, baselines and ratchet settings (§6)                |
| `tooling/quality/waiver-check.mjs`                               | CI waiver validation (§13)                                          |
| `tooling/quality/scripts/`                                       | Gate helper scripts (strictness, boundaries, parity, …)             |
| `tooling/eslint-config/boundary-rules/`                          | QG-301…QG-305 architecture lint rules                               |
| [waivers/](./waivers/)                                           | Active waivers (expired ones are archived under `waivers/archive/`) |
| [runbook-gate-failure.md](./runbook-gate-failure.md)             | What to do when each gate fails (§7.6)                              |
| [branch-protection.md](./branch-protection.md)                   | Required checks & environment protection (§11)                      |

## Quick reference

- **Tiers:** G0 local pre-commit → G1 PR (`quality.yml`) → G2 merge control → G3 staging → G4 release readiness → G5 production.
- **Policies:** `BLOCKING` fails the merge · `ADVISORY` annotates only · `SCHEDULED` runs on cron.
- **Hard limits (never waivable):** secret detection (QG-401/402), TypeScript strictness (QG-101/104), cross-app imports (QG-301), peer-dependency rule (QG-302), lockfile integrity (QG-109/501), CRITICAL CVEs (QG-403).
- **Waivers:** `docs/quality/waivers/<gate-id>-<yyyy-mm-dd>-<slug>.md`, expiry ≤ 30 days, referenced as `<!-- waiver: QG-xxx -->` in the PR body.

## Local commands

```sh
pnpm quality:fast   # G1 static + test mirror, < 60 s, no Docker
pnpm quality        # full local mirror including Docker-dependent gates
pnpm quality:fix    # auto-fixable subset
just verify         # Devbox-sandboxed equivalent
```
