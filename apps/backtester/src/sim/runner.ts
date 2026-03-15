/**
 * Прогон без lookahead: на баре i решение; исполнение на open бара i+1.
 */

import type { Candle } from "@pkg/strategy";
import {
  defaultStrategyMvpConfig,
  minBarsRequired,
  evaluateEntryAtIndex,
  evaluateExitLongAtIndex,
  validateEntryRisk,
  canOpenNewPosition,
  type StrategyMvpConfig,
} from "@pkg/strategy";
import type { SimulationConfig } from "../sim-config.js";
import { PortfolioSimulator } from "./portfolio.js";
import { entryFillPrice, exitFillPrice, qtyFromRisk } from "./execution.js";

export interface TradeRecord {
  symbol: string;
  side: "BUY" | "SELL";
  barIndexSignal: number;
  barIndexFill: number;
  fillPrice: number;
  qty: number;
  fee: number;
  pnlQuote?: number;
  rMultiple?: number;
  /** Close time (ms) of the bar on which fill occurred (for by-year / exposure). */
  fillCloseTimeMs?: number;
  /** Exit reason for SELL: stop_loss | exit_signal */
  exitReason?: string;
  /** Entry cost (quote) for SELL round-trip pnl% */
  entryNotional?: number;
}

export interface EquityPoint {
  barIndex: number;
  closeTime: number;
  equity: number;
}

export interface BacktestResult {
  trades: TradeRecord[];
  equityCurve: EquityPoint[];
  finalCash: number;
  config: StrategyMvpConfig;
  sim: SimulationConfig;
}

export function runAlignedBacktest(params: {
  symbols: string[];
  bars: Record<string, readonly Candle[]>;
  closeTimes: readonly number[];
  strategyConfig?: StrategyMvpConfig;
  simConfig: SimulationConfig;
}): BacktestResult {
  const cfg = params.strategyConfig ?? defaultStrategyMvpConfig();
  const sim = params.simConfig;
  const n = params.closeTimes.length;
  const minB = minBarsRequired(cfg);
  const portfolio = new PortfolioSimulator(sim.initialCashQuote);
  const trades: TradeRecord[] = [];
  const equityCurve: EquityPoint[] = [];

  for (let i = minB; i < n - 1; i++) {
    const marks: Record<string, number> = {};
    for (const sym of params.symbols) {
      const c = params.bars[sym]?.[i];
      if (c) marks[sym] = c.close;
    }

    for (const sym of params.symbols) {
      const series = params.bars[sym];
      if (!series || series.length !== n) continue;
      const candles: Candle[] = Array.from(series.slice(0, i + 1));
      const next = series[i + 1];
      if (!next) continue;

      const pos = portfolio.positions.get(sym);
      if (pos && pos.qty > 0) {
        const ex = evaluateExitLongAtIndex(
          { candles, config: cfg },
          i,
          pos.avgEntry,
          pos.stopPrice
        );
        if (ex.exit) {
          const px = exitFillPrice(next.open, sim.slippageSellFrac, sim.tickSize);
          const entryFee = pos.avgEntry * pos.qty * sim.feeRateTaker;
          const exitFee = px * pos.qty * sim.feeRateTaker;
          const gross = (px - pos.avgEntry) * pos.qty;
          const pnlQuote = gross - entryFee - exitFee;
          const r =
            pos.avgEntry > pos.stopPrice
              ? (px - pos.avgEntry) / (pos.avgEntry - pos.stopPrice)
              : 0;
          portfolio.closeLong(sym, pos.qty, px, sim.feeRateTaker);
          trades.push({
            symbol: sym,
            side: "SELL",
            barIndexSignal: i,
            barIndexFill: i + 1,
            fillPrice: px,
            qty: pos.qty,
            fee: exitFee,
            pnlQuote,
            rMultiple: r,
            fillCloseTimeMs: next.closeTime,
            exitReason: ex.reason === "stop" ? "stop_loss" : "exit_signal",
            entryNotional: pos.avgEntry * pos.qty,
          });
        }
        continue;
      }

      const entry = evaluateEntryAtIndex({ candles, config: cfg }, i);
      if (!entry.entry) continue;

      const ev = entry.events[0];
      if (!ev || ev.type !== "signal_detected") continue;
      const stopPrice = ev.stopPrice;
      const barI = candles[i];
      const atr = barI ? (barI.close - stopPrice) / cfg.atrStopMult : 0;
      const eq = portfolio.equity(marks);
      const heatOk = canOpenNewPosition(portfolio.openPositionsRisk(), cfg);
      if (!heatOk.ok) continue;

      const fillPx = entryFillPrice(next.open, sim.slippageBuyFrac, sim.tickSize);
      const riskVal = validateEntryRisk({
        config: cfg,
        eligibility: { symbol: sym, isLiquid: true, inUniverse: true },
        positions: portfolio.openPositionsRisk(),
        equityQuote: eq,
        entryPrice: fillPx,
        atr: atr > 0 ? atr : 1,
        constraints: {
          tickSize: sim.tickSize,
          stepSize: sim.stepSize,
          minQty: sim.minQty,
          maxQty: sim.maxQty,
          minNotional: sim.minNotional,
        },
      });
      if (!riskVal.ok) continue;

      const qty = qtyFromRisk(
        eq,
        cfg.riskPerTradeFrac,
        fillPx,
        riskVal.stopPrice,
        sim.stepSize,
        sim.minQty,
        sim.maxQty,
        sim.minNotional
      );
      if (qty <= 0) continue;

      const notional = qty * fillPx;
      if (notional > portfolio.cash * 0.999) continue;

      portfolio.openLong(
        sym,
        qty,
        fillPx,
        sim.feeRateTaker,
        riskVal.stopPrice,
        cfg.riskPerTradeFrac,
        i + 1
      );
      trades.push({
        symbol: sym,
        side: "BUY",
        barIndexSignal: i,
        barIndexFill: i + 1,
        fillPrice: fillPx,
        qty,
        fee: notional * sim.feeRateTaker,
        fillCloseTimeMs: next.closeTime,
      });
    }

    const eqEnd = portfolio.equity(marks);
    equityCurve.push({
      barIndex: i,
      closeTime: params.closeTimes[i] ?? 0,
      equity: eqEnd,
    });
  }

  const lastMarks: Record<string, number> = {};
  for (const sym of params.symbols) {
    const last = params.bars[sym]?.[n - 1];
    if (last) lastMarks[sym] = last.close;
  }
  equityCurve.push({
    barIndex: n - 1,
    closeTime: params.closeTimes[n - 1] ?? 0,
    equity: portfolio.equity(lastMarks),
  });

  return {
    trades,
    equityCurve,
    finalCash: portfolio.cash,
    config: cfg,
    sim,
  };
}
