import { describe, it, expect } from "vitest";
import { entryFillPrice, exitFillPrice, feeOnNotional } from "./sim/execution.js";

describe("execution model", () => {
  it("buy worse than open", () => {
    expect(entryFillPrice(100, 0.01, 0.01)).toBeGreaterThanOrEqual(100);
  });
  it("sell worse than open", () => {
    expect(exitFillPrice(100, 0.01, 0.01)).toBeLessThanOrEqual(100);
  });
  it("fee", () => {
    expect(feeOnNotional(1000, 0.001)).toBe(1);
  });
});
