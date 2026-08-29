#!/usr/bin/env bash
# Validate Secret Strength — NIST SP 800-63B Compliance
# Path: scripts/security/validate-secrets.sh
# Called by: just validate-secrets (Phase 9 Justfile)
#
# Tiered secrets strategy (ADR-006):
#   - Development: secrets live in the .env file as environment variables
#   - Staging/Prod: secrets are Vault-managed; export them (or point
#     --env-file at a Vault-rendered env file) to validate before deploy
#
# Checks each required secret variable for:
#   1. Minimum length (>= 20 characters, NIST SP 800-63B §5.1.1.2)
#   2. Shannon entropy (>= 3.0 bits/char)
#   3. No common dictionary words
#   4. Character class diversity (>= 3 of: upper, lower, digit, symbol)
#
# Exits 0 if all secrets pass, exits 1 if any fail.

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ─── Configuration ───────────────────────────────────────────────────────────
MIN_LENGTH=20
MIN_ENTROPY_PER_CHAR=3.0 # bits per character (base64 ≈ 6.0, alphanumeric ≈ 5.17)
MIN_CHAR_CLASSES=3

# The canonical secret variables (ADR-006 migration table).
REQUIRED_SECRETS=(
  POSTGRES_PASSWORD
  REDIS_PASSWORD
  REDIS_ADMIN_PASSWORD
  REDIS_READONLY_PASSWORD
  REDIS_SENTINEL_PASSWORD
  MINIO_ROOT_PASSWORD
  API_SECRET_KEY
  PS_REPLICATION_PASSWORD
  PS_STORAGE_PASSWORD
)

# ─── Counters ────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
WARN=0

# ─── Helpers ────────────────────────────────────────────────────────────────

usage() {
  echo "Usage: $0 [--env-file FILE] [--min-length N]"
  echo ""
  echo "Validates all required secret variables against NIST strength criteria."
  echo "Values are read from the given env file and/or the current environment."
  echo ""
  echo "Options:"
  echo "  --env-file FILE   Env file to load (default: ${PROJECT_ROOT}/.env)"
  echo "  --min-length N    Minimum password length (default: ${MIN_LENGTH})"
  echo "  --help            Show this help"
  exit 0
}

# Calculate Shannon entropy of a string (bits per character)
# Formula: H = -sum( p_i * log2(p_i) )
# Uses fold + sort + uniq to count character frequencies portably.
calc_entropy() {
  local str="$1"
  local len="${#str}"

  if [ "$len" -eq 0 ]; then
    echo "0.00"
    return
  fi

  echo -n "$str" |
    fold -w1 |
    sort |
    uniq -c |
    awk -v len="$len" '
        {
            p = $1 / len
            entropy -= p * log(p) / log(2)
        }
        END {
            printf "%.2f\n", entropy
        }'
}

# Count unique character classes present
# Classes: uppercase, lowercase, digits, symbols
char_classes() {
  local str="$1"
  local classes=0

  [[ "$str" =~ [A-Z] ]] && ((classes++)) || true
  [[ "$str" =~ [a-z] ]] && ((classes++)) || true
  [[ "$str" =~ [0-9] ]] && ((classes++)) || true
  [[ "$str" =~ [^A-Za-z0-9] ]] && ((classes++)) || true

  echo "$classes"
}

# Check for common dictionary words (basic substring check against a built-in list)
# This is a simplified check — a full implementation would use a dictionary file.
contains_dictionary_word() {
  local str="${1,,}" # lowercase
  local len="${#str}"

  # Common weak passwords / dictionary words to reject
  # (abbreviated list — extend as needed)
  local -a weak_patterns=(
    "password" "pass" "secret" "admin" "root" "user" "test"
    "qwerty" "abc123" "letmein" "welcome" "monkey" "dragon"
    "master" "login" "hello" "charlie" "donald" "shadow"
    "sunshine" "princess" "football" "iloveyou" "trustno1"
    "123456" "12345678" "123456789" "1234567890"
    "abcdefgh" "abcdef" "aaaaaa"
  )

  for word in "${weak_patterns[@]}"; do
    # Only flag if the dictionary word is a significant portion of the secret
    # (word length >= 4 and >= 30% of secret length)
    local word_len="${#word}"
    if [ "$word_len" -ge 4 ]; then
      if [[ "$str" == *"$word"* ]]; then
        # Check if it's a significant substring
        local threshold=$((len * 30 / 100))
        if [ "$word_len" -ge "$threshold" ]; then
          echo "$word"
          return 0
        fi
      fi
    fi
  done

  return 1
}

# ─── Parse Arguments ─────────────────────────────────────────────────────────
ENV_FILE="${PROJECT_ROOT}/.env"

while [[ $# -gt 0 ]]; do
  case "$1" in
  --env-file)
    ENV_FILE="$2"
    shift 2
    ;;
  --min-length)
    MIN_LENGTH="$2"
    shift 2
    ;;
  --help | -h)
    usage
    ;;
  *)
    echo -e "${RED}Unknown option: $1${RESET}"
    usage
    ;;
  esac
done

# Load KEY=VALUE pairs from the env file into the environment (without
# clobbering variables that are already exported).
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    if [ -z "${!key:-}" ]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < <(grep -v '^[[:space:]]*#' "$ENV_FILE" | grep -v '^[[:space:]]*$')
else
  echo -e "${YELLOW}  [WARN] Env file not found: ${ENV_FILE}${RESET}"
  echo -e "${YELLOW}         Falling back to exported environment variables only.${RESET}"
fi

# ─── Validate ───────────────────────────────────────────────────────────────

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Secret Strength Validation (NIST SP 800-63B)${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""
echo "  Env file:       ${ENV_FILE}"
echo "  Secrets:        ${#REQUIRED_SECRETS[@]} required variables"
echo "  Min length:     ${MIN_LENGTH} characters"
echo "  Min entropy:    ${MIN_ENTROPY_PER_CHAR} bits/char"
echo "  Min char class: ${MIN_CHAR_CLASSES} of 4"
echo ""

for name in "${REQUIRED_SECRETS[@]}"; do
  value="${!name:-}"
  length="${#value}"
  errors=()
  warnings=()

  # ── Check 0: presence ────────────────────────────────────────────────
  if [ "$length" -eq 0 ]; then
    printf "  ${RED}✗ FAIL${RESET}  %-28s not set (env or %s)\n" "${name}" "$(basename "$ENV_FILE")"
    FAIL=$((FAIL + 1))
    continue
  fi

  # ── Check 1: Minimum length ──────────────────────────────────────────
  if [ "$length" -lt "$MIN_LENGTH" ]; then
    errors+=("length ${length} < ${MIN_LENGTH}")
  fi

  # ── Check 2: Shannon entropy ─────────────────────────────────────────
  entropy="$(calc_entropy "$value")"
  # Compare floats using awk (no bc dependency)
  if awk -v e="$entropy" -v m="$MIN_ENTROPY_PER_CHAR" 'BEGIN { exit !(e < m) }'; then
    errors+=("entropy ${entropy} bits/char < ${MIN_ENTROPY_PER_CHAR}")
  fi

  # ── Check 3: Dictionary words ────────────────────────────────────────
  dict_word="$(contains_dictionary_word "$value" 2> /dev/null || true)"
  if [ -n "$dict_word" ]; then
    warnings+=("contains dictionary substring '${dict_word}'")
  fi

  # ── Check 4: Character class diversity ───────────────────────────────
  classes="$(char_classes "$value")"
  if [ "$classes" -lt "$MIN_CHAR_CLASSES" ]; then
    errors+=("${classes} char classes < ${MIN_CHAR_CLASSES}")
  fi

  # ── Check 5: No trailing/leading whitespace ───────────────────────────
  if [[ "$value" == *[[:space:]] || "$value" == [[:space:]]* ]]; then
    errors+=("has leading/trailing whitespace")
  fi

  # ── Report ───────────────────────────────────────────────────────────
  if [ ${#errors[@]} -eq 0 ] && [ ${#warnings[@]} -eq 0 ]; then
    printf "  ${GREEN}✓ PASS${RESET}  %-28s len=%-3d entropy=%.1f classes=%d\n" \
      "$name" "$length" "$entropy" "$classes"
    PASS=$((PASS + 1))
  elif [ ${#errors[@]} -eq 0 ]; then
    printf "  ${YELLOW}⚠ WARN${RESET}  %-28s len=%-3d entropy=%.1f classes=%d\n" \
      "$name" "$length" "$entropy" "$classes"
    for w in "${warnings[@]}"; do
      echo -e "           ${YELLOW}→ ${w}${RESET}"
    done
    WARN=$((WARN + 1))
  else
    printf "  ${RED}✗ FAIL${RESET}  %-28s len=%-3d entropy=%.1f classes=%d\n" \
      "$name" "$length" "$entropy" "$classes"
    for e in "${errors[@]}"; do
      echo -e "           ${RED}→ ${e}${RESET}"
    done
    for w in "${warnings[@]}"; do
      echo -e "           ${YELLOW}→ ${w}${RESET}"
    done
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"
printf "  ${GREEN}Passed: %d${RESET}   ${YELLOW}Warnings: %d${RESET}   ${RED}Failed: %d${RESET}\n" "$PASS" "$WARN" "$FAIL"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

exit 0
