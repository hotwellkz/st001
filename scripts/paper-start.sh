#!/usr/bin/env bash
# Один запуск paper engine с корня репозитория. Live никогда не включается.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV="$ROOT/.env"

die() { echo ""; echo "  $1"; echo ""; exit 1; }

if [[ ! -f "$ENV" ]]; then
  die "Нет файла .env. Сделайте так:
  1) cd $(basename "$ROOT")
  2) cp .env.example .env
  3) откройте .env и заполните путь к JSON ключу в GOOGLE_APPLICATION_CREDENTIALS
  Затем снова: pnpm run paper:start"
fi

# Читает одну строку KEY=value из .env (без source — безопаснее для спецсимволов).
val() {
  grep -E "^${1}=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '\r' || true
}

LIVE="$(val LIVE_TRADING_ENABLED)"
MODE="$(val ENGINE_TRADING_MODE)"
case "$LIVE" in true|1|TRUE) die "Остановлено: в .env LIVE_TRADING_ENABLED=true. Для paper launcher нужно false." ;; esac
case "$MODE" in live) die "Остановлено: в .env ENGINE_TRADING_MODE=live. Нужно paper." ;; esac

GAC="$(val GOOGLE_APPLICATION_CREDENTIALS)"
PERSIST="$(val ENGINE_PERSISTENCE)"
IID="$(val ENGINE_INSTANCE_ID)"
[[ -z "$IID" ]] && IID="local-paper-1"

if [[ "$PERSIST" == "firestore" ]]; then
  if [[ -z "$GAC" ]]; then
    die "В .env нет GOOGLE_APPLICATION_CREDENTIALS (нужен для Firestore). Укажите полный путь к JSON сервисного аккаунта."
  fi
  if [[ ! -f "$GAC" ]]; then
    die "Файл ключа не найден:
  $GAC
  Проверьте путь в .env (GOOGLE_APPLICATION_CREDENTIALS)."
  fi
fi

export GOOGLE_APPLICATION_CREDENTIALS="$GAC"
export ENGINE_INSTANCE_ID="$IID"

if [[ "$PERSIST" == "firestore" ]]; then
  echo "→ Сброс lease Firestore (можно запускать снова без ожидания)…"
  pnpm run firestore:bootstrap 2>/dev/null || pnpm --filter @pkg/storage run firestore:bootstrap
fi

echo "→ Запуск paper engine (только paper, live выключен)…"
echo ""
cd "$ROOT/apps/engine"
exec node --env-file=../../.env --import tsx src/main.ts
