import { describe, it, expect } from "vitest";
import { ProcessedCandleGuard } from "./candle-guard.js";
import { candleDedupKey } from "./candle.js";

describe("ProcessedCandleGuard", () => {
  it("duplicate rejected", () => {
    const g = new ProcessedCandleGuard();
    const k = candleDedupKey("BTCUSDT", 1700000000000);
    expect(g.tryMarkProcessed(k)).toBe(true);
    expect(g.tryMarkProcessed(k)).toBe(false);
    expect(g.has(k)).toBe(true);
  });
});
