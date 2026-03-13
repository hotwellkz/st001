import { describe, it, expect } from "vitest";
import { computeMetrics } from "./metrics.js";
import type { TradeRecord, EquityPoint } from "../sim/runner.js";

describe("computeMetrics", () => {
  it("total return and max dd", () => {
    const curve: EquityPoint[] = [
      { barIndex: 0, closeTime: 0, equity: 100 },
      { barIndex: 1, closeTime: 1, equity: 110 },
      { barIndex: 2, closeTime: 2, equity: 90 },
      { barIndex: 3, closeTime: 3, equity: 100 },
    ];
    const trades: TradeRecord[] = [
      {
        symbol: "X",
        side: "SELL",
        barIndexSignal: 1,
        barIndexFill: 2,
        fillPrice: 1,
        qty: 1,
        fee: 0,
        pnlQuote: 10,
        rMultiple: 1,
      },
      {
        symbol: "X",
        side: "SELL",
        barIndexSignal: 2,
        barIndexFill: 3,
        fillPrice: 1,
        qty: 1,
        fee: 0,
        pnlQuote: -5,
        rMultiple: -0.5,
      },
    ];
    const m = computeMetrics(100, curve, trades);
    expect(m.totalReturnFrac).toBe(0);
    expect(m.maxDrawdownFrac).toBeGreaterThan(0);
    expect(m.numRoundTrips).toBe(2);
    expect(m.winRate).toBe(0.5);
  });
});
