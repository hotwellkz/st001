/**
 * Engine runner: universe → klines → только последний закрытый бар → pipeline.
 * Рестарт: barStore восстанавливает lastBarCloseTime из Firestore (или memory для тестов).
 */

import type { Logger } from "@pkg/logger";
import type { EngineEnv } from "@pkg/config";
import { BinanceRestClient } from "@pkg/binance";
import { requireBinanceCredentials } from "@pkg/config";
import { klineRowToCandle } from "./klines-to-candles.js";
import { processSymbolClosedBar } from "./pipeline/closed-candle-pipeline.js";
import type { PipelineDeps } from "./pipeline/closed-candle-pipeline.js";
import type { UniverseService } from "./universe/universe-service.js";
import type { BarProcessedStore } from "./state/bar-processed-store.js";
import type { PositionManager } from "./position-manager.js";
import type { Broker } from "./brokers/types.js";
import { resolveHalt, envEmergencyHalt } from "./kill-switch.js";
import { alertTelegram } from "./telegram-alerts.js";
import type { TelegramNotifier } from "@pkg/notifications";
import { defaultStrategyMvpConfig, minBarsRequired } from "@pkg/strategy";

export interface RunnerContext {
  env: EngineEnv;
  log: Logger;
  universe: UniverseService;
  barStore: BarProcessedStore;
  positions: PositionManager;
  broker: Broker;
  idempotencyTryReserve: (key: string) => Promise<boolean>;
  idempotencyComplete: (key: string) => Promise<void>;
  telegram: TelegramNotifier | null;
  storeEmergencyHalt?: boolean;
  equityQuote: number;
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number;
}

export async function runEngineCycle(ctx: RunnerContext): Promise<void> {
  const halt = await resolveHalt({
    envHalt: envEmergencyHalt(),
    storeHalt: ctx.storeEmergencyHalt === true,
    log: ctx.log,
  });
  if (halt) return;

  const symbols = await ctx.universe.refresh();
  let rest: BinanceRestClient | null = null;
  try {
    const cred = requireBinanceCredentials(ctx.env);
    rest = new BinanceRestClient({
      baseUrl: cred.baseUrl,
      apiKey: cred.apiKey,
      apiSecret: cred.apiSecret,
    });
  } catch {
    ctx.log.warn("no Binance creds: skip klines fetch (paper offline test)");
  }

  const cfg = defaultStrategyMvpConfig();
  const deps: PipelineDeps = {
    log: ctx.log,
    barStore: ctx.barStore,
    positions: ctx.positions,
    broker: ctx.broker,
    userId: ctx.env.ENGINE_USER_ID,
    equityQuote: ctx.equityQuote,
    constraints: {
      tickSize: ctx.tickSize,
      stepSize: ctx.stepSize,
      minQty: ctx.minQty,
      maxQty: ctx.maxQty,
      minNotional: ctx.minNotional,
    },
    idempotencyTryReserve: ctx.idempotencyTryReserve,
    idempotencyComplete: ctx.idempotencyComplete,
    onOpen: (symbol, qty, price) => {
      void alertTelegram(
        ctx.telegram,
        ctx.log,
        "open",
        `${symbol} qty=${String(qty)} @${String(price)}`
      );
    },
    onClose: (symbol, reason) => {
      void alertTelegram(
        ctx.telegram,
        ctx.log,
        reason === "stop_loss" ? "stop_loss" : "close",
        `${symbol} ${reason}`
      );
    },
  };

  for (const symbol of symbols) {
    try {
      if (!rest) continue;
      const rows = await rest.getKlines(symbol, "4h", { limit: 250 });
      if (rows.length < minBarsRequired(cfg)) continue;
      const now = Date.now();
      const candles = rows.map((row, idx) =>
        klineRowToCandle(row, row[6] < now || idx < rows.length - 1)
      );
      const last = candles[candles.length - 1];
      if (!last?.isClosed) continue;
      if ("setLastPrice" in ctx.broker && typeof ctx.broker.setLastPrice === "function") {
        (ctx.broker as { setLastPrice: (s: string, p: number) => void }).setLastPrice(
          symbol,
          last.close
        );
      }
      await processSymbolClosedBar({
        symbol,
        candles,
        lastClosed: last,
        deps,
      });
    } catch (e) {
      ctx.log.error({ err: e, symbol }, "cycle symbol error");
      await alertTelegram(
        ctx.telegram,
        ctx.log,
        "error",
        String(e instanceof Error ? e.message : e)
      );
    }
  }
}
