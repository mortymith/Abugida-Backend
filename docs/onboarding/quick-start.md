# Quick Start

Get the full development stack running in under five minutes.

## One-Block Startup

```bash
git clone <repository-url> ~/my-project && cd ~/my-project
just prerequisites
cp .env.example .env
just dev
just health
```

> **Before first boot:** replace every `change-me` value in `.env` (9 secrets). Passwords are baked into storage volumes on first start — changing them later requires `just dev-clean`, which destroys local data. See [Environment Variables Reference](../configuration/environment-variables.md).

## Service Overview

The dev environment runs 5 core infrastructure services:

| Service       | Role                                         |
| ------------- | -------------------------------------------- |
| PostgreSQL 17 | Primary relational database (Alpine)         |
| PgBouncer     | Lightweight connection pooler for PostgreSQL |
| Redis 7.4     | In-memory cache and message broker           |
| MinIO         | S3-compatible object storage                 |
| PowerSync     | Real-time sync engine (logical replication)  |

Staging adds 6 more: API, Dashboard, Marketing, and the observability stack (ClickHouse, OTEL Collector, SigNoz). Production adds 14 more for full HA.

## Access Points (Dev)

| URL                   | Description                     |
| --------------------- | ------------------------------- |
| http://localhost:5432 | PostgreSQL (pgbouncer on :6432) |
| http://localhost:6379 | Redis                           |
| http://localhost:9000 | MinIO S3 API                    |
| http://localhost:9001 | MinIO Console                   |
| http://localhost:8085 | PowerSync sync endpoint         |

## Access Points (Staging)

All dev ports plus:

| URL                   | Description                    |
| --------------------- | ------------------------------ |
| http://localhost:3001 | API server                     |
| http://localhost:8081 | Dashboard app                  |
| http://localhost:8082 | Marketing site                 |
| http://localhost:8123 | ClickHouse HTTP                |
| http://localhost:3002 | SigNoz observability dashboard |
| http://localhost:4317 | OTEL gRPC endpoint             |
| http://localhost:4318 | OTEL HTTP endpoint             |

## Common Just Recipes

| Recipe                   | Description                                       |
| ------------------------ | ------------------------------------------------- |
| `just dev`               | Start dev environment (5 infrastructure services) |
| `just staging`           | Start staging environment (20 services)           |
| `just health`            | Check health status of every service              |
| `just logs <svc>`        | Stream logs for a service                         |
| `just restart <svc>`     | Restart a single service                          |
| `just stop`              | Stop all services without removing volumes        |
| `just down`              | Stop and remove containers, networks              |
| `just scan`              | Run Trivy vulnerability scan on built images      |
| `just backup-db`         | Create a PostgreSQL backup                        |
| `just restore-db <file>` | Restore PostgreSQL from a backup file             |
