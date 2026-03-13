import { describe, it, expect } from "vitest";
import { portfolioHeatFrac, canOpenNewPosition } from "./heat.js";
import { defaultStrategyMvpConfig } from "./config.js";

describe("portfolio heat", () => {
  it("portfolioHeatFrac sums", () => {
    expect(portfolioHeatFrac([{ riskFrac: 0.005 }, { riskFrac: 0.005 }])).toBe(0.01);
  });

  it("max heat blocks", () => {
    const c = defaultStrategyMvpConfig();
    const positions = Array.from({ length: 12 }, () => ({ riskFrac: 0.005 }));
    expect(canOpenNewPosition(positions, c).ok).toBe(false);
  });

  it("max concurrent", () => {
    const c = { ...defaultStrategyMvpConfig(), maxConcurrentPositions: 2 };
    expect(canOpenNewPosition([{ riskFrac: 0.005 }], c).ok).toBe(true);
    expect(canOpenNewPosition([{ riskFrac: 0.005 }, { riskFrac: 0.005 }], c).ok).toBe(false);
  });

  it("heat cap", () => {
    const c = defaultStrategyMvpConfig();
    const almost = [{ riskFrac: 0.056 }];
    expect(canOpenNewPosition(almost, c).ok).toBe(false);
  });
});
