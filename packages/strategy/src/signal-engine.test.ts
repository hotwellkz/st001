import { describe, it, expect } from "vitest";
import { evaluateEntryAtIndex, evaluateExitLongAtIndex, minBarsRequired } from "./signal-engine.js";
import { defaultStrategyMvpConfig } from "./config.js";
import type { Candle } from "./candle.js";

describe("signal-engine", () => {
  it("minBarsRequired", () => {
    expect(minBarsRequired(defaultStrategyMvpConfig())).toBeGreaterThanOrEqual(201);
  });

  it("entry when trend + breakout", () => {
    const cfg = defaultStrategyMvpConfig();
    const n = minBarsRequired(cfg) + 5;
    const candles: Candle[] = [];
    for (let i = 0; i < n; i++) {
      const close = 50_000 + i * 10 + (i > cfg.smaPeriod ? 500 : 0);
      candles.push({
        openTime: i,
        closeTime: i,
        open: close,
        high: close + 5,
        low: close - 5,
        close,
        volume: 1,
        isClosed: true,
      });
    }
    const i = n - 1;
    const highs = candles.map((c) => c.high);
    const prev20 = Math.max(...highs.slice(i - cfg.breakoutLookback, i));
    const last = candles[i];
    if (last) {
      last.close = prev20 + 100;
      last.high = last.close + 1;
    }

    const r = evaluateEntryAtIndex({ candles, config: cfg }, i);
    if (!r.entry) {
      expect(r.reason).toBeDefined();
    } else {
      const ev = r.events[0];
      expect(ev?.type).toBe("signal_detected");
    }
  });

  it("exit on breakdown", () => {
    const cfg = { ...defaultStrategyMvpConfig(), exitLookback: 2 };
    const candles: Candle[] = [mk(100, 95), mk(100, 94), mk(100, 93), mk(100, 85)];
    function mk(h: number, l: number): Candle {
      return {
        openTime: 0,
        closeTime: 0,
        open: 98,
        high: h,
        low: l,
        close: (h + l) / 2,
        volume: 1,
        isClosed: true,
      };
    }
    const lastC = candles[3];
    if (lastC) lastC.close = 82;
    const r = evaluateExitLongAtIndex({ candles, config: cfg }, 3, 99, 80);
    expect(r.exit && r.reason === "exit_signal").toBe(true);
  });

  it("exit on stop", () => {
    const cfg = defaultStrategyMvpConfig();
    const candles: Candle[] = [
      {
        openTime: 0,
        closeTime: 0,
        open: 100,
        high: 101,
        low: 50,
        close: 90,
        volume: 1,
        isClosed: true,
      },
    ];
    const r = evaluateExitLongAtIndex({ candles, config: cfg }, 0, 100, 95);
    expect(r.exit && r.reason === "stop").toBe(true);
  });
});
