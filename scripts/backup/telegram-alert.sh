#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Telegram Alert (ADR-018)
#
# Sends a message to the configured Telegram chat.
# Requires TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in environment.
#
# Usage:
#   bash scripts/backup/telegram-alert.sh "Alert message"
#   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_CHAT_ID=yyy bash scripts/backup/telegram-alert.sh "test"
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

# Load from .env.prod if available (non-interactive)
if [ -f .env.prod ]; then
  _bot_token=$(grep -E '^TELEGRAM_BOT_TOKEN=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  _chat_id=$(grep -E '^TELEGRAM_CHAT_ID=' .env.prod 2> /dev/null | head -1 | cut -d'=' -f2-)
  TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-${_bot_token:-}}"
  TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-${_chat_id:-}}"
fi

# Also try from current environment
BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"
MESSAGE="${1:-Test alert from infrastructure}"

if [ -z "${BOT_TOKEN}" ] || [ -z "${CHAT_ID}" ]; then
  echo "[telegram-alert][ERROR] TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set."
  echo "  Set them in .env.prod or export as environment variables."
  exit 1
fi

# ── Send message ──────────────────────────────────────────────────
PAYLOAD=$(jq -n \
  --arg chat_id "${CHAT_ID}" \
  --arg text "${MESSAGE}" \
  '{chat_id: $chat_id, text: $text, parse_mode: "Markdown"}')

HTTP_CODE=$(curl -s -o /tmp/telegram-response.json -w '%{http_code}' \
  -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

if [ "${HTTP_CODE}" = "200" ]; then
  echo "[telegram-alert][OK] Message sent to chat ${CHAT_ID}"
else
  echo "[telegram-alert][ERROR] Telegram API returned ${HTTP_CODE}"
  cat /tmp/telegram-response.json 2> /dev/null
  exit 1
fi
