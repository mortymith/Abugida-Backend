# Adding a Service

Step-by-step guide for integrating a new service into the modular Docker Compose + Just infrastructure. Follow all steps in order to ensure the service is properly networked, observable, and deployable across all three environments.

## Service Template

Use this YAML block as a starting point. Choose the appropriate module file based on the service's role:

```yaml
# ═══════════════════════════════════════════════════════════════════
# My Service — Brief description (ADR-XXX)
# ═══════════════════════════════════════════════════════════════════
# Purpose: What this service does and why it exists.
# Network: Which layer it belongs to and why.
# Dependencies: Other services it connects to.
# ═══════════════════════════════════════════════════════════════════
my-service:
  image: myorg/my-service:1.0.0-alpine # Pinned, no :latest
  container_name: ${COMPOSE_PROJECT_NAME:-infra}_my-service
  restart: unless-stopped
  environment:
    ENVIRONMENT: ${ENVIRONMENT:-development}
    # Add non-sensitive config variables here
  volumes:
    - ./docker/config/my-service:/etc/my-service:ro
    - my_service_data:/data # Only if stateful
  depends_on:
    postgres-primary:
      condition: service_healthy # Only if DB dependency exists
  networks:
    - infrastructure # Choose network(s) per §2 below
  healthcheck:
    test: ['CMD', 'curl', '-sf', 'http://localhost:8080/health']
    interval: 15s
    timeout: 5s
    retries: 3
    start_period: 30s
  # Resource limits + ports set in profile override files
```

## Step-by-Step Checklist

### 1. Add Service Block to the Appropriate Module

Choose which `docker/compose/` module file to add the service to based on its role:

| Service Type                        | Module File                        | Examples                    |
| ----------------------------------- | ---------------------------------- | --------------------------- |
| Core infrastructure (all envs)      | `docker/compose/base.yml`          | Databases, caches, storage  |
| Application (staging + prod)        | `docker/compose/app.yml`           | API, Dashboard, Marketing   |
| Observability (staging + prod)      | `docker/compose/observability.yml` | OTEL, SigNoz                |
| Edge / ingress (prod only)          | `docker/compose/edge.yml`          | Caddy, Cloudflared          |
| HA replicas (prod only)             | `docker/compose/scaling.yml`       | Redis replicas, PG replicas |
| Security / secrets (prod + staging) | `docker/compose/security.yml`      | Vault, MinIO backup         |

Place the service block near related services. If stateful, add the volume to `docker/compose/volumes.yml`.

### 2. Choose Network(s)

Follow the network assignment rules from ADR-004:

| Network          | Subnet        | Use When                                            |
| ---------------- | ------------- | --------------------------------------------------- |
| `edge`           | 172.20.0.0/24 | Service receives external traffic (TLS termination) |
| `backend`        | 172.21.0.0/24 | Application service receiving traffic from Caddy    |
| `infrastructure` | 172.22.0.0/24 | Data store or internal service (no internet access) |

If the service needs both application traffic and data-layer access (like API/Dashboard), attach to multiple networks:

```yaml
networks:
  - backend
  - infrastructure
```

### 3. Add Healthcheck

Every service must have a healthcheck so `depends_on` conditions work correctly. Use a lightweight HTTP endpoint or a CLI command native to the image.

### 4. Create Config Directory

```
docker/config/my-service/
├── config.yaml          # Application configuration
└── init/               # Optional init scripts
```

Mount the config directory read-only into the container. Note the `docker/config/` prefix — all configuration files live under the consolidated `docker/` directory.

### 5. Add to Environment Override Files

Add the service to the appropriate `docker/compose/profiles/*.override.yml` files:

**`profiles/dev.override.yml`** — if the service runs in dev, publish ports and set dev resource limits:

```yaml
my-service:
  ports:
    - '${MY_SERVICE_PORT:-9090}:8080'
  deploy:
    resources:
      limits:
        cpus: '${MY_SERVICE_CPU_LIMIT:-1}'
        memory: ${MY_SERVICE_MEM_LIMIT:-1g}
```

**`profiles/staging.override.yml`** — if the service runs in staging, publish ports with moderate resources:

```yaml
my-service:
  ports:
    - '${MY_SERVICE_PORT:-9090}:8080'
  environment:
    ENVIRONMENT: staging
  deploy:
    resources:
      limits:
        cpus: '${MY_SERVICE_CPU_LIMIT:-2}'
        memory: ${MY_SERVICE_MEM_LIMIT:-2g}
```

**`profiles/prod.override.yml`** — if the service runs in prod, remove ports and add high resources with reservations:

```yaml
my-service:
  ports: []
  environment:
    ENVIRONMENT: production
  deploy:
    replicas: ${MY_SERVICE_REPLICAS:-2}
    resources:
      limits:
        cpus: '${MY_SERVICE_CPU_LIMIT:-4}'
        memory: ${MY_SERVICE_MEM_LIMIT:-8g}
      reservations:
        cpus: '2'
        memory: 4g
```

### 6. Add Just Recipes

Add recipes to `justfile` in the relevant section:

```just
# Build my-service image
build-my-service:
    docker compose build my-service

# Restart my-service
restart-my-service:
    {{DEV_COMPOSE}} up -d my-service

# View my-service logs
logs-my-service:
    {{DEV_COMPOSE}} logs -f my-service
```

### 7. Update Networking Matrix

Add the service to the network membership table in `docs/architecture/networking.md`. Include which networks it belongs to and which services it communicates with.

### 8. Add Environment Variables (If Needed)

- Dev/staging: Add variables with defaults to `.env.example`.
- Prod: Configure Vault secret engine and policy if the service needs credentials.
- Add port variable to `.env.example` if the service publishes ports in dev/staging (e.g., `MY_SERVICE_PORT=9090`).

### 9. Add Backup/Restore Scripts (If Stateful)

For services with persistent data, add scripts under `scripts/backup/` and `scripts/restore/`:

```bash
# scripts/backup/backup-my-service.sh
# scripts/restore/restore-my-service.sh
```

Add corresponding Just recipes:

```just
backup-my-service:
    bash scripts/backup/backup-my-service.sh

restore-my-service:
    bash scripts/restore/restore-my-service.sh
```

### 10. Update CI Workflows

If the service has a custom Dockerfile or requires build-time secrets, update the CI pipeline in `.github/workflows/`:

- Add the image to the build matrix.
- Add Trivy scanning for the new image.
- Add integration test targets.
