#!/usr/bin/env bash
# Paper only. Sleep until 10 min before UTC 4H close, run engine until 15 min after, audit.
#   CLOSE_ISO="2026-03-14T12:00:00Z" bash scripts/run-4h-close-validation.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV="$ROOT/.env"
[[ -f "$ENV" ]] || { echo "Need .env"; exit 1; }
case "$(grep -E '^LIVE_TRADING_ENABLED=' "$ENV" | cut -d= -f2 | tr -d '\r')" in true|1|TRUE) echo "LIVE on — abort"; exit 1;; esac
case "$(grep -E '^ENGINE_TRADING_MODE=' "$ENV" | cut -d= -f2 | tr -d '\r')" in live) echo "MODE live — abort"; exit 1;; esac

CLOSE_ISO="${CLOSE_ISO:?Example: CLOSE_ISO=2026-03-14T12:00:00Z}"
# macOS: date -j -f ; Linux: date -d
if date -j -f "%Y-%m-%dT%H:%M:%SZ" "$CLOSE_ISO" "+%s" >/dev/null 2>&1; then
  CLOSE_SEC=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$CLOSE_ISO" "+%s")
else
  CLOSE_SEC=$(date -u -d "$CLOSE_ISO" "+%s")
fi
START_SEC=$(( CLOSE_SEC - 600 ))
END_SEC=$(( CLOSE_SEC + 900 ))
NOW=$(date +%s)
echo "Close UTC: $CLOSE_ISO | Engine T-10min .. T+15min"
if (( NOW < START_SEC )); then
  echo "Sleep $(( START_SEC - NOW ))s ..."
  sleep "$(( START_SEC - NOW ))"
fi
export LOG_LEVEL="${LOG_LEVEL:-info}"
export GOOGLE_APPLICATION_CREDENTIALS="$(grep -E '^GOOGLE_APPLICATION_CREDENTIALS=' "$ENV" | cut -d= -f2- | tr -d '\r')"
export ENGINE_INSTANCE_ID="$(grep -E '^ENGINE_INSTANCE_ID=' "$ENV" | cut -d= -f2- | tr -d '\r' | head -1)"
pnpm run paper:bootstrap
cd "$ROOT/apps/engine"
node --env-file=../../.env --import tsx src/main.ts 2>&1 | tee /tmp/paper-4h-close-validation.log &
EP=$!
while (( $(date +%s) < END_SEC )); do sleep 10; done
kill $EP 2>/dev/null || true
wait $EP 2>/dev/null || true
cd "$ROOT/packages/storage"
export GOOGLE_APPLICATION_CREDENTIALS ENGINE_INSTANCE_ID
pnpm exec tsx scripts/audit-paper-post-run.ts
echo "Log: /tmp/paper-4h-close-validation.log"
