# ADR-001: Bun runtime for API and Website

## Status

Accepted

## Context

The API and the website applications were originally built on Node.js. Node requires a separate toolchain or loader (`ts-node`, `tsx`, `esbuild`) to run TypeScript, ships a comparatively large runtime image, and has a slower cold start — which matters for services that are built and deployed as frequently as these are.

The project already depends on Bun for local scripting and as the test runner (`bun test`). Running the production services on a different runtime than the one used for scripts and tests means two toolchains, two lockfile interactions, and behaviour that diverges between development and production.

We need a runtime that:

1. Executes TypeScript directly without a transpile step.
2. Produces smaller runtime images and starts faster than Node.
3. Can bundle the application into a single artefact for the runtime stage.
4. Is already used elsewhere in the repository, so there is one runtime to reason about.

Options considered:

- **Node.js**: Mature and ubiquitous, but needs a separate transpile/bundle step and a larger image, and would be a third toolchain alongside Bun (scripts/tests).
- **Deno**: Modern and secure by default, but a smaller ecosystem for the frameworks in use and no existing footprint in the repository.
- **Bun**: A drop-in Node-compatible runtime with a built-in bundler and native TypeScript execution, already used by the project.

## Decision

Use **Bun** as the runtime for the API and website applications.

- Application images are built `FROM oven/bun:<version>-alpine` using a multi-stage pattern: a **builder** stage installs workspace dependencies and runs `bun build`, and a **runtime** stage copies only the built bundle.
- The image is pinned to an exact version and digest — never `:latest` — consistent with the image policy in ADR-002.
- Bun is also the test runner (`bun test`; the API uses `bun test --pass-with-no-tests`).

```dockerfile
FROM oven/bun:1.4.2-alpine@sha256:… AS base
# … workspace-aware pnpm install against the frozen lockfile, then:
RUN bun run build

FROM oven/bun:1.4.2-alpine AS runtime
COPY --from=builder --chown=appuser:appuser /build/dist ./dist
```

> **Superseded detail:** the runtime was first pinned to `oven/bun:1.2.1-alpine`. The current pin is `1.4.2-alpine` (see `.bun-version` and `app/*/Dockerfile`), tracked through Renovate-style upgrades. The decision to standardise on Bun is unchanged.

Bun does **not** replace the package manager. Dependencies are still resolved by pnpm against the committed lockfile; `bunfig.toml` sets `frozenLockfile = true` and there is deliberately no `bun.lockb`.

## Consequences

### Positive

- **Smaller images**: the Alpine Bun runtime is materially smaller than an equivalent Node image, reducing pull time and registry storage.
- **Faster startup**: shorter cold starts improve deploy and scale-out latency.
- **One toolchain**: the runtime, bundler, and test runner are the same tool used for scripts, so dev and prod diverge less.
- **Native TypeScript**: no separate transpile step in the build.

### Negative

- **Ecosystem maturity**: a small number of native addons and Node APIs are not yet fully supported; anything relying on them needs a documented workaround.
- **Two tools, one lockfile**: Bun runs the code but pnpm owns the dependency graph. Contributors must not let `bun install` touch the lockfile.

### Risks

- **Upstream regressions**: a Bun release can change behaviour under the application. Mitigated by pinning an exact version and digest and upgrading deliberately.
- **Fallback cost**: reverting to Node would mean reworking the build stages and bundle output. The multi-stage pattern keeps the application source portable, limiting the blast radius.

## References

- Dockerfile guidelines: `docs/development/dockerfile-guidelines.md`
- Runtime version: `.bun-version`
- Image policy: ADR-002
- Workspace/tooling contract: `AGENTS.md`
