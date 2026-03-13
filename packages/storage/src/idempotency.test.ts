import { describe, it, expect } from "vitest";
import {
  generateClientOrderId,
  executionReportDedupKey,
  operationIdempotencyKey,
} from "./idempotency.js";

describe("idempotency", () => {
  it("generateClientOrderId length and uniqueness", () => {
    const a = generateClientOrderId("engine1");
    const b = generateClientOrderId("engine1");
    expect(a.length).toBeLessThanOrEqual(36);
    expect(a).not.toBe(b);
  });

  it("executionReportDedupKey stable", () => {
    const k1 = executionReportDedupKey({
      orderId: 1,
      lastTradeId: 99,
      clientOrderId: "x",
      status: "FILLED",
    });
    const k2 = executionReportDedupKey({
      orderId: 1,
      lastTradeId: 99,
      clientOrderId: "x",
      status: "FILLED",
    });
    expect(k1).toBe(k2);
    expect(k1.length).toBe(32);
  });

  it("operationIdempotencyKey scope isolation", () => {
    expect(operationIdempotencyKey("place", "a")).not.toBe(operationIdempotencyKey("place", "b"));
    expect(operationIdempotencyKey("place", "a")).toBe(operationIdempotencyKey("place", "a"));
  });
});
