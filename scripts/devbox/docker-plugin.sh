#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# docker-plugin.sh — make `docker compose` work inside the sandbox
# ADR-026
#
# The Docker CLI discovers Compose plugins in:
#   ~/.docker/cli-plugins        (user scope)
#   /usr/local/lib/docker/cli-plugins
#   /usr/libexec/docker/cli-plugins
#
# The Nix-provided Compose binary lives in the Nix store, which is none of those
# paths. This script links the sandbox binary into the user-scope plugin
# directory so the repository's `docker compose …` invocations (justfile,
# scripts/lib/compose.sh) work unchanged inside `devbox shell`.
#
# It is a no-op when `docker compose` already resolves.
# ══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

compose_bin="$(command -v docker-compose 2>/dev/null || true)"
if [[ -z "$compose_bin" ]]; then
  echo "devbox: docker-compose is not installed in the sandbox; skipping plugin wiring" >&2
  exit 0
fi

if docker compose version >/dev/null 2>&1; then
  exit 0
fi

plugin_dir="${DOCKER_CONFIG:-$HOME/.docker}/cli-plugins"
mkdir -p "$plugin_dir"
target="$plugin_dir/docker-compose"

if [[ -L "$target" || -f "$target" ]]; then
  if [[ "$(readlink -f "$target" 2>/dev/null || echo)" == "$(readlink -f "$compose_bin")" ]]; then
    exit 0
  fi
  rm -f "$target"
fi

ln -s "$compose_bin" "$target"
echo "devbox: linked $(basename "$compose_bin") into $plugin_dir (docker compose now available)"
