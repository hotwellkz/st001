/**
 * Метрики бэктеста. CAGR по дням между первой и последней точкой эквити.
 */

import type { TradeRecord, EquityPoint } from "../sim/runner.js";

export interface MonthlyRow {
  month: string;
  pnl: number;
  trades: number;
}

export interface BacktestMetrics {
  totalReturnFrac: number;
  cagrFrac: number | null;
  maxDrawdownFrac: number;
  winRate: number;
  profitFactor: number;
  avgRMultiple: number;
  numTrades: number;
  numRoundTrips: number;
  equityCurve: EquityPoint[];
  winLossBins: { wins: number[]; losses: number[] };
  monthly: MonthlyRow[];
}

function daysBetweenMs(a: number, b: number): number {
  return Math.max(1, (b - a) / 86400_000);
}

export function computeMetrics(
  initialEquity: number,
  equityCurve: EquityPoint[],
  trades: TradeRecord[]
): BacktestMetrics {
  const sells = trades.filter((t) => t.side === "SELL" && t.pnlQuote !== undefined);
  const wins = sells.filter((t) => (t.pnlQuote ?? 0) > 0);
  const losses = sells.filter((t) => (t.pnlQuote ?? 0) <= 0);
  const grossWin = wins.reduce((s, t) => s + (t.pnlQuote ?? 0), 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + (t.pnlQuote ?? 0), 0));
  const winRate = sells.length ? wins.length / sells.length : 0;
  const profitFactor = grossLoss > 1e-8 ? grossWin / grossLoss : grossWin > 0 ? 999 : 0;
  const rs = sells.map((t) => t.rMultiple ?? 0).filter((r) => Number.isFinite(r));
  const avgR = rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : 0;

  let peak = initialEquity;
  let maxDd = 0;
  for (const p of equityCurve) {
    if (p.equity > peak) peak = p.equity;
    const dd = peak > 0 ? (peak - p.equity) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }

  const lastPt = equityCurve.length ? equityCurve[equityCurve.length - 1] : undefined;
  const lastEq = lastPt !== undefined ? lastPt.equity : initialEquity;
  const totalReturnFrac = initialEquity > 0 ? lastEq / initialEquity - 1 : 0;
  const t0 = equityCurve[0]?.closeTime ?? 0;
  const t1 = equityCurve[equityCurve.length - 1]?.closeTime ?? t0;
  const years = daysBetweenMs(t0, t1) / 365.25;
  const cagrFrac =
    years > 0 && initialEquity > 0 && lastEq > 0
      ? Math.pow(lastEq / initialEquity, 1 / years) - 1
      : null;

  const byMonth = new Map<string, { pnl: number; trades: number }>();
  for (const t of sells) {
    const d = new Date(t.barIndexFill);
    const key = `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { pnl: 0, trades: 0 };
    cur.pnl += t.pnlQuote ?? 0;
    cur.trades += 1;
    byMonth.set(key, cur);
  }
  const monthly: MonthlyRow[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, pnl: v.pnl, trades: v.trades }));

  return {
    totalReturnFrac,
    cagrFrac,
    maxDrawdownFrac: maxDd,
    winRate,
    profitFactor,
    avgRMultiple: avgR,
    numTrades: trades.length,
    numRoundTrips: sells.length,
    equityCurve,
    winLossBins: {
      wins: wins.map((t) => t.pnlQuote ?? 0),
      losses: losses.map((t) => t.pnlQuote ?? 0),
    },
    monthly,
  };
}
