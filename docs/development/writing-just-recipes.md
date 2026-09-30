# Writing Just Recipes

## Recipe Basics

A Just recipe is a named command with an optional doc comment. The doc comment (line starting with `#`) becomes the help text shown by `just`.

```just
# Describe what this recipe does
my-recipe:
    echo "running my-recipe"
```

## Key Patterns

### Environment-Specific Compose Access (scripts/lib/compose.sh)

The tier → compose file set mapping lives in exactly one place, the shell library `scripts/lib/compose.sh`. Recipes source it and call `dc <tier> <compose args…>`:

```just
# Start dev services
dev-up:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc dev up -d

# Build production images
prod-build:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc prod build
```

`dc` validates the tier name (exit 64 on an unknown one) and preflights the docker CLI, so recipes never inline a `-f docker/compose/…` list. `dc_validate <tier>` parses a tier's merged config with placeholder secrets, which is what `just validate-compose` uses.

Service/container names come from the "Service identities" variables at the top of the justfile (`POSTGRES_SERVICE`, `REDIS_SERVICE`, `CLICKHOUSE_SERVICE`, …), never from literals in a recipe.

### dotenv-load

The justfile sets `set dotenv-load := true` and `set shell := ["bash", "-euo", "pipefail", "-c"]`. `.env` values are visible both to recipes and to `env_var_or_default`, so every config value resolves as **exported env var → `.env` → built-in default**:

```just
API_PORT_DEFAULT := env_var_or_default("API_PORT", "3001")
```

Shell scripts use the same precedence through `env_or_dotenv` / `require_secret` in `scripts/lib/common.sh`.

### Dependency Recipes

Chain recipes with `:` after the name. Dependencies run first, in order. Two private helpers cover the common cases:

```just
# Full security audit (configs + deps + secrets)
security-audit: check-configs audit-dependencies validate-secrets
    @echo "==> Full security audit complete."

# Optional CLI preflight
port-scan target="": (_need "nmap")
    bash docker/tests/security/nmap/scan-ports.sh {{if target != ""}}--target {{target}}{{/if}}

# Host-privileged script (prompts for sudo once, no-op under `sudo just`)
firewall-install: (_sudo "scripts/security/firewall-install-all.sh" "install")
```

### Never Call `just` From a Recipe or Script

A recipe is not a CLI API. Call the underlying script directly — `bash scripts/…/foo.sh` — so the target is not re-parsed and `.env` is not re-loaded, and so a script stays usable from cron, CI and SSH sessions where `just` may be absent.

### Parameterized Recipes

Use `*ARGS` for variadic arguments (passed through to underlying scripts) or named parameters with defaults:

```just
# Restore PostgreSQL from latest or specified backup
restore-postgres file="":
    bash scripts/restore/restore-postgres.sh "{{file}}"

# Run port scan against optional target
port-scan target="":
    bash docker/tests/security/nmap/scan-ports.sh {{if target != ""}}--target {{target}}{{/if}}
```

### Suppressing Echo

Prefix commands with `@` to suppress the command echo, or use `@echo` for informational output with the `==>` convention:

```just
    @echo "==> Starting dev environment..."
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc dev up -d
```

### Output Style

Actions print as `==> …`, results are indented two spaces, absences as `(not reachable)`, failures as `error: …` on stderr. In shell scripts use the helpers from `scripts/lib/common.sh` (`log_info`, `log_ok`, `log_warn`, `log_err`, `die`) so output is consistent across recipes, cron jobs and deploy scripts.

Anything that gates a pipeline (a deploy gate, a CI step) must return a meaningful exit code — e.g. `just health-api --strict` exits 1 when a probe fails, while the default display-only form always exits 0.

## Where to Add New Recipes

The justfile is organized into labeled sections with comment headers. Add your recipe in the appropriate section:

1. **Setup & Bootstrap** — `setup-dev`, `setup-staging`, `setup-prod`, `db-generate`
2. **Environments (Compose Lifecycle)** — `dev-up`, `staging-recreate`, `prod-clean`, `validate-compose`
3. **Deployment** — `deploy-prod`, `rollback`, `deployment-status`
4. **Health Checks** — `health`, `health-api`, `health-redis`
5. **Logs & Debugging** — `logs`, `shell`, `psql`, `redis-cli`, `mc`
6. **Monitoring & Diagnostics** — `container-stats`, `diagnostics`, `disk-usage`
7. **Observability & Alerting** — `otel-status`, `ch-health`, `obs-health`, `signoz`
8. **PowerSync** — `ps-status`, `ps-setup`, `ps-compact`
9. **Secrets Rotation** — `rotate-secrets`, `validate-secrets`
10. **Vault Operations** — `vault-init`, `vault-unseal`, `vault-status`
11. **Backup & Restore** — `backup-*`, `restore-*`, `verify-backup`
12. **Security** — `audit-*`, `check-configs`, `firewall-*`, `port-scan`
13. **Edge & Tunnel (Prod)** — `tunnel-status`, `cert-status`, `cert-force-renewal`
14. **Testing** — `test-suite`

Keep the section separator format: `# ═══...═══` for major headers, `# ─── ... ───` for subsections.

## The justfile Is a Thin Dispatcher

Multi-step logic belongs in `scripts/<domain>/<name>.sh`; reusable helpers belong in `scripts/lib/`:

- `scripts/lib/compose.sh` — tiered compose file sets, `dc`, `dc_validate`, `validate_env`
- `scripts/lib/common.sh` — logging, `env_or_dotenv`, `require_cmd`, `require_root`, `ensure_env_file`

A recipe that grows past a few lines of shell almost always wants to become a script, which also makes it directly runnable in CI, cron and incident response.
