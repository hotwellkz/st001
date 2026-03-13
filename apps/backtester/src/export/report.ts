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
      equitySample: metrics.equityCurve.filter((_, i) => i % Math.max(1, Math.floor(metrics.equityCurve.length / 500)) === 0),
    },
    null,
    2
  );
}

export function metricsToCsv(metrics: BacktestMetrics): string {
  const lines = [
    "metric,value",
    `total_return_pct,${metrics.totalReturnFrac * 100}`,
    `cagr_pct,${metrics.cagrFrac !== null ? metrics.cagrFrac * 100 : ""}`,
    `max_drawdown_pct,${metrics.maxDrawdownFrac * 100}`,
    `win_rate,${metrics.winRate}`,
    `profit_factor,${metrics.profitFactor}`,
    `avg_r,${metrics.avgRMultiple}`,
    `num_trades,${metrics.numTrades}`,
    `round_trips,${metrics.numRoundTrips}`,
  ];
  lines.push("", "month,pnl,trades");
  for (const m of metrics.monthly) {
    lines.push(`${m.month},${m.pnl},${m.trades}`);
  }
  return lines.join("\n");
}

export function equityCurveCsv(curve: { closeTime: number; equity: number }[]): string {
  return ["closeTime,equity", ...curve.map((p) => `${p.closeTime},${p.equity}`)].join("\n");
}
