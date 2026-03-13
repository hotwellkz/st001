import type { BacktestMetrics } from "../metrics/metrics.js";
import type { BacktestResult } from "../sim/runner.js";

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
        monthly: metrics.monthly,
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
