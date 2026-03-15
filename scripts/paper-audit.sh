#!/usr/bin/env bash
# Аудит Firestore после прогона paper engine. Использует .env (GAC, ENGINE_INSTANCE_ID).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$ROOT/.env"
[[ -f "$ENV" ]] || { echo "Нет .env"; exit 1; }
val() { grep -E "^${1}=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '\r' || true; }
export GOOGLE_APPLICATION_CREDENTIALS="$(val GOOGLE_APPLICATION_CREDENTIALS)"
export ENGINE_INSTANCE_ID="$(val ENGINE_INSTANCE_ID)"
[[ -z "$ENGINE_INSTANCE_ID" ]] && export ENGINE_INSTANCE_ID="local-paper-1"
cd "$ROOT/packages/storage"
pnpm exec tsx scripts/audit-paper-post-run.ts
