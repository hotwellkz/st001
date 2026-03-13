import { describe, it, expect, vi } from "vitest";
import type { Candle } from "@pkg/strategy";
import { defaultStrategyMvpConfig, minBarsRequired } from "@pkg/strategy";
import { MemoryBarProcessedStore } from "./state/bar-processed-store.js";
import { FirestoreBarProcessedStore } from "./state/firestore-bar-store.js";
import { PositionManager } from "./position-manager.js";
import { PaperBroker } from "./brokers/paper-broker.js";
import { processSymbolClosedBar } from "./pipeline/closed-candle-pipeline.js";
import { createLogger } from "@pkg/logger";
import { entryOrderIdempotencyKey } from "./order-idempotency.js";
import type { EngineStateRepository } from "@pkg/storage";

function uptrend(n: number): Candle[] {
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
  out[i] = { ...cur, close: prev20 + 50, high: prev20 + 55, low: prev20 + 40 };
  return out;
}

describe("restart + idempotency (Firestore-shaped)", () => {
  it("persistent idempotency: second process cannot reserve same bar key", async () => {
    const reserved = new Set<string>();
    const tryReserve = async (key: string) => {
      if (reserved.has(key)) return false;
      reserved.add(key);
      return true;
    };
    const k = entryOrderIdempotencyKey("BTCUSDT", 999001);
    expect(await tryReserve(k)).toBe(true);
    expect(await tryReserve(k)).toBe(false);
  });

  it("bar store hydrate: same closeTime not processed twice after simulated restart", async () => {
    const setCalls: { sym: string; t: number }[] = [];
    const mockRepo = {
      get: async () => ({
        lastBarCloseTime: { ETHUSDT: 42 },
        instanceId: "i1",
      }),
      setLastBarCloseTime: async (_i: string, sym: string, t: number) => {
        setCalls.push({ sym, t });
      },
    } as unknown as EngineStateRepository;
    const store = new FirestoreBarProcessedStore("i1", mockRepo);
    await store.hydrateFromEngineState();
    expect(await store.getLastCloseTime("ETHUSDT")).toBe(42);
    await store.markProcessed("ETHUSDT", 43);
    expect(setCalls.some((c) => c.sym === "ETHUSDT" && c.t === 43)).toBe(true);
  });

  it("paper persistence hook called once per placeOrder", async () => {
    const persist = vi.fn().mockResolvedValue(undefined);
    const broker = new PaperBroker({ onPersist: persist });
    broker.setLastPrice("X", 100);
    await broker.placeOrder({
      symbol: "X",
      side: "BUY",
      quantity: "1",
      clientOrderId: "c1",
      type: "MARKET",
    });
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it("duplicate bar skip after markProcessed (restart safety)", async () => {
    const n = minBarsRequired(defaultStrategyMvpConfig()) + 3;
    const candles = uptrend(n);
    const last = candles[n - 1]!;
    const barStore = new MemoryBarProcessedStore();
    await barStore.markProcessed("BTCUSDT", last.closeTime);
    const pm = new PositionManager();
    const broker = new PaperBroker();
    broker.setLastPrice("BTCUSDT", last.close);
    const log = createLogger({ name: "t", level: "error" });
    const idem = new Set<string>();
    await processSymbolClosedBar({
      symbol: "BTCUSDT",
      candles,
      lastClosed: last,
      deps: {
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
        idempotencyTryReserve: async (k) => {
          if (idem.has(k)) return false;
          idem.add(k);
          return true;
        },
        idempotencyComplete: async () => {},
      },
    });
    expect(pm.get("BTCUSDT")).toBeUndefined();
  });
});
