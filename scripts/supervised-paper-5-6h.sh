#!/usr/bin/env bash
# Непрерывный paper 5–6 ч. Live запрещён. После таймера — audit.
#   DURATION_SEC=21600 bash scripts/supervised-paper-5-6h.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV="$ROOT/.env"
DURATION_SEC="${DURATION_SEC:-21600}"

die() { echo "ABORT: $1" >&2; exit 1; }
[[ -f "$ENV" ]] || die "Нет .env"
val() { grep -E "^${1}=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2- | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr -d '\r' || true; }
case "$(val LIVE_TRADING_ENABLED)" in true|1|TRUE) die "LIVE_TRADING_ENABLED must be false" ;; esac
case "$(val ENGINE_TRADING_MODE)" in live) die "ENGINE_TRADING_MODE must be paper" ;; esac
[[ "$(val ENGINE_PERSISTENCE)" == "firestore" ]] || die "ENGINE_PERSISTENCE=firestore"
GAC="$(val GOOGLE_APPLICATION_CREDENTIALS)"
[[ -n "$GAC" && -f "$GAC" ]] || die "GOOGLE_APPLICATION_CREDENTIALS file"

export GOOGLE_APPLICATION_CREDENTIALS="$GAC"
export ENGINE_INSTANCE_ID="$(val ENGINE_INSTANCE_ID)"
[[ -n "$ENGINE_INSTANCE_ID" ]] || export ENGINE_INSTANCE_ID="local-paper-1"
export LOG_LEVEL="${LOG_LEVEL:-info}"

echo "=== Stale engine processes (tsx src/main.ts) — остановите лишние вручную ==="
pgrep -fl "tsx src/main.ts" 2>/dev/null || echo "(none)"
echo "=== Bootstrap ==="
pnpm run paper:bootstrap
mkdir -p "$ROOT/logs"
LOG="$ROOT/logs/paper-supervised-$(date -u +%Y%m%dT%H%M%SZ).log"
echo "=== $LOG | engine ${DURATION_SEC}s ==="
cd "$ROOT/apps/engine"
set +e
node --env-file=../../.env --import tsx src/main.ts 2>&1 | tee "$LOG" &
EP=$!
sleep "$DURATION_SEC"
kill -TERM "$EP" 2>/dev/null
sleep 3
kill -KILL "$EP" 2>/dev/null
wait "$EP" 2>/dev/null
set -e
echo "=== Audit ==="
cd "$ROOT/packages/storage"
pnpm exec tsx scripts/audit-paper-post-run.ts
echo "=== Log: $LOG ==="
