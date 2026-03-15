import type { BacktestMetrics } from "../metrics/metrics.js";
import type { BacktestResult, TradeRecord } from "../sim/runner.js";

export function metricsToJson(metrics: BacktestMetrics, result: BacktestResult): string {
  return JSON.stringify(
    {
      metrics: {
        totalReturnPct: metrics.totalReturnFrac * 100,
        cagrPct: metrics.cagrFrac !== null ? metrics.cagrFrac * 100 : null,
        maxDrawdownPct: metrics.maxDrawdownFrac * 100,
        winRate: metrics.winRate,
        profitFactor: metrics.profitFactor,
        avgRMultiple: metrics.avgRMultiple,
        numTrades: metrics.numTrades,
        numRoundTrips: metrics.numRoundTrips,
        avgWin: metrics.avgWin,
        avgLoss: metrics.avgLoss,
        expectancyPerTrade: metrics.expectancyPerTrade,
        exposureBarsFrac: metrics.exposureBarsFrac,
        longestDrawdownBars: metrics.longestDrawdownBars,
        sharpeFrac: metrics.sharpeFrac,
        sortinoFrac: metrics.sortinoFrac,
        bestYear: metrics.bestYear,
        worstYear: metrics.worstYear,
        monthly: metrics.monthly,
        byYear: metrics.byYear,
        bySymbol: metrics.bySymbol,
      },
      trades: result.trades,
      equitySample: metrics.equityCurve.filter(
        (_, i) => i % Math.max(1, Math.floor(metrics.equityCurve.length / 500)) === 0
      ),
    },
    null,
    2
  );
}

export function tradesToCsv(trades: TradeRecord[]): string {
  const header =
    "symbol,side,barIndexSignal,barIndexFill,fillPrice,qty,fee,pnlQuote,rMultiple,fillCloseTimeMs,exitReason,entryNotional";
  const rows = trades.map((t) =>
    [
      t.symbol,
      t.side,
      t.barIndexSignal,
      t.barIndexFill,
      t.fillPrice,
      t.qty,
      t.fee,
      t.pnlQuote ?? "",
      t.rMultiple ?? "",
      t.fillCloseTimeMs ?? "",
      t.exitReason ?? "",
      t.entryNotional ?? "",
    ].join(",")
  );
  return [header, ...rows].join("\n");
}

export function byYearCsv(byYear: BacktestMetrics["byYear"]): string {
  return ["year,pnl,returnPct,trades", ...byYear.map((r) => `${r.year},${r.pnl},${r.returnPct},${r.trades}`)].join(
    "\n"
  );
}

export function bySymbolCsv(bySymbol: BacktestMetrics["bySymbol"]): string {
  return [
    "symbol,pnl,trades,winRate",
    ...bySymbol.map((r) => `${r.symbol},${r.pnl},${r.trades},${r.winRate}`),
  ].join("\n");
}

export function reportMd(metrics: BacktestMetrics, result: BacktestResult): string {
  const lines: string[] = [
    "# Backtest Report",
    "",
    "## Summary",
    `- **Total return**: ${(metrics.totalReturnFrac * 100).toFixed(2)}%`,
    `- **CAGR**: ${metrics.cagrFrac != null ? (metrics.cagrFrac * 100).toFixed(2) : "n/a"}%`,
    `- **Max drawdown**: ${(metrics.maxDrawdownFrac * 100).toFixed(2)}%`,
    `- **Trades (round trips)**: ${metrics.numRoundTrips}`,
    `- **Win rate**: ${(metrics.winRate * 100).toFixed(1)}%`,
    `- **Profit factor**: ${metrics.profitFactor.toFixed(2)}`,
    `- **Avg win**: ${metrics.avgWin.toFixed(2)} | **Avg loss**: ${metrics.avgLoss.toFixed(2)}`,
    `- **Expectancy per trade**: ${metrics.expectancyPerTrade.toFixed(2)}`,
    `- **Exposure (bars in market)**: ${(metrics.exposureBarsFrac * 100).toFixed(1)}%`,
    `- **Longest drawdown (bars)**: ${metrics.longestDrawdownBars}`,
    `- **Sharpe (ann.)**: ${metrics.sharpeFrac != null ? metrics.sharpeFrac.toFixed(2) : "n/a"}`,
    `- **Sortino (ann.)**: ${metrics.sortinoFrac != null ? metrics.sortinoFrac.toFixed(2) : "n/a"}`,
    `- **Best year**: ${metrics.bestYear ?? "n/a"} | **Worst year**: ${metrics.worstYear ?? "n/a"}`,
    "",
    "## By year",
    "| Year | PnL | Return % | Trades |",
    "|------|-----|----------|--------|",
    ...metrics.byYear.map((r) => `| ${r.year} | ${r.pnl.toFixed(2)} | ${r.returnPct.toFixed(2)} | ${r.trades} |`),
    "",
    "## By symbol",
    "| Symbol | PnL | Trades | Win rate |",
    "|--------|-----|--------|----------|",
    ...metrics.bySymbol.map((r) => `| ${r.symbol} | ${r.pnl.toFixed(2)} | ${r.trades} | ${(r.winRate * 100).toFixed(1)}% |`),
  ];
  return lines.join("\n");
}

export function metricsToCsv(metrics: BacktestMetrics): string {
  const cagr = metrics.cagrFrac !== null ? String(metrics.cagrFrac * 100) : "";
  const lines = [
    "metric,value",
    `total_return_pct,${String(metrics.totalReturnFrac * 100)}`,
    `cagr_pct,${cagr}`,
    `max_drawdown_pct,${String(metrics.maxDrawdownFrac * 100)}`,
    `win_rate,${String(metrics.winRate)}`,
    `profit_factor,${String(metrics.profitFactor)}`,
    `avg_r,${String(metrics.avgRMultiple)}`,
    `num_trades,${String(metrics.numTrades)}`,
    `round_trips,${String(metrics.numRoundTrips)}`,
  ];
  lines.push("", "month,pnl,trades");
  for (const m of metrics.monthly) {
    lines.push(`${m.month},${String(m.pnl)},${String(m.trades)}`);
  }
  return lines.join("\n");
}

export function equityCurveCsv(curve: { closeTime: number; equity: number }[]): string {
  return ["closeTime,equity", ...curve.map((p) => `${String(p.closeTime)},${String(p.equity)}`)].join(
    "\n"
  );
}
