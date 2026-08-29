# ═════════════════════════════════════════════════════════
# PostgreSQL 17 Replica Image
# Source: deployment.md v3.0.0, ADR-002
#
# Builds a replica image that:
#   1. On first boot (no PGDATA), runs pg_basebackup from the primary.
#   2. On subsequent boots, starts normally with recovery.signal.
#
# Required runtime env:
#   POSTGRES_PRIMARY_HOST  — DNS name of the primary
#   SLOT_NAME              — Replication slot name
#   POSTGRES_PASSWORD_FILE — Path to Docker secret (mounted read-only)
# ═════════════════════════════════════════════════════════
ARG PG_VERSION=17
FROM postgres:${PG_VERSION}-alpine

ARG DEPLOY_VERSION=0.0.1

LABEL org.opencontainers.image.title="PostgreSQL 17 Replica" \
      org.opencontainers.image.description="Streaming replica with pg_basebackup bootstrap" \
      org.opencontainers.image.vendor="Infra Platform" \
      org.opencontainers.image.version="${DEPLOY_VERSION}"

# postgresql17-client is bundled in the alpine image;
# gosu is included in the official postgres alpine image.
# No extra packages needed.

# Copy replica config overrides
COPY docker/config/postgres/conf/replica.conf /etc/postgresql/replica.conf

# Custom entrypoint wraps the standard one
COPY docker/dockerfiles/postgres-replica/entrypoint.sh /usr/local/bin/replica-entrypoint.sh
RUN chmod +x /usr/local/bin/replica-entrypoint.sh

EXPOSE 5432

# Docker-native health check (uses env vars from compose)
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=60s \
    CMD pg_isready -U ${POSTGRES_USER:-app} -d ${POSTGRES_DB:-app} || exit 1

ENTRYPOINT ["/usr/local/bin/replica-entrypoint.sh"]
CMD ["postgres"]
