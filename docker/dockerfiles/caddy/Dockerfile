# ═════════════════════════════════════════════════════════
# Caddy Dockerfile
# Source: deployment.md v3.0.0, ADR-001, ADR-011
#
# Builds a non-root Caddy image with operational utilities.
#   NET_ADMIN capability is required at runtime for VIP
#   operations (granted in compose, not in the image).
# ═════════════════════════════════════════════════════════
ARG CADDY_VERSION=2.8.4
FROM caddy:${CADDY_VERSION}-alpine
ARG DEPLOY_VERSION=0.0.1

LABEL org.opencontainers.image.title="Caddy Reverse Proxy" \
      org.opencontainers.image.description="TLS termination and reverse proxy with active-standby HA" \
      org.opencontainers.image.vendor="Infra Platform" \
      org.opencontainers.image.version="${DEPLOY_VERSION}" \
      org.opencontainers.image.source="https://github.com/caddyserver/caddy"

RUN apk add --no-cache bash curl jq

# Create non-root user for Caddy process
RUN addgroup -g 1000 caddy && \
    adduser -u 1000 -G caddy -s /bin/sh -h /home/caddy -D caddy

# Create directories with correct ownership
RUN mkdir -p /var/log/caddy /etc/caddy/snippets /etc/caddy/data /etc/caddy/logs && \
    chown -R caddy:caddy /var/log/caddy /etc/caddy/data /etc/caddy/logs

# Copy configuration
COPY docker/config/caddy/Caddyfile /etc/caddy/Caddyfile
COPY docker/config/caddy/snippets/ /etc/caddy/snippets/

# Copy startup script
COPY docker/dockerfiles/caddy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 80 443

# Health check — probed by Docker and Keepalived for VIP failover
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=15s \
    CMD curl -sf http://localhost:80/health || exit 1

USER caddy

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
