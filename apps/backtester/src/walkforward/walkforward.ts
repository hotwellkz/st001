/**
 * Walk-forward: окна [trainStart, trainEnd), [testStart, testEnd) по индексам баров.
 * Без подгонки параметров в коде — только нарезка данных для out-of-sample прогонов.
 */

import type { Candle } from "@pkg/strategy";
import type { SimulationConfig } from "../sim-config.js";
import { runAlignedBacktest, type BacktestResult } from "../sim/runner.js";
import { computeMetrics, type BacktestMetrics } from "../metrics/metrics.js";

export interface WalkForwardWindow {
  trainStart: number;
  trainEnd: number;
  testStart: number;
  testEnd: number;
}

export function generateWindows(params: {
  totalBars: number;
  trainBars: number;
  testBars: number;
  stepBars: number;
}): WalkForwardWindow[] {
  const out: WalkForwardWindow[] = [];
  let testStart = params.trainBars;
  while (testStart + params.testBars <= params.totalBars) {
    out.push({
      trainStart: testStart - params.trainBars,
      trainEnd: testStart,
      testStart,
      testEnd: testStart + params.testBars,
    });
    testStart += params.stepBars;
  }
  return out;
}

export function sliceAlignedBars(
  bars: Record<string, readonly Candle[]>,
  symbols: string[],
  start: number,
  end: number
): {
  bars: Record<string, readonly Candle[]>;
  closeTimes: number[];
} {
  const closeTimes = bars[symbols[0] ?? ""]?.slice(start, end).map((c) => c.closeTime) ?? [];
  const sliced: Record<string, readonly Candle[]> = {};
  for (const sym of symbols) {
    sliced[sym] = bars[sym]?.slice(start, end) ?? [];
  }
  return { bars: sliced, closeTimes };
}

export function runWalkForward(params: {
  symbols: string[];
  bars: Record<string, readonly Candle[]>;
  windows: WalkForwardWindow[];
  simConfig: SimulationConfig;
  initialCash: number;
}): { window: WalkForwardWindow; result: BacktestResult; metrics: BacktestMetrics }[] {
  const results: {
    window: WalkForwardWindow;
    result: BacktestResult;
    metrics: BacktestMetrics;
  }[] = [];
  for (const w of params.windows) {
    const { bars, closeTimes } = sliceAlignedBars(
      params.bars,
      params.symbols,
      w.testStart,
      w.testEnd
    );
    if (closeTimes.length < 10) continue;
    const result = runAlignedBacktest({
      symbols: params.symbols,
      bars,
      closeTimes,
      simConfig: { ...params.simConfig, initialCashQuote: params.initialCash },
    });
    const metrics = computeMetrics(
      params.initialCash,
      result.equityCurve,
      result.trades
    );
    results.push({ window: w, result, metrics });
  }
  return results;
}
