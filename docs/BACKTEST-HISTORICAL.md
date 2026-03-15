# Historical backtest workflow

## Commands (from repo root)

| Command | Description |
|--------|-------------|
| `pnpm run backtest:fetch` | Fetch 5 years of BTCUSDT + ETHUSDT 4h from Binance into `backtest-data/` (relative to apps/backtester). |
| `pnpm run backtest:run` | Run full backtest on data in `backtest-data/`, write to `backtest-out/`. |
| `pnpm run backtest:oos` | Same data, 70% in-sample / 30% out-of-sample; writes `oos-comparison.json` and `oos-report.md`. |
| `pnpm run backtest:walkforward` | Walk-forward windows; writes `walkforward-summary.json`. |
| `pnpm run backtest:robustness` | Runs fee/slippage robustness matrix (baseline + 4 pessimistic); see `docs/BACKTEST-ROBUSTNESS-STAGE2.md`. |
| `pnpm run backtest:synthetic` | Run on 800 synthetic bars only (no fetch); writes to `backtest-out/`. |

Custom options (run from `apps/backtester` or adjust paths):

- `--data-dir <dir>` — data directory (default `backtest-data`).
- `--out <dir>` — output directory (default `backtest-out`).
- `--symbols BTCUSDT,ETHUSDT` — symbols for fetch or run.
- `--years 5` — years of history for fetch (default 5).
- `--oos 0.3` — out-of-sample fraction (default 0.3 for 70/30).
- `--fee-bps N` — taker fee in basis points (default 10). Example: 15, 20.
- `--slippage-bps N` — slippage per side in bps (default 5). Example: 10, 20, 50.
- `--fetch` — only fetch, do not run.
- `--synthetic` — use synthetic data, ignore data-dir.

## Data pipeline

- **Fetch:** Binance REST `/api/v3/klines`, interval `4h`, limit 1000 per request. Chunks by `startTime`/`endTime` until range covered. Saves per-symbol JSON under `dataDir` and `meta.json`.
- **Align:** Bars are aligned by `closeTime` intersection across symbols so that `bars[sym][i]` shares the same close time for all symbols.
- **No lookahead:** Signal on bar `i` uses only `candles[0..i]`; fill is on bar `i+1` open with configurable slippage and fees.

## Execution assumptions

- Entry/exit at **next bar open** (no intrabar high/low).
- Slippage: configurable buy/sell fraction (default 0.05%).
- Fees: single taker rate (default 0.1%).
- One position per symbol; strategy heat and max positions from `StrategyMvpConfig`.

## Output artifacts

- `backtest-out/summary.json` — full metrics + trade list + equity sample.
- `backtest-out/trades.csv` — one row per trade (symbol, side, fill price, qty, fee, pnlQuote, exitReason, etc.).
- `backtest-out/equity.csv` — closeTime, equity.
- `backtest-out/by-year.csv` — year, pnl, returnPct, trades.
- `backtest-out/by-symbol.csv` — symbol, pnl, trades, winRate.
- `backtest-out/report.md` — human-readable summary.
- `backtest-out/oos-comparison.json` + `oos-report.md` when using `--oos`.
- `backtest-out/walkforward-summary.json` when using `--walkforward`.

## Binance limits

- 1000 klines per request. For 4h, 5 years ≈ 22k bars → ~22 requests per symbol.
- Data is written under `apps/backtester/backtest-data/` when using default `--data-dir` from root scripts.

## Sensitivity

- Use `--fee-bps` and `--slippage-bps` for robustness checks (see `docs/BACKTEST-ROBUSTNESS-REPORT.md`).
- Strategy params (e.g. `atrStopMult`, `breakoutLookback`) live in `@pkg/strategy`; use the same config as runtime for an honest comparison.
