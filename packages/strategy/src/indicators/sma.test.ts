import { describe, it, expect } from "vitest";
import { smaAt, smaSeries } from "./sma.js";

describe("SMA", () => {
  it("smaAt period 3", () => {
    const c = [1, 2, 3, 4, 5];
    expect(smaAt(c, 2, 3)).toBe(2);
    expect(smaAt(c, 4, 3)).toBe(4);
    expect(smaAt(c, 0, 3)).toBeNull();
  });

  it("smaSeries", () => {
    const c = [10, 20, 30];
    const s = smaSeries(c, 2);
    expect(s[0]).toBeNull();
    expect(s[1]).toBe(15);
    expect(s[2]).toBe(25);
  });
});
