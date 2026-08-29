# ADR-021: Just Recipe Categories and Conventions

## Status

Accepted

## Context

As the number of Just recipes grows across development, deployment, and operations, the justfile risks becoming an unstructured list that is difficult to navigate. Without naming and organizational conventions, contributors add recipes inconsistently and operators cannot predict recipe names. The introduction of a three-environment tier model (dev, staging, prod) further increases the number of recipes needed.

## Decision

Enforce a grouped, sectioned structure in the justfile. Recipes are organized under comment-headings: **setup**, **lifecycle**, **health**, **backup**, **restore**, **deploy**, **security**, **vault**, **cert**, and **monitoring**. All recipe names use `snake_case` for readability. Variadic parameters are captured with `*ARGS` so that recipes like `just deploy *ARGS` can forward arbitrary flags to underlying tools without the recipe author needing to anticipate every option.

The three compose variables (`DEV_COMPOSE`, `STAGING_COMPOSE`, and `PROD_COMPOSE`) are defined at the top of the justfile and used throughout. New recipes must select the appropriate variable for their target environment.

## Consequences

**Positive:** Running `just --list` produces a neatly grouped, categorized summary of every operation. New contributors can locate the right recipe by section and follow the existing naming pattern. The `*ARGS` convention keeps recipe signatures simple while preserving full composability with underlying CLIs. The three compose variables make environment targeting explicit and consistent.

**Negative:** The section-based organization is enforced only by convention and code review — Just itself does not enforce groupings, so drift is possible if PRs are not checked. Overly long justfiles may eventually need to be split into modules (supported in newer Just versions).

**Risks:** As the project matures, new operational categories may not fit cleanly into the defined sections, requiring an ADR amendment. The `*ARGS` pattern can obscure which flags are actually accepted, placing the burden on the underlying tool's help output. Keeping three compose variables in sync when adding new modules requires discipline and is validated by the `just validate-compose` recipe (which runs `docker compose config` internally).
