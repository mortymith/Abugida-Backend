# ADR-023: Just v1.40.0 as central CLI

## Status

Accepted

## Context

As the platform grew, operations spread across ad-hoc shell invocations, `docker compose` file lists, and one-off scripts. Each operator had to remember the right combination of `-f` flags and scripts for the environment in front of them, and the same knowledge was duplicated in CI. Onboarding meant reading the repository rather than a help screen.

What was missing was a single, discoverable entry point: one command that lists every supported operation, groups them by concern, and forwards to the right underlying tool.

## Decision

Make **Just (v1.40.0)** the single CLI entry point for all infrastructure operations, pinning the version for reproducibility.

- The **justfile is the entry point**: running `just` with no arguments prints a grouped overview, and `just --list` prints all recipes with descriptions.
- Recipes are organised into labelled sections — setup, environments (compose lifecycle), deployment, health, logs/debugging, monitoring, observability, PowerSync, secrets rotation, Vault, backup/restore, security, edge/tunnel, and testing.
- The justfile is a **thin dispatcher**: it forwards to `scripts/<domain>/<name>.sh` and shared libraries (`scripts/lib/compose.sh`, `scripts/lib/common.sh`) rather than embedding multi-step logic. This keeps recipes directly runnable in CI, cron, and incident response without `just`.
- Every value resolves as **exported env var → `.env` → built-in default** (`set dotenv-load := true`), and recipes run under strict bash (`set shell := ["bash", "-euo", "pipefail", "-c"]`).
- Environment targeting goes through `dc <tier>` from `scripts/lib/compose.sh`, so the tier → compose-file mapping lives in one place (see ADR-003, ADR-024).
- `scripts/setup/prerequisites.sh` pins and installs `JUST_VERSION=1.40.0`.

This complements ADR-009 (adopting Just as the task runner) and ADR-021 (recipe categories and naming conventions); those define _that_ Just is used and _how_ recipes are named, while this ADR fixes Just as the central entry point and pins its version.

## Consequences

### Positive

- **One discoverable interface**: `just --list` is living documentation of every supported operation.
- **Environment safety**: operators pick a tier explicitly (`dc dev`, `dc prod`) rather than assembling file lists by hand.
- **CI/local parity**: CI invokes the same recipes operators do, reducing drift.
- **Reproducible tooling**: a pinned Just version avoids behaviour changes from a newer release.

### Negative

- **Install requirement**: every operator and CI runner must install Just 1.40.0 before any recipe works.
- **Convention-enforced structure**: Just does not enforce section grouping; discipline and review keep the file tidy.
- **Learning curve**: contributors must learn to add a script and a thin recipe rather than putting logic in the justfile.

### Risks

- **Version drift**: a runner with a different Just version may behave differently; the prerequisite script and CI pin the version.
- **Monolithic justfile growth**: the file can become large. The thin-dispatcher rule and sectioning keep it navigable; splitting into modules is possible if it grows further.
- **Runner lock-in**: swapping task runners would mean translating every recipe. Recipes are thin, so the underlying scripts remain portable.

## References

- Task runner adoption: ADR-009 · Recipe conventions: ADR-021
- Writing recipes: `docs/development/writing-just-recipes.md`
- Entry point: `justfile` · Tier helper: `scripts/lib/compose.sh` · Version pin: `scripts/setup/prerequisites.sh`
