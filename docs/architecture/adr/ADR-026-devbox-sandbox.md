# ADR-026: Devbox Sandbox for the Development Toolchain

## Status

Accepted

## Context

The repository pins its toolchain in three different places, and every one of them is only a _declaration_:

| Tool    | Declared where                              | Enforced by                                  |
| ------- | ------------------------------------------- | -------------------------------------------- |
| Bun     | `.bun-version` (`1.4.4`), `engines.bun`     | whatever the developer happens to have       |
| pnpm    | `package.json` → `packageManager`           | whatever the developer happens to have       |
| Node    | `@types/node` / Astro's engine constraint   | whatever the developer happens to have       |
| Just    | justfile                                    | whatever the developer happens to have       |
| Linters | `tooling/README.md` "System binaries" table | `apt install`, `brew install`, manual binary |

Nothing in the repository guarantees that the toolchain used on a laptop matches the toolchain used on a colleague's laptop or in CI. The concrete failure modes we have to design around are:

- **Version drift.** A developer with Bun 1.2 and `engines.bun: ">=1.4.4"` gets a confusing runtime failure instead of an install-time error.
- **Missing system binaries.** `pnpm lint` silently depends on `shellcheck`, `hadolint`, `yamllint`, `gitleaks`, `dotenv-linter`, `editorconfig-checker` and `shfmt` being installed by hand. A fresh clone fails on the first blocking lint gate, not at setup time.
- **Unpinned patch versions.** `brew install just` gives a different `just` on every machine, and the justfile is the single operational entrypoint (ADR-009, ADR-023) — a behavioural change in `just` is a behavioural change in production operations.
- **No CI.** The repository has no CI pipeline yet (see `tooling/README.md`), so the sandbox is currently the only place where the toolchain is pinned at all.
- **Host contamination.** Installing toolchains directly on the host mutates the machine and leaks state between projects.

We want a sandbox that: pins every version, is reproducible from the lock file, provisions the system binaries the lints need, does not require root or a Docker-in-Docker setup, and still leaves Docker Compose free to own the _infrastructure_ (PostgreSQL, Redis, MinIO, …) rather than the toolchain.

[Devbox](https://www.jetify.com/devbox) (Jetify) is a Nix-based toolchain manager that provides exactly this: a declarative `devbox.json`, a `devbox.lock` for reproducible resolution, hermetic shell environments, and per-project isolation — without requiring a container runtime for the toolchain itself.

## Decision

Adopt Devbox as the **development toolchain sandbox** for the repository, and keep Docker Compose as the **infrastructure sandbox**.

### Division of responsibility

| Layer                    | Owner              | Mechanism                                          |
| ------------------------ | ------------------ | -------------------------------------------------- |
| Development toolchain    | **Devbox**         | `devbox.json` + `devbox.lock`, Nix store           |
| Workspace dependencies   | **pnpm**           | `pnpm-lock.yaml`, `pnpm install --frozen-lockfile` |
| Infrastructure services  | **Docker Compose** | `docker/compose/**`, three-tier overlays           |
| Operational task running | **Just**           | `justfile`                                         |

Docker Compose is _not_ used to sandbox the toolchain: building app images on every toolchain change would slow the inner loop to minutes, and the Compose files model _services_, not _tools_. Devbox is the right size for the toolchain — the sandbox starts in under a second once the Nix store is warm.

### What the sandbox pins

`devbox.json` pins, with exact versions:

- **Runtime** — `bun@1.4.4` (matches `.bun-version`), `pnpm@12` (major pin; the exact `pnpm@12.8.1` from `package.json` `packageManager` is applied by pnpm's own version management).
- **Task runner & containers** — `just@1.58.0`, `docker-client@29.9.1`, `docker-compose@5.6.0` (the Compose v2 plugin the whole repository assumes).
- **Service clients** — `mc@4.8.33` (MinIO), `vault-bin@1.21.4` (staging/prod secret operations), `jq@1.8.2`, `curl@8`, `git@2`, `openssl@3`, `cacert`.
- **System binaries the blocking lints need** — `shellcheck@0.11.0`, `hadolint@2.14.0`, `yamllint@1.37.1`, `gitleaks@8.30.1`, `dotenv-linter@3.3.0`, `editorconfig-checker@4.0.2`, `shfmt@3.14.1`. This removes the `tooling/README.md` "install these by hand" step.
- **Native build toolchain** — `gcc`, `gnumake`, `binutils`, `pkg-config`, `python3` so `node-gyp`-style postinstall builds work inside the sandbox.

### How the sandbox is used

- `devbox install` materialises the pinned packages in the Nix store and writes `devbox.lock`, which is **committed** — the lock file is the reproducibility contract.
- `devbox shell` opens the sandbox; every tool listed above is on `PATH` with the pinned version.
- `devbox run <script>` runs a named command in the sandbox without opening an interactive shell. `devbox.json` defines `setup`, `doctor`, `lint`, `typecheck`, `test`, `build`, `format`, `infra-up`, `infra-down`, `psql`, `redis-cli`.
- `just sandbox-shell | sandbox-setup | sandbox-doctor | sandbox-verify` expose the same thing through the repository's single task runner (ADR-009), so there is one entrypoint, not two.
- `scripts/devbox/doctor.sh` verifies the sandbox against the versions the repository declares (`.bun-version`, `packageManager`) and reports missing tools with an actionable message — the sandbox version of the `_need` preflight guard.
- `scripts/devbox/docker-plugin.sh` links the Nix-provided Compose binary into `~/.docker/cli-plugins` so `docker compose …` (used by the justfile and `scripts/lib/compose.sh`) resolves unchanged inside the sandbox.

### Docker inside the sandbox

The sandbox provides the **Docker client**, not the daemon. The daemon stays where it is (the host, or a rootless/Podman setup). `docker compose` therefore talks to the host daemon over its socket, and the Compose-managed infrastructure is unchanged by the sandbox. `scripts/devbox/doctor.sh` warns — never fails — when the daemon is unreachable.

### Secrets

The sandbox never receives secrets. `.env` files stay on the host, are git-ignored, and are read by Compose and by the apps exactly as before. Devbox's `env` block only sets non-sensitive, deterministic values (`COREPACK_ENABLE_DOWNLOAD_PROMPT`, `VAULT_ADDR`, tool cache locations).

## Consequences

### Positive

- **Reproducible toolchain.** Every developer and every future CI runner resolves the same versions from `devbox.lock`; "works on my machine" becomes a checkable condition (`just sandbox-doctor`).
- **One-command setup.** `just sandbox-setup` provisions the toolchain _and_ the workspace dependencies. The "install these seven binaries by hand" step in `tooling/README.md` disappears.
- **No host mutation.** Tools live in the Nix store, not in `/usr/local/bin`. A stale `bun` on the host can no longer shadow the pinned one inside the sandbox.
- **Fail fast.** Version mismatches are reported by the doctor at shell entry, not by a cryptic runtime error hours later.
- **Path to CI.** The same `devbox.json` is the natural base for CI (or a `devbox generate devcontainer` devcontainer), so the sandbox is not a local-only artefact.

### Negative

- **Nix is a new dependency.** Devbox manages its own Nix installation, but the first run downloads a Nix store — a one-time cost of a few hundred megabytes.
- **A slow first build.** Packages that are not in the binary cache are compiled locally. `vault-bin@1.21.4` is the prebuilt HashiCorp binary and resolves from the cache in seconds; only packages not present in the cache are compiled locally.
- **Native modules need care.** Native npm dependencies must build against the Nix-provided toolchain (`gcc`, `python3`, `pkg-config` are in the sandbox for this reason); the `pnpm-workspace.yaml` `allowBuilds` list stays the single place where build permissions are granted.
- **Docker Compose plugin discovery.** The Nix Compose binary lives in the store, outside the paths the Docker CLI scans; the plugin must be linked (handled automatically by `scripts/devbox/docker-plugin.sh`).

### Risks

- **Nixpkgs churn.** Exact package pins can be garbage-collected from nixpkgs over time. `devbox update` re-resolves and rewrites `devbox.lock`; a pin that no longer exists fails loudly at `devbox install` rather than silently.
- **Divergence between host and sandbox.** Recipes must not depend on a host tool that the sandbox does not provide; `just` recipes declare their CLI requirements with `(_need "<cmd>")` and the doctor mirrors that list.
