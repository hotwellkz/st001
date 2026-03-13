import { describe, it, expect } from "vitest";
import {
  previousNBarHigh,
  previousNBarLow,
  isBreakoutAbove,
  isBreakdownBelow,
} from "./breakout.js";

describe("breakout", () => {
  it("previousNBarHigh excludes current", () => {
    const highs = [1, 5, 3, 2, 10];
    expect(previousNBarHigh(highs, 4, 3)).toBe(5);
  });

  it("previousNBarLow", () => {
    const lows = [9, 5, 6, 7, 1];
    expect(previousNBarLow(lows, 4, 3)).toBe(5);
  });

  it("isBreakoutAbove", () => {
    expect(isBreakoutAbove(101, 100)).toBe(true);
    expect(isBreakoutAbove(100, 100)).toBe(false);
  });

  it("isBreakdownBelow", () => {
    expect(isBreakdownBelow(99, 100)).toBe(true);
    expect(isBreakdownBelow(100, 100)).toBe(false);
  });
});
