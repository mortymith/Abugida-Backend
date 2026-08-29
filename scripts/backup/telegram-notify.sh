#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════════
# Telegram Notification Script (ADR-018) — Shared Notifier
# ═════════════════════════════════════════════════════════════════════════════════
#
# Centralized Telegram notification used by:
#   - Backup scripts (success/failure notifications)
#   - Deploy scripts (deployment status)
#   - SigNoz alert manager (webhook receiver)
#   - Manual operational alerts (just telegram-test-alert)
#
# Source: .env.prod (or environment variables) for BOT_TOKEN and CHAT_ID.
#
# Usage:
#   bash scripts/backup/telegram-notify.sh "Message text"
#   LEVEL=error bash scripts/backup/telegram-notify.sh "Something failed"
#   CONTEXT=backup TASK=postgres bash scripts/backup/telegram-notify.sh "Done"
#
# Environment Variables:
#   TELEGRAM_BOT_TOKEN   - Bot API token (required)
#   TELEGRAM_CHAT_ID     - Target chat ID (required)
#   LEVEL                - Alert level: info|warn|error|critical (default: info)
#   CONTEXT              - Context tag: backup|deploy|alert|ops (default: ops)
#   TASK                 - Sub-task name (default: unset)
#   TELEGRAM_PARSE_MODE  - Message format: Markdown|HTML (default: Markdown)
# ═════════════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Load environment ──────────────────────────────────────────────────────
if [ -f .env.prod ]; then
  # Source non-interactively: only pull what we need
  # Avoid 'set -e' failing on grep no-match
  _bot_token=$(grep -E '^TELEGRAM_BOT_TOKEN=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  _chat_id=$(grep -E '^TELEGRAM_CHAT_ID=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-${_bot_token:-}}"
  TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-${_chat_id:-}}"
fi

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
MESSAGE="${1:-Notification from infrastructure}"
LEVEL="${LEVEL:-info}"
CONTEXT="${CONTEXT:-ops}"
TASK="${TASK:-}"
PARSE_MODE="${TELEGRAM_PARSE_MODE:-Markdown}"
HOSTNAME_VALUE="$(hostname -s 2> /dev/null || echo 'unknown')"
TIMESTAMP="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# ── Validate required variables ──────────────────────────────────────────
if [ -z "${BOT_TOKEN}" ] || [ -z "${CHAT_ID}" ]; then
  echo "[telegram-notify][ERROR] TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set."
  echo "  Set them in .env.prod or export as environment variables."
  exit 1
fi

# ── Build formatted message ──────────────────────────────────────────────
# Emoji prefix based on level
LEVEL_ICON=""
LEVEL_UPPER="$(echo "${LEVEL}" | tr '[:lower:]' '[:upper:]')"
case "${LEVEL}" in
info) LEVEL_ICON="ℹ️" ;;
warn) LEVEL_ICON="⚠️" ;;
error) LEVEL_ICON="🔴" ;;
critical) LEVEL_ICON="🚨" ;;
*) LEVEL_ICON="📢" ;;
esac

# Context prefix
CONTEXT_TAG="[${CONTEXT}]"
if [ -n "${TASK}" ]; then
  CONTEXT_TAG="[${CONTEXT}/${TASK}]"
fi

FULL_MESSAGE="${LEVEL_ICON} *${CONTEXT_TAG}* \[${LEVEL_UPPER}\]
${MESSAGE}

time: \`${TIMESTAMP}\`
host: \`${HOSTNAME_VALUE}\`"

# ── Send message ─────────────────────────────────────────────────────────
PAYLOAD=$(jq -n \
  --arg chat_id "${CHAT_ID}" \
  --arg text "${FULL_MESSAGE}" \
  --arg parse_mode "${PARSE_MODE}" \
  '{chat_id: $chat_id, text: $text, parse_mode: $parse_mode}')

RESPONSE_FILE=$(mktemp /tmp/telegram-notify-XXXXXX.json)
trap 'rm -f "${RESPONSE_FILE}"' EXIT

HTTP_CODE=$(curl -s -o "${RESPONSE_FILE}" -w '%{http_code}' \
  -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

if [ "${HTTP_CODE}" = "200" ]; then
  echo "[telegram-notify][OK] [${LEVEL}] ${CONTEXT_TAG} message sent to chat ${CHAT_ID}"
else
  echo "[telegram-notify][ERROR] Telegram API returned ${HTTP_CODE}"
  cat "${RESPONSE_FILE}" 2> /dev/null
  exit 1
fi
