# ADR-002: Alpine/distroless base images only

## Status

Accepted

## Context

The platform builds and ships a mix of application images (API, Dashboard, Marketing) and infrastructure images (Caddy, Redis primary/replica/sentinel, PostgreSQL replica). Each image is another surface an attacker can reach through a compromised container or a vulnerable transitive dependency, and image size directly affects build time, registry storage, and cold-pull latency.

Without a policy, image choices drift: someone reaches for `:latest`, installs build tools into the runtime stage, or runs the process as root out of convenience. Each of those is a supply-chain or privilege-escalation risk.

We need a default that is small, reproducible, and auditable.

## Decision

All images must use **Alpine (or distroless) variants** and follow a fixed set of rules:

| Rule                 | Details                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Alpine base**      | Use `*-alpine` variants for minimal attack surface                                                          |
| **Pinned versions**  | Never `:latest`. Pin an exact version, and a digest where practical (e.g. `oven/bun:1.4.2-alpine@sha256:…`) |
| **Non-root user**    | Create a dedicated `appuser` and `USER appuser` before `EXPOSE`/`ENTRYPOINT`                                |
| **HEALTHCHECK**      | Every service declares a `HEALTHCHECK` with `--interval`, `--timeout`, `--retries`, and `--start-period`    |
| **Minimal packages** | Only runtime-essential packages via `apk add --no-cache`; no build tools in the runtime stage               |
| **.dockerignore**    | Always exclude `node_modules`, `.git`, `.env*`, `data/`, and `*.md`                                         |

Supply-chain defences accompany the base-image policy:

- CI runs `trivy image` on every build; any HIGH or CRITICAL CVE blocks the merge.
- Images are built once in CI, tagged with the immutable git SHA, scanned, and then the **same artefact** is promoted through staging and production.

Representative pins in use: `postgres:17-alpine`, `redis:7.4-alpine`, `caddy:2.8.4-alpine`, `oven/bun:1.4.2-alpine`, `hashicorp/vault:1.18-alpine`.

## Consequences

### Positive

- **Smaller attack surface**: fewer packages, fewer CVEs, less to patch.
- **Reproducible builds**: pinned versions and digests make an image identical across environments and over time.
- **Defence in depth**: a non-root runtime user limits what a container breakout can reach.
- **Cheap scanning**: fewer packages keeps Trivy fast and findings actionable.

### Negative

- **Alpine's musl libc**: a small number of binaries behave differently from glibc builds; native dependencies must be verified.
- **Upgrade toil**: pinned versions do not move on their own. Upgrades are deliberate, ideally automated with dependency bots.
- **Distroless trade-off**: distroless images are more secure but harder to debug interactively (no shell), so they are used selectively.

### Risks

- **Vulnerable pinned version**: pinning can freeze a known-bad release. Mitigated by scheduled Trivy scanning and dependency upgrades rather than "pin and forget".
- **Digest drift for infra images**: some upstream images are pinned by tag rather than digest. A tag can be repointed upstream; where the risk is material, pin the digest.

## References

- Dockerfile guidelines: `docs/development/dockerfile-guidelines.md`
- Security model — image security: `docs/architecture/security-model.md`
- CI pipeline and scanning gates: `docs/architecture/deployment-model.md`
