# Development Workflow

## Branching Model

| Branch      | Environment   | Protection                                        | Auto-Deploy        |
| ----------- | ------------- | ------------------------------------------------- | ------------------ |
| `main`      | Production    | 2 reviewer approval, environment protection rules | No (manual gate)   |
| `dev`       | Staging       | 1 reviewer approval                               | Yes (on push)      |
| `feature/*` | Ephemeral dev | None                                              | Via merge to `dev` |

**Flow:** Create `feature/*` from `dev` → develop → open PR to `dev` (1 review) → merge → auto-deploys to staging. Promote to `main` via PR (2 reviews) → manually approved → deploys to production.

## GitHub Actions Workflows

### `deploy-staging.yml`

Triggers on every push to `dev` or `feature/*` branches. Builds images, pushes to registry, SSHs into the staging host, and runs `just staging`. No approval gate — intended for rapid iteration.

### `deploy-prod.yml`

Triggers on push to `main`. Builds images and pushes to registry, then waits for **two reviewer approvals** via GitHub Environment Protection (`production` environment). After approval, runs `just deploy prod` on the prod host with the tagged version.

### `security.yml`

Runs on every push and PR. Executes Trivy filesystem scan on the repository, Trivy image scan on built containers, and `just check-configs` for configuration audits. Blocks merge if CRITICAL or HIGH vulnerabilities are found.

## Pull Request Process

1. **Create PR** targeting `dev` (staging) or `main` (prod).
2. **Fill checklist:** link to relevant ADR, confirm integration tests pass locally (`just test-suite`).
3. **Reviews:** 1 reviewer for `dev`, 2 for `main`. Reviewers verify commit history, config changes, and security implications.
4. **Merge:** Squash-merge only. Do not use merge commits or rebase merges.

## Compose Validation

Before pushing, validate your compose file changes:

```bash
just validate-compose
```

This recipe checks the modular Compose files using `docker compose config` for YAML validity, service consistency, and correct profile service counts across dev (5), staging (11), and prod (25).

## Commit Message Convention

```
type(scope): description

feat(api): add /db-health endpoint with connection pool check
fix(redis): correct sentinel quorum calculation in entrypoint
chore(deps): bump oven/bun from 1.2.0 to 1.2.1
docs(runbooks): add vault-sealed incident response
refactor(caddy): extract rate-limiting into snippet
security(vault): add firewall rules for port 8200
```

**Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `security`, `test`, `ci`.
**Scope:** Service or component name (e.g., `api`, `redis`, `vault`, `otel`, `compose`).
