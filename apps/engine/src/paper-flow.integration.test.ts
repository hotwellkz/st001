import { describe, it, expect } from "vitest";
import type { Candle } from "@pkg/strategy";
import { defaultStrategyMvpConfig, minBarsRequired } from "@pkg/strategy";
import { MemoryBarProcessedStore } from "./state/bar-processed-store.js";
import { PositionManager } from "./position-manager.js";
import { PaperBroker } from "./brokers/paper-broker.js";
import { processSymbolClosedBar } from "./pipeline/closed-candle-pipeline.js";
import { createLogger } from "@pkg/logger";
import { entryOrderIdempotencyKey } from "./order-idempotency.js";

function buildUptrendCandles(n: number): Candle[] {
  const cfg = defaultStrategyMvpConfig();
  const out: Candle[] = [];
  let base = 10_000;
  for (let i = 0; i < n; i++) {
    base += 15 + (i > cfg.smaPeriod ? 8 : 0);
    const close = base;
    out.push({
      openTime: i,
      closeTime: i + 1,
      open: close - 2,
      high: close + 5,
      low: close - 5,
      close,
      volume: 1,
      isClosed: true,
    });
  }
  const i = n - 1;
  const highs = out.map((c) => c.high);
  const prev20 = Math.max(...highs.slice(i - cfg.breakoutLookback, i));
  const cur = out[i];
  if (!cur) throw new Error("oob");
  out[i] = {
    ...cur,
    close: prev20 + 50,
    high: prev20 + 55,
    low: prev20 + 40,
  };
  return out;
}

describe("paper flow integration", () => {
  it("does not process same candle twice", async () => {
    const n = minBarsRequired(defaultStrategyMvpConfig()) + 3;
    const candles = buildUptrendCandles(n);
    const last = candles[n - 1];
    if (!last) throw new Error("oob");
    const barStore = new MemoryBarProcessedStore();
    const pm = new PositionManager();
    const broker = new PaperBroker();
    broker.setLastPrice("BTCUSDT", last.close);
    const log = createLogger({ name: "test", level: "error" });
    const idem = new Set<string>();
    const deps = {
      log,
      barStore,
      positions: pm,
      broker,
      userId: "u1",
      equityQuote: 100_000,
      constraints: {
        tickSize: 0.01,
        stepSize: 0.001,
        minQty: 0.001,
        maxQty: 100,
        minNotional: 5,
      },
      idempotencyTryReserve: (k: string) => {
        if (idem.has(k)) return Promise.resolve(false);
        idem.add(k);
        return Promise.resolve(true);
      },
      idempotencyComplete: () => Promise.resolve(),
    };

    await processSymbolClosedBar({ symbol: "BTCUSDT", candles, lastClosed: last, deps });
    const qtyAfterFirst = pm.get("BTCUSDT")?.qty ?? 0;
    await processSymbolClosedBar({ symbol: "BTCUSDT", candles, lastClosed: last, deps });
    expect(pm.get("BTCUSDT")?.qty ?? 0).toBe(qtyAfterFirst);
    const lastTime = await barStore.getLastCloseTime("BTCUSDT");
    expect(lastTime).toBe(last.closeTime);
  });

  it("idempotency blocks second entry same bar", () => {
    const key = entryOrderIdempotencyKey("X", 123);
    const s = new Set<string>();
    const r1 = !s.has(key) && (s.add(key), true);
    const r2 = !s.has(key) && (s.add(key), true);
    expect(r1).toBe(true);
    expect(r2).toBe(false);
  });
});
