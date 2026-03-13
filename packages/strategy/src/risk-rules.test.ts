import { describe, it, expect } from "vitest";
import { validateEntryRisk } from "./risk-rules.js";
import { defaultStrategyMvpConfig } from "./config.js";

describe("validateEntryRisk", () => {
  it("ok path", () => {
    const config = defaultStrategyMvpConfig();
    const r = validateEntryRisk({
      config,
      eligibility: { symbol: "BTCUSDT", isLiquid: true, inUniverse: true },
      positions: [],
      equityQuote: 100_000,
      entryPrice: 100,
      atr: 1,
      constraints: {
        tickSize: 0.01,
        stepSize: 0.001,
        minQty: 0.001,
        maxQty: 1000,
        minNotional: 5,
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.stopPrice).toBe(98);
      expect(r.qty).toBeGreaterThan(0);
    }
  });

  it("not eligible", () => {
    const config = defaultStrategyMvpConfig();
    const r = validateEntryRisk({
      config,
      eligibility: { symbol: "X", isLiquid: false, inUniverse: true },
      positions: [],
      equityQuote: 100_000,
      entryPrice: 100,
      atr: 1,
      constraints: {
        tickSize: 0.01,
        stepSize: 0.001,
        minQty: 0.001,
        maxQty: 1000,
        minNotional: 5,
      },
    });
    expect(r.ok).toBe(false);
  });
});
