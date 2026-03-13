import { describe, it, expect } from "vitest";
import { computeLongStopPrice, sizeLongPosition } from "./sizing.js";
import { defaultStrategyMvpConfig } from "./config.js";

describe("sizing & stop", () => {
  it("computeLongStopPrice", () => {
    expect(computeLongStopPrice(100, 2, 2, 0.01)).toBe(96);
  });

  it("sizeLongPosition", () => {
    const config = defaultStrategyMvpConfig();
    const r = sizeLongPosition({
      equityQuote: 10_000,
      entryPrice: 100,
      stopPrice: 96,
      config,
      stepSize: 0.001,
      minQty: 0.001,
      maxQty: 100,
      minNotional: 5,
    });
    expect(r.qty).toBeGreaterThan(0);
    expect(r.riskQuote).toBe(50);
    const dist = 4;
    expect(r.qty).toBeCloseTo(50 / dist, 2);
  });

  it("skip below min qty", () => {
    const config = defaultStrategyMvpConfig();
    const r = sizeLongPosition({
      equityQuote: 100,
      entryPrice: 100,
      stopPrice: 99.9,
      config,
      stepSize: 1,
      minQty: 10,
      maxQty: 1000,
      minNotional: 5,
    });
    expect(r.skippedReason).toBeDefined();
  });
});
