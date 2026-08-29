# Writing Just Recipes

## Recipe Basics

A Just recipe is a named command with an optional doc comment. The doc comment (line starting with `#`) becomes the help text shown by `just`.

```just
# Describe what this recipe does
my-recipe:
    echo "running my-recipe"
```

## Key Patterns

### Environment-Specific Compose Variables

Three compose aliases are defined at the top of the justfile. Use them instead of writing `docker compose` inline:

```just
DEV_COMPOSE := "docker compose -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml -f docker/compose/profiles/dev.override.yml"
STAGING_COMPOSE := "docker compose -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/security.yml -f docker/compose/profiles/staging.override.yml"
PROD_COMPOSE := "docker compose -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/edge.yml -f docker/compose/scaling.yml -f docker/compose/security.yml -f docker/compose/profiles/prod.override.yml"
```

Use `DEV_COMPOSE` for dev-targeting recipes, `STAGING_COMPOSE` for staging, and `PROD_COMPOSE` for prod. Never hard-code compose file flags.

### dotenv-load

The project sets `set dotenv-load := false` by default. In development, secrets come from `.env` (loaded by Docker Compose, not by Just). In production, secrets come from Vault. If a recipe needs environment variables, pass them explicitly.

### Dependency Recipes

Chain recipes with `:` after the name. Dependencies run first, in order:

```just
# Full security audit (configs + deps + secrets)
security-audit: check-configs audit-dependencies validate-secrets
    @echo "==> Full security audit complete."
```

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
    {{DEV_COMPOSE}} up -d
```

## Where to Add New Recipes

The justfile is organized into labeled sections with comment headers. Add your recipe in the appropriate section:

1. **Setup & Bootstrap** — `dev`, `staging`, `prerequisites`, `scaffold`
2. **Development Lifecycle** — `stop-dev`, `clean-dev`
3. **Production Deployment** — `deploy prod`, `rollback`, `restart`, `scale`
4. **Health Checks** — `health`, `health-api`, `health-redis`
5. **Backup & Restore** — `backup-*`, `restore-*`, `verify-backup`
6. **Security** — `audit-*`, `check-configs`, `rotate-secrets`, `port-scan`
7. **Observability** — `otel-status`, `metrics`, `dashboard`
8. **Maintenance** — `diagnostics`, `disk-usage`
9. **Vault Operations** — `vault-init`, `vault-unseal`, `vault-populate-secrets`

Keep the section separator format: `# ═══...═══` for major headers, `# ─── ... ───` for subsections.
