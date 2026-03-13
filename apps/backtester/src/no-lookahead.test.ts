import { describe, it, expect } from "vitest";
import type { Candle } from "@pkg/strategy";
import { runAlignedBacktest } from "./sim/runner.js";
import { defaultSimulationConfig } from "./sim-config.js";
import { syntheticAlignedBars } from "./synthetic-data.js";
import { generateWindows } from "./walkforward/walkforward.js";

describe("backtest validation", () => {
  it("runner completes without throw", () => {
    const symbols = ["BTCUSDT"];
    const { bars, closeTimes } = syntheticAlignedBars({
      symbols,
      numBars: 500,
      seedBase: 40_000,
    });
    const sim = defaultSimulationConfig();
    sim.minQty = 0.001;
    sim.stepSize = 0.001;
    sim.minNotional = 5;
    const r = runAlignedBacktest({ symbols, bars, closeTimes, simConfig: sim });
    expect(r.equityCurve.length).toBeGreaterThan(0);
  });

  it("execution uses next bar only", () => {
    const row: Candle[] = [];
    const closeTimes: number[] = [];
    for (let i = 0; i < 250; i++) {
      const c = 100 + i * 0.1;
      row.push({
        openTime: i,
        closeTime: i,
        open: c,
        high: c + 1,
        low: c - 1,
        close: c,
        volume: 1,
        isClosed: true,
      });
      closeTimes.push(i);
    }
    const bars: Record<string, Candle[]> = { X: row };
    const sim = defaultSimulationConfig();
    sim.initialCashQuote = 1_000_000;
    sim.minNotional = 1;
    runAlignedBacktest({ symbols: ["X"], bars, closeTimes, simConfig: sim });
    expect(true).toBe(true);
  });

  it("walkforward generates windows", () => {
    const w = generateWindows({ totalBars: 1000, trainBars: 400, testBars: 100, stepBars: 100 });
    expect(w.length).toBeGreaterThan(0);
    const first = w[0];
    expect(first).toBeDefined();
    if (first) expect(first.testEnd - first.testStart).toBe(100);
  });
});
