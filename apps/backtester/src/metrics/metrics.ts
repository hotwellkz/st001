/**
 * Метрики бэктеста. CAGR по дням между первой и последней точкой эквити.
 */

import type { TradeRecord, EquityPoint } from "../sim/runner.js";

export interface MonthlyRow {
  month: string;
  pnl: number;
  trades: number;
}

export interface YearRow {
  year: string;
  pnl: number;
  returnPct: number;
  trades: number;
}

export interface SymbolRow {
  symbol: string;
  pnl: number;
  trades: number;
  winRate: number;
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
  avgWin: number;
  avgLoss: number;
  expectancyPerTrade: number;
  byYear: YearRow[];
  bySymbol: SymbolRow[];
  exposureBarsFrac: number;
  longestDrawdownBars: number;
  sharpeFrac: number | null;
  sortinoFrac: number | null;
  bestYear: string | null;
  worstYear: string | null;
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
    const ts = t.fillCloseTimeMs ?? (equityCurve[t.barIndexFill]?.closeTime ?? 0);
    const d = new Date(ts);
    const key = `${String(d.getUTCFullYear())}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const cur = byMonth.get(key) ?? { pnl: 0, trades: 0 };
    cur.pnl += t.pnlQuote ?? 0;
    cur.trades += 1;
    byMonth.set(key, cur);
  }
  const monthly: MonthlyRow[] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, pnl: v.pnl, trades: v.trades }));

  const avgWin = wins.length ? wins.reduce((s, t) => s + (t.pnlQuote ?? 0), 0) / wins.length : 0;
  const avgLoss = losses.length
    ? Math.abs(losses.reduce((s, t) => s + (t.pnlQuote ?? 0), 0)) / losses.length
    : 0;
  const expectancyPerTrade =
    sells.length > 0
      ? sells.reduce((s, t) => s + (t.pnlQuote ?? 0), 0) / sells.length
      : 0;

  const byYearMap = new Map<string, { pnl: number; trades: number }>();
  for (const t of sells) {
    const ts = t.fillCloseTimeMs ?? 0;
    const y = new Date(ts).getUTCFullYear();
    const key = String(y);
    const cur = byYearMap.get(key) ?? { pnl: 0, trades: 0 };
    cur.pnl += t.pnlQuote ?? 0;
    cur.trades += 1;
    byYearMap.set(key, cur);
  }
  const byYear: YearRow[] = [];
  let runningEquity = initialEquity;
  for (const [year, v] of [...byYearMap.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const returnPct = runningEquity > 0 ? (v.pnl / runningEquity) * 100 : 0;
    byYear.push({ year, pnl: v.pnl, returnPct, trades: v.trades });
    runningEquity += v.pnl;
  }

  const bySymbolMap = new Map<string, { pnl: number; wins: number; losses: number }>();
  for (const t of sells) {
    const cur = bySymbolMap.get(t.symbol) ?? { pnl: 0, wins: 0, losses: 0 };
    cur.pnl += t.pnlQuote ?? 0;
    if ((t.pnlQuote ?? 0) > 0) cur.wins += 1;
    else cur.losses += 1;
    bySymbolMap.set(t.symbol, cur);
  }
  const bySymbol: SymbolRow[] = [...bySymbolMap.entries()].map(([symbol, v]) => ({
    symbol,
    pnl: v.pnl,
    trades: v.wins + v.losses,
    winRate: v.wins + v.losses > 0 ? v.wins / (v.wins + v.losses) : 0,
  }));

  let inMarketBars = 0;
  let openCount = 0;
  for (let idx = 0; idx < equityCurve.length; idx++) {
    const buysUpTo = trades.filter((t) => t.side === "BUY" && t.barIndexFill <= idx).length;
    const sellsUpTo = trades.filter((t) => t.side === "SELL" && t.barIndexFill <= idx).length;
    openCount = buysUpTo - sellsUpTo;
    if (openCount > 0) inMarketBars += 1;
  }
  const exposureBarsFrac = equityCurve.length > 0 ? inMarketBars / equityCurve.length : 0;

  let ddStart = 0;
  let longestDdBars = 0;
  peak = initialEquity;
  for (let idx = 0; idx < equityCurve.length; idx++) {
    const p = equityCurve[idx]!;
    if (p.equity > peak) {
      peak = p.equity;
      ddStart = idx;
    }
    const dd = peak > 0 ? (peak - p.equity) / peak : 0;
    if (dd > 0.001) {
      const len = idx - ddStart;
      if (len > longestDdBars) longestDdBars = len;
    }
  }

  const barReturns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    const prev = equityCurve[i - 1]!.equity;
    const curr = equityCurve[i]!.equity;
    if (prev > 0) barReturns.push((curr - prev) / prev);
  }
  const meanRet = barReturns.length ? barReturns.reduce((a, b) => a + b, 0) / barReturns.length : 0;
  const variance =
    barReturns.length > 1
      ? barReturns.reduce((s, r) => s + (r - meanRet) ** 2, 0) / (barReturns.length - 1)
      : 0;
  const std = Math.sqrt(variance);
  const downsideReturns = barReturns.filter((r) => r < 0);
  const downsideVar =
    downsideReturns.length > 1
      ? downsideReturns.reduce((s, r) => s + r ** 2, 0) / downsideReturns.length
      : 0;
  const downsideStd = Math.sqrt(downsideVar);
  const barsPerYear = 365.25 * (24 / 4);
  const sharpeFrac =
    std > 1e-12 && barReturns.length > 0
      ? (meanRet / std) * Math.sqrt(barsPerYear)
      : null;
  const sortinoFrac =
    downsideStd > 1e-12 && barReturns.length > 0
      ? (meanRet / downsideStd) * Math.sqrt(barsPerYear)
      : null;

  const bestYear =
    byYear.length > 0
      ? byYear.reduce((a, b) => (a.returnPct > b.returnPct ? a : b)).year
      : null;
  const worstYear =
    byYear.length > 0
      ? byYear.reduce((a, b) => (a.returnPct < b.returnPct ? a : b)).year
      : null;

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
    avgWin,
    avgLoss,
    expectancyPerTrade,
    byYear,
    bySymbol,
    exposureBarsFrac,
    longestDrawdownBars: longestDdBars,
    sharpeFrac,
    sortinoFrac,
    bestYear,
    worstYear,
  };
}
