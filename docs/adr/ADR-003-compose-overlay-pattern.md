# ADR-003: Compose overlay pattern

## Status

Accepted (file layout superseded by ADR-024)

## Context

The same services run in development, staging, and production, differing only in published ports, resource limits, replica counts, and the presence of optional layers (edge, scaling, security, observability). Writing a separate, complete Compose file per environment duplicates every service definition three times; the copies drift, and a change made in one is silently missing from another.

Docker Compose natively supports splitting configuration across multiple files and merging them left-to-right. The question was how to structure that split so that the common definition of a service lives in exactly one place and environment differences are additive.

## Decision

Adopt the **overlay pattern**: a base definition of each service plus environment-specific override files, merged by Docker Compose.

- **Base files** define a service's image/build, networks, volumes, config mounts, healthcheck, and dependencies. They deliberately omit ports and resource limits.
- **Override files** add the environment-specific keys: published ports (dev/staging), resource limits, replica counts, environment labels, and the presence of optional service layers.
- Compose merges files **left-to-right**; later files win for scalar keys, while some keys (notably `ports`) are concatenated.

The original realisation of this pattern was a small set of `base.yml` + dev/prod overlay files. It is now realised as a purpose-split, modular file set under `docker/compose/` assembled per environment by `scripts/lib/compose.sh` (`dc <tier>`).

> **Superseded detail (see ADR-024):** the concrete file layout — purpose-split modules plus `profiles/{dev,staging,prod}.override.yml` — is defined by ADR-024. This ADR records the _pattern_; ADR-024 records the _structure_.

## Consequences

### Positive

- **DRY**: a service is defined once; environments change only the differences.
- **Additive change**: adding a service means editing the base module and, if needed, the relevant overrides — not three full files.
- **Environment parity**: because base definitions are shared, dev and prod run the same image, config, and healthcheck by construction.

### Negative

- **Merge semantics are subtle**: `ports`, `volumes`, and `environment` do not always behave like simple scalar overrides. Authors must know which keys concatenate and which replace.
- **Indirection**: reading the effective configuration requires mentally merging several files; `docker compose config` is required to see the result.
- **Ordering matters**: a file placed later changes the outcome, so the tier file order is part of the contract.

### Risks

- **Silent divergence**: if an override forgets a key, the base default (often "no ports", "no limits") applies. The `just validate-compose` recipe parses each tier's merged config to catch structural mistakes.
- **Duplicated tier definitions**: the pattern's benefit is lost if the tier file lists are duplicated in more than one place. This is why the mapping lives once in `scripts/lib/compose.sh` (see ADR-009, ADR-021).

## References

- Compose overlay guide: `docs/configuration/compose-overlays.md`
- Modular structure: ADR-024
- Tier helper: `scripts/lib/compose.sh`
