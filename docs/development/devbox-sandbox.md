# Devbox Sandbox — Developer Guide

The development toolchain (Bun, pnpm, Node, Just, the Docker client, and every system binary the repository lints with) is **pinned and provided by a Devbox sandbox**. Docker Compose keeps owning the _infrastructure_ (PostgreSQL, Redis, MinIO, observability) — the sandbox owns the _tools_.

ADR: [ADR-026](../architecture/adr/ADR-026-devbox-sandbox.md)

---

## Quick start

```bash
# 1. One-time: materialise the pinned toolchain + install workspace deps
just sandbox-setup

# 2. Enter the sandbox for every other command
just sandbox-shell        # or: devbox shell

# 3. Inside the sandbox
pnpm dev                  # Turborepo dev servers
pnpm test                 # bun test across workspaces
just dev-up               # Docker Compose infrastructure
```

`devbox shell` gives you a normal shell with the pinned tools on `PATH`. Everything the repository does (`pnpm …`, `just …`, `bash scripts/…`) works unchanged inside it.

> The Docker **daemon** is not part of the sandbox — only the client. `just dev-up` therefore talks to the daemon that is already running on your host.

---

## What is pinned

| Area                | Packages                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime             | `bun@1.4.4` (matches `.bun-version`), `pnpm@12`                                                                                                   |
| Task runner         | `just@1.58.0`                                                                                                                                     |
| Containers (client) | `docker-client@29.9.1`, `docker-compose@5.6.0`                                                                                                    |
| Service clients     | `mc@4.8.33` (MinIO), `vault-bin@1.21.4` (staging/prod secret operations)                                                                          |
| Misc utilities      | `jq@1.8.2`, `curl@8`, `git@2`, `openssl@3`, `cacert`                                                                                              |
| Repository linters  | `shellcheck@0.11.0`, `hadolint@2.14.0`, `yamllint@1.37.1`, `gitleaks@8.30.1`, `dotenv-linter@3.3.0`, `editorconfig-checker@4.0.2`, `shfmt@3.14.1` |
| Native builds       | `gcc`, `gnumake`, `binutils`, `pkg-config`, `python3`                                                                                             |

`devbox.lock` is committed. It is the reproducibility contract: `devbox install` resolves to exactly the versions in the lock file.

---

## Commands

### Devbox scripts (`devbox run <script>`)

| Script              | Does                                             |
| ------------------- | ------------------------------------------------ |
| `setup` / `install` | `pnpm install --frozen-lockfile`                 |
| `doctor`            | Verify the sandbox against the repo requirements |
| `lint`              | `pnpm lint`                                      |
| `format`            | `pnpm format`                                    |
| `typecheck`         | `pnpm typecheck`                                 |
| `test`              | `pnpm test`                                      |
| `build`             | `pnpm build`                                     |
| `infra-up`          | `just dev-up`                                    |
| `infra-down`        | `just dev-down`                                  |
| `psql`              | `just psql`                                      |
| `redis-cli`         | `just redis-cli`                                 |

List them any time with `devbox run --list`.

### Just recipes (the single task runner)

| Recipe                | Does                                             |
| --------------------- | ------------------------------------------------ |
| `just sandbox-setup`  | `devbox install` + `devbox run setup`            |
| `just sandbox-shell`  | Enter the sandbox                                |
| `just sandbox-doctor` | Verify the sandbox                               |
| `just sandbox-verify` | `typecheck` + `lint` + `test` inside the sandbox |

### Everything else

`just --list` — all infrastructure recipes (Compose lifecycle, health, backups, Vault, security).
`just --help` — grouped overview.

---

## Verifying the sandbox

```bash
just sandbox-doctor      # or: devbox run doctor
```

The doctor checks, group by group:

1. **Runtime** — `bun` matches `.bun-version`, `pnpm` matches `packageManager`.
2. **Task runner & containers** — `just`, `docker`, `docker compose` plugin, daemon reachability.
3. **Repository linters** — `shellcheck`, `hadolint`, `yamllint`, `gitleaks`, `dotenv-linter`, `editorconfig-checker`, `shfmt`.
4. **Operations tooling** — `jq`, `curl`, `vault-bin`, `mc`.
5. **Workspace** — `node_modules` present, `devbox.lock` committed.

Failures exit non-zero; warnings (e.g. Docker daemon not running) do not.

---

## How it works

```
devbox.json ──► devbox install ──► Nix store (pinned binaries)
      │                                   │
      │                                   ▼
      │                            devbox shell / devbox run
      │                                   │
      │                                   ├── bun 1.4.4   (repo runtime)
      │                                   ├── pnpm 12     (package manager)
      │                                   ├── just 1.58   (task runner)
      │                                   ├── docker client ──► host daemon ──► Compose infra
      │                                   └── linters     (shellcheck, hadolint, …)
      │
      └── devbox.lock (committed) ──► exact resolution for every developer
```

### The Docker Compose plugin

The Docker CLI discovers Compose plugins in `~/.docker/cli-plugins`, `/usr/local/lib/docker/cli-plugins` and `/usr/libexec/docker/cli-plugins`. The Nix-provided Compose binary lives in the Nix store, which is none of them. `scripts/devbox/docker-plugin.sh` (run from the sandbox init hook) links it into the user-scope plugin directory, so `docker compose …` — used by the justfile and `scripts/lib/compose.sh` — resolves unchanged.

The script is idempotent and never touches an existing plugin that already points at the right binary.

### Environment

`devbox.json` sets only non-sensitive, deterministic values:

| Variable                          | Why                                                             |
| --------------------------------- | --------------------------------------------------------------- |
| `COREPACK_ENABLE_DOWNLOAD_PROMPT` | Keeps Corepack non-interactive                                  |
| `DO_NOT_TRACK`                    | No telemetry from package tooling                               |
| `PNPM_HOME`, `PNPM_STORE_DIR`     | Keeps the pnpm store inside the home directory, out of the repo |
| `BUN_INSTALL`                     | Pins Bun's install prefix                                       |
| `VAULT_ADDR`                      | Local Vault address for `just vault-*`                          |

**Secrets never enter the sandbox.** `.env` files stay on the host, git-ignored, and are read by Compose and the apps exactly as before.

---

## Day-to-day usage

```bash
just sandbox-shell          # once per terminal session
pnpm dev                    # run the apps
# … edit code …
pnpm typecheck && pnpm lint # verify
just dev-up                 # infrastructure
```

Outside the sandbox, `pnpm`/`bun` from your host still work — but the sandbox is what guarantees the pinned versions. Use `just sandbox-verify` for the authoritative check.

---

## Updating the sandbox

```bash
devbox update               # re-resolve packages, rewrite devbox.lock
devbox install              # apply
just sandbox-doctor         # confirm
git add devbox.json devbox.lock && git commit -m "chore(devbox): bump toolchain"
```

`devbox update` is the only supported way to change versions. Editing `devbox.json` by hand is fine for adding/removing packages, but `devbox update` keeps the lock file consistent.

### Adding a package

```bash
devbox add ripgrep          # adds to devbox.json and installs it
devbox update               # refresh the lock file
```

---

## Troubleshooting

| Symptom                                                  | Cause / fix                                                                                                                 |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `devbox: command not found`                              | Devbox is not installed. Install it from <https://www.jetify.com/devbox>.                                                   |
| `error: interrupted by the user` during `devbox install` | The Nix build was cancelled (Ctrl-C, or the process was killed). Re-run it; completed builds stay in the store.             |
| `bun: command not found`                                 | You are outside the sandbox — run `devbox shell`.                                                                           |
| `docker compose: plugin not found`                       | Run `bash scripts/devbox/docker-plugin.sh` inside the sandbox.                                                              |
| `docker compose` cannot reach the daemon                 | The sandbox ships the client only. Start the host daemon (`sudo systemctl start docker`).                                   |
| `pnpm install` fails on a native module                  | The sandbox provides `gcc`, `python3`, `pkg-config`. Ensure the package is listed in `pnpm-workspace.yaml` → `allowBuilds`. |
| `vault` takes a long time to install                     | Use `vault-bin@1.21.4` (the prebuilt HashiCorp binary). It resolves from the cache in seconds.                              |
| Doctor reports a version mismatch                        | The host tool is shadowing the pinned one, or `devbox.lock` is stale — run `devbox update` and `devbox install`.            |

### Reset the sandbox

```bash
devbox rm <package>      # drop one package
devbox update            # re-resolve
nix-store --gc           # reclaim unused store space (optional)
```

---

## Relationship to the rest of the repository

| Concern                 | Owner           | Where                                                  |
| ----------------------- | --------------- | ------------------------------------------------------ |
| Development toolchain   | Devbox          | `devbox.json`, `devbox.lock`, `scripts/devbox/`        |
| Workspace dependencies  | pnpm            | `pnpm-lock.yaml`, `pnpm-workspace.yaml`                |
| Infrastructure services | Docker Compose  | `docker/compose/**`                                    |
| Operational tasks       | Just            | `justfile`                                             |
| Lint configuration      | Repository root | `.shellcheckrc`, `.hadolint.yaml`, `.yamllint.yaml`, … |

The sandbox does not change any application code, build output, or Compose definition. If a change is required inside `devbox shell`, it is a change in `devbox.json` — never a change in the apps.
