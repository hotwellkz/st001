import { describe, it, expect } from "vitest";
import { trueRange, atrSeries, atrAt } from "./atr.js";

describe("ATR", () => {
  it("trueRange", () => {
    expect(trueRange(10, 5, 8)).toBe(5);
    expect(trueRange(10, 8, 5)).toBe(5);
  });

  it("atrSeries first value at period", () => {
    const n = 25;
    const highs = Array.from({ length: n }, () => 100);
    const lows = Array.from({ length: n }, () => 99);
    const closes = Array.from({ length: n }, (_, i) => 99.5 + i * 0.01);
    const a = atrSeries(highs, lows, closes, 20);
    expect(a[19]).toBeNull();
    expect(a[20]).not.toBeNull();
    expect((a[20] ?? 0) > 0).toBe(true);
  });

  it("atrAt matches series", () => {
    const h = [10, 11, 12, 11, 10];
    const l = [9, 10, 11, 10, 9];
    const c = [9.5, 10.5, 11.5, 10.5, 9.5];
    const s = atrSeries(h, l, c, 3);
    expect(atrAt(h, l, c, 4, 3)).toBe(s[4]);
  });
});
