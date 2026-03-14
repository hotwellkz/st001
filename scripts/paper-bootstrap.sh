#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$ROOT/.env"
val() { grep -E "^${1}=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '\r' || true; }
[[ ! -f "$ENV" ]] && { echo "Нет .env"; exit 1; }
export GOOGLE_APPLICATION_CREDENTIALS="$(val GOOGLE_APPLICATION_CREDENTIALS)"
export ENGINE_INSTANCE_ID="$(val ENGINE_INSTANCE_ID)"
[[ -z "$ENGINE_INSTANCE_ID" ]] && export ENGINE_INSTANCE_ID="local-paper-1"
[[ -z "$GOOGLE_APPLICATION_CREDENTIALS" || ! -f "$GOOGLE_APPLICATION_CREDENTIALS" ]] && { echo "Нужен существующий GOOGLE_APPLICATION_CREDENTIALS в .env"; exit 1; }
cd "$ROOT"
pnpm --filter @pkg/storage run firestore:bootstrap
echo "Готово. Запуск: pnpm run paper:start"
