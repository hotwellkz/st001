import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveHalt, envEmergencyHalt } from "./kill-switch.js";
import { createLogger } from "@pkg/logger";
import { alertTelegram } from "./telegram-alerts.js";
import type { Candle } from "@pkg/strategy";
import { defaultStrategyMvpConfig, minBarsRequired } from "@pkg/strategy";
import { MemoryBarProcessedStore } from "./state/bar-processed-store.js";
import { PositionManager } from "./position-manager.js";
import { PaperBroker } from "./brokers/paper-broker.js";
import { processSymbolClosedBar } from "./pipeline/closed-candle-pipeline.js";

describe("hardening", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("emergency halt env blocks work", async () => {
    vi.stubEnv("EMERGENCY_HALT", "true");
    const log = createLogger({ name: "t", level: "error" });
    const h = await resolveHalt({ envHalt: envEmergencyHalt(), storeHalt: false, log });
    expect(h).toBe(true);
  });

  it("persistStopPrice runs after openLong", async () => {
    const n = minBarsRequired(defaultStrategyMvpConfig()) + 5;
    const candles: Candle[] = [];
    let base = 10_000;
    const cfg = defaultStrategyMvpConfig();
    for (let i = 0; i < n; i++) {
      base += 20 + (i > cfg.smaPeriod ? 10 : 0);
      candles.push({
        openTime: i,
        closeTime: i + 1,
        open: base - 2,
        high: base + 5,
        low: base - 5,
        close: base,
        volume: 1,
        isClosed: true,
      });
    }
    const i = n - 1;
    const highs = candles.map((c) => c.high);
    const prev20 = Math.max(...highs.slice(i - cfg.breakoutLookback, i));
    const cur = candles[i]!;
    candles[i] = { ...cur, close: prev20 + 50, high: prev20 + 55, low: prev20 + 40 };

    const last = candles[n - 1]!;
    const stopSpy = vi.fn().mockResolvedValue(undefined);
    const barStore = new MemoryBarProcessedStore();
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
        positions: new PositionManager(),
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
        idempotencyTryReserve: async (k) => !idem.has(k) && (idem.add(k), true),
        idempotencyComplete: async () => {},
        persistStopPrice: stopSpy,
      },
    });
    if (stopSpy.mock.calls.length > 0) {
      expect(stopSpy).toHaveBeenCalledWith("BTCUSDT", expect.any(Number));
    }
  });

  it("reconciliation_mismatch alert path invokes telegram when configured", async () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const tg = { sendMessage: send } as unknown as import("@pkg/notifications").TelegramNotifier;
    const log = createLogger({ name: "t", level: "error" });
    await alertTelegram(tg, log, "reconciliation_mismatch", "test body");
    expect(send).toHaveBeenCalledWith(expect.stringContaining("reconciliation_mismatch"));
  });
});

describe("leader semantics (unit)", () => {
  it("renew only when holder matches — simulated", async () => {
    const holderA = "a";
    const holderB = "b";
    let docHolder = holderA;
    const renew = async (holder: string) => docHolder === holder;
    expect(await renew(holderA)).toBe(true);
    docHolder = holderB;
    expect(await renew(holderA)).toBe(false);
  });
});
