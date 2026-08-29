#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Prerequisites Installation (Ubuntu 22.04 / 24.04)
# Source: prerequisites.md, ADR-009
#
# Installs all required tools for this project:
#   Docker CE + Compose plugin, Just, Bun, jq, Trivy, nmap,
#   keepalived, iptables-persistent
#
# Idempotent — safe to re-run.
#
# Usage:
#   sudo bash scripts/setup/prerequisites.sh
#   bash scripts/setup/prerequisites.sh          # no-root checks only
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${CYAN}[prerequisites]${NC} $*"; }
log_ok() { echo -e "${GREEN}[prerequisites][OK]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[prerequisites][WARN]${NC} $*"; }
log_err() { echo -e "${RED}[prerequisites][ERROR]${NC} $*" >&2; }

# ── Version targets ──────────────────────────────────────────────
DOCKER_VERSION="27.0"
JUST_VERSION="1.40.0"
BUN_VERSION="1.2.1"
TRIVY_VERSION="0.58.0"

# ── Detect architecture ──────────────────────────────────────────
ARCH=$(uname -m)
case "${ARCH}" in
x86_64) ARCH_ALT="amd64" ;;
aarch64) ARCH_ALT="arm64" ;;
*)
  log_err "Unsupported architecture: ${ARCH}"
  exit 1
  ;;
esac

# ── Check Ubuntu version ─────────────────────────────────────────
if [ -f /etc/os-release ]; then
  . /etc/os-release
  if [ "${ID}" != "ubuntu" ]; then
    log_warn "This script is designed for Ubuntu. Detected: ${ID} ${VERSION_ID}"
    log_warn "Proceeding anyway, but some steps may fail."
  else
    log_info "Detected Ubuntu ${VERSION_ID} (${ARCH})"
  fi
else
  log_warn "Cannot detect OS from /etc/os-release. Proceeding..."
fi

# ── Ensure running with sudo for install operations ─────────────
if [ "${1:-}" != "--check" ] && [ "$(id -u)" -ne 0 ]; then
  log_err "This script must be run with sudo (or as root)."
  log_err "  sudo bash scripts/setup/prerequisites-ubuntu.sh"
  exit 1
fi

# ═══════════════════════════════════════════════════════════════════
# 1. Update package index
# ═══════════════════════════════════════════════════════════════════
log_info "Updating package index..."
apt-get update -qq
log_ok "Package index updated."

# ═══════════════════════════════════════════════════════════════════
# 2. Install apt packages
# ═══════════════════════════════════════════════════════════════════
log_info "Installing apt packages (jq, nmap, keepalived, iptables-persistent, ca-certificates, curl, gnupg)..."

# Pre-seed iptables-persistent to avoid interactive prompt
echo iptables-persistent iptables-persistent/autosave_v4 boolean true | debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | debconf-set-selections

apt-get install -y -qq \
  jq \
  nmap \
  keepalived \
  iptables-persistent \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  apt-transport-https \
  software-properties-common \
  unzip \
  git 2> /dev/null

log_ok "Apt packages installed."

# ═══════════════════════════════════════════════════════════════════
# 3. Docker CE + Compose plugin
# ═══════════════════════════════════════════════════════════════════
install_docker() {
  if command -v docker &> /dev/null; then
    INSTALLED=$(docker --version | grep -oP '\d+\.\d+' | head -1)
    log_info "Docker already installed: $(docker --version)"
    # Check compose plugin
    if docker compose --project-directory . version &> /dev/null; then
      log_ok "Docker Compose plugin: $(docker compose --project-directory . version)"
    else
      log_warn "Docker Compose plugin not found. Installing..."
      apt-get install -y -qq docker-compose-plugin 2> /dev/null
    fi
    return 0
  fi

  log_info "Installing Docker CE ${DOCKER_VERSION}+..."

  # Add Docker's official GPG key
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2> /dev/null
  chmod a+r /etc/apt/keyrings/docker.gpg

  # Add Docker repository
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Enable Docker service
  systemctl enable docker
  systemctl start docker

  log_ok "Docker installed: $(docker --version)"
  log_ok "Docker Compose: $(docker compose --project-directory . version)"
}

install_docker

# ═══════════════════════════════════════════════════════════════════
# 4. Kernel tuning — Redis vm.overcommit_memory
# ═══════════════════════════════════════════════════════════════════
# Redis recommends vm.overcommit_memory=1 to prevent background saves
# from failing under low-memory conditions. This is a HOST-WIDE knob —
# it cannot be set per-container via Docker sysctls (runc rejects it
# with "not in a separate kernel namespace" on kernels where it isn't
# namespaced), so we persist it in /etc/sysctl.d instead.
# Idempotent and reboot-persistent.
log_info "Applying kernel tuning: vm.overcommit_memory=1 ..."
cat > /etc/sysctl.d/99-redis-overcommit.conf << 'EOF'
vm.overcommit_memory = 1
EOF
sysctl --system > /dev/null
log_ok "Kernel tuning applied: $(sysctl -n vm.overcommit_memory)"

# ═══════════════════════════════════════════════════════════════════
# 5. Just (task runner)
# ═══════════════════════════════════════════════════════════════════
install_just() {
  if command -v just &> /dev/null; then
    log_ok "Just already installed: $(just --version)"
    return 0
  fi

  log_info "Installing Just ${JUST_VERSION}..."
  curl --proto '=https' --tlsv1.2 -sSfL \
    "https://github.com/casey/just/releases/download/${JUST_VERSION}/just-${JUST_VERSION}-$(uname -m)-unknown-linux-musl.tar.gz" |
    tar -xz -C /usr/local/bin/
  chmod +x /usr/local/bin/just
  log_ok "Just installed: $(just --version)"
}

install_just

# ═══════════════════════════════════════════════════════════════════
# 6. Bun (JavaScript/TypeScript runtime)
# ═══════════════════════════════════════════════════════════════════
install_bun() {
  if command -v bun &> /dev/null; then
    log_ok "Bun already installed: $(bun --version)"
    return 0
  fi

  log_info "Installing Bun ${BUN_VERSION}..."
  curl -fsSL https://bun.sh/install | bash -s "bun-v${BUN_VERSION}"

  # Make available to all users (installed to root's PATH by default)
  BUN_BIN="${HOME}/.bun/bin"
  if [ -d "${BUN_BIN}" ]; then
    ln -sf "${BUN_BIN}/bun" /usr/local/bin/bun 2> /dev/null || true
  fi

  log_ok "Bun installed: $(bun --version)"
}

install_bun

# ═══════════════════════════════════════════════════════════════════
# 7. Trivy (container image scanner)
# ═══════════════════════════════════════════════════════════════════
install_trivy() {
  if command -v trivy &> /dev/null; then
    log_ok "Trivy already installed: $(trivy --version | head -1)"
    return 0
  fi

  log_info "Installing Trivy ${TRIVY_VERSION}..."
  curl -fsSL https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_Linux-${ARCH_ALT}.tar.gz |
    tar -xz -C /usr/local/bin/ trivy
  chmod +x /usr/local/bin/trivy
  log_ok "Trivy installed: $(trivy --version | head -1)"
}

install_trivy

# ═══════════════════════════════════════════════════════════════════
# 8. Add user to docker group (if not root)
# ═══════════════════════════════════════════════════════════════════
SUDO_USER="${SUDO_USER:-}"
if [ -n "${SUDO_USER}" ] && [ "${SUDO_USER}" != "root" ]; then
  if ! groups "${SUDO_USER}" | grep -q docker; then
    usermod -aG docker "${SUDO_USER}"
    log_ok "Added user '${SUDO_USER}' to docker group."
    log_warn "Log out and back in for group changes to take effect."
  fi
fi

# ═══════════════════════════════════════════════════════════════════
# 9. Verification
# ═══════════════════════════════════════════════════════════════════
echo ""
echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
log_info "Prerequisites installation complete. Verification:"
echo ""

CHECKS=(
  "docker:Docker CE 27.x+"
  "docker compose:Docker Compose v2.24+"
  "just:Just 1.40+"
  "bun:Bun 1.2+"
  "trivy:Trivy 0.58+"
  "jq:jq 1.6+"
  "nmap:nmap 7.80+"
  "keepalived:Keepalived"
  "iptables:iptables-persistent"
)

FAIL=0
for CHECK in "${CHECKS[@]}"; do
  CMD="${CHECK%%:*}"
  DESC="${CHECK##*:}"

  # Special case for 'docker compose' (subcommand)
  if [ "${CMD}" = "docker compose" ]; then
    if docker compose --project-directory . version &> /dev/null; then
      VERSION=$(docker compose --project-directory . version --short 2> /dev/null || docker compose --project-directory . version)
      log_ok "  ${DESC}  →  ${VERSION}"
    else
      log_err "  ${DESC}  →  NOT FOUND"
      FAIL=1
    fi
  elif command -v ${CMD%% *} &> /dev/null; then
    VERSION=$("${CMD%% *}" --version 2> /dev/null | head -1 || echo "installed")
    log_ok "  ${DESC}  →  ${VERSION}"
  else
    log_err "  ${DESC}  →  NOT FOUND"
    FAIL=1
  fi
done

# Kernel tuning check (section 4)
if [ "$(sysctl -n vm.overcommit_memory 2> /dev/null)" = "1" ]; then
  log_ok "  vm.overcommit_memory  →  1 (Redis overcommit)"
else
  log_err "  vm.overcommit_memory  →  NOT 1 (expected 1)"
  FAIL=1
fi

echo ""
if [ "${FAIL}" -eq 0 ]; then
  log_ok "All prerequisites satisfied."
else
  log_warn "Some prerequisites are missing. Review the errors above."
fi

echo -e "${CYAN}══════════════════════════════════════════════════════${NC}"
echo ""
log_info "Next steps:"
log_info "  1. cp .env.example .env"
log_info "  2. just setup-dev"
log_info "  3. just health"
echo ""
