# ADR-009: Just as Task Runner

## Status

Accepted

## Context

The project requires a single command-line interface to execute operational tasks across development, production, backup, security, and deployment workflows. Without a unified tool, operators must remember separate scripts, Makefiles, or docker-compose commands for each concern, increasing cognitive load and the risk of inconsistent execution.

## Decision

Adopt [Just](https://github.com/casey/just) v1.40.0 as the sole task runner for all project operations. Every workflow—dev server startup, staging deployment, production deployment, database backup, security scanning, certificate renewal—is expressed as a Just recipe. Recipes differentiate environments through `DEV_COMPOSE`, `STAGING_COMPOSE`, and `PROD_COMPOSE` variables, each assembling the appropriate set of modular Compose files from the `docker/compose/` directory.

### Compose Variables

The three compose variables map to the three-environment tier model:

- **`DEV_COMPOSE`**: Assembles `docker/compose/networks.yml` + `docker/compose/volumes.yml` + `docker/compose/base.yml` + `docker/compose/profiles/dev.override.yml` (10 services)
- **`STAGING_COMPOSE`**: Adds `docker/compose/app.yml` + `docker/compose/observability.yml` + `docker/compose/security.yml` + `docker/compose/profiles/staging.override.yml` (20 services)
- **`PROD_COMPOSE`**: Adds `docker/compose/edge.yml` + `docker/compose/scaling.yml` + `docker/compose/security.yml` + `docker/compose/profiles/prod.override.yml` (31 services)

## Consequences

**Positive:** All operations share one consistent CLI interface. Running `just --list` serves as living, self-documenting reference for every available task. Environment switching is a single variable change, not a separate set of scripts. Recipes are written in a readable, comment-friendly syntax that onboards new contributors quickly.

**Negative:** Every operator must install Just before they can run any recipe. On some CI runners this requires an extra setup step. Team members unfamiliar with Just have a short learning curve, though the syntax is minimal.

**Risks:** If Just were to become unmaintained, migration to another runner would require translating every recipe. The `DEV_COMPOSE`/`STAGING_COMPOSE`/`PROD_COMPOSE` convention relies on discipline to keep all three variables in sync when new compose modules are added. The `just validate-compose` recipe (which runs `docker compose config` internally) helps catch mismatches.
