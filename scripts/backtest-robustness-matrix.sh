#!/usr/bin/env bash
# Запуск матрицы робастности: baseline + пессимистичные fee/slippage.
# Из корня репо: bash scripts/backtest-robustness-matrix.sh
# Требует: backtest-data уже загружен (pnpm run backtest:fetch).

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_BASE="${1:-backtest-out}"
cd "$ROOT"

run() {
  pnpm --filter @app/backtester exec node --import tsx src/cli.ts \
    --data-dir backtest-data --out "$1" "${@:2}" 2>&1 | grep -E "Return %|MaxDD|Trades:|Sharpe" || true
}

echo "=== Baseline (10 bps fee, 5 bps slip) ==="
run "$OUT_BASE"

echo "=== fee 15 bps + slip 10 bps ==="
run "$OUT_BASE/r2-fee15-slip10" --fee-bps 15 --slippage-bps 10

echo "=== fee 20 bps + slip 20 bps ==="
run "$OUT_BASE/r2-fee20-slip20" --fee-bps 20 --slippage-bps 20

echo "=== fee 25 bps + slip 25 bps ==="
run "$OUT_BASE/r2-fee25-slip25" --fee-bps 25 --slippage-bps 25

echo "=== fee 30 bps + slip 30 bps (strict) ==="
run "$OUT_BASE/r2-fee30-slip30" --fee-bps 30 --slippage-bps 30

echo "Done. See docs/BACKTEST-ROBUSTNESS-STAGE2.md for full report."
