#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$ROOT/.env"
val() { grep -E "^${1}=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '\r' || true; }

echo "Paper launcher — проверка"
echo "------------------------"
if [[ ! -f "$ENV" ]]; then
  echo "✗ Нет .env — скопируйте: cp .env.example .env"
  exit 1
fi
echo "✓ .env найден"
LIVE="$(val LIVE_TRADING_ENABLED)"; MODE="$(val ENGINE_TRADING_MODE)"
case "$LIVE" in true|1) echo "✗ LIVE_TRADING_ENABLED должен быть false"; exit 1 ;; esac
case "$MODE" in live) echo "✗ ENGINE_TRADING_MODE должен быть paper"; exit 1 ;; esac
echo "✓ paper mode, live off"
GAC="$(val GOOGLE_APPLICATION_CREDENTIALS)"; PERSIST="$(val ENGINE_PERSISTENCE)"
if [[ "$PERSIST" == "firestore" ]]; then
  [[ -z "$GAC" ]] && { echo "✗ Нет GOOGLE_APPLICATION_CREDENTIALS"; exit 1; }
  [[ ! -f "$GAC" ]] && { echo "✗ Нет файла: $GAC"; exit 1; }
  echo "✓ Firestore + ключ: $GAC"
else
  echo "✓ Режим memory (Firestore не обязателен)"
fi
echo "✓ Можно: pnpm run paper:start"
