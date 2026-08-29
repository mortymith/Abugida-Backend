# ═══════════════════════════════════════════════════════════════════════════════════════════════
# Redis Dockerfile — Multi-role (server / sentinel)
# Source: deployment.md v3.0.0, ADR-014, ADR-022
#
# ROLE env var selects mode:
#   - "primary" or "replica" → redis-server
#   - "sentinel"             → redis-sentinel
#
# 2.6 Fix: Health check now uses redis-cli with password file.
#   The entrypoint generates the health check command based on the
#   actual password at startup.
#
# 4.6 Fix: Standardized health check interval to 10s.
# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════
ARG REDIS_VERSION=7.4
FROM redis:${REDIS_VERSION}-alpine

ARG DEPLOY_VERSION=0.0.1

LABEL org.opencontainers.image.title="Redis Multi-Role" \
      org.opencontainers.image.description="Redis server or sentinel (selected via ROLE env var)" \
      org.opencontainers.image.source="https://github.com/redis/redis" \
      org.opencontainers.image.vendor="Infra Platform" \
      org.opencontainers.image.version="${DEPLOY_VERSION}"

RUN apk add --no-cache bash jq

RUN mkdir -p /var/run/redis /data /etc/redis/tls && \
    chown redis:redis /var/run/redis /data /etc/redis/tls

COPY docker/config/redis/redis.conf /usr/local/etc/redis/redis.conf
COPY docker/config/redis/redis-sentinel.conf /usr/local/etc/redis/redis-sentinel.conf
COPY docker/config/redis/users.acl /usr/local/etc/redis/users.acl.tpl
COPY docker/dockerfiles/redis/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/dockerfiles/redis/healthcheck.sh /usr/local/bin/healthcheck.sh

RUN chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/healthcheck.sh

EXPOSE 6379 26379

# 2.6 Fix: Health check uses a wrapper script that resolves the password
# from secrets at runtime, avoiding unauthenticated PING.
HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=15s \
    CMD /usr/local/bin/healthcheck.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
