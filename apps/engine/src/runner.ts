/**
 * Engine runner: universe → klines (Binance public) → последний закрытый бар → pipeline.
 * Reconciliation в конце цикла по открытым позициям и ордерам в брокере.
 */

import type { Logger } from "@pkg/logger";
import type { EngineEnv } from "@pkg/config";
import { BinanceRestClient, binanceRestForMarketData } from "@pkg/binance";
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
import { reconcileOrderVsBroker, reconcilePositionVsFills } from "./reconciliation.js";
import type { FillsRepository } from "@pkg/storage";

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
  /** Для сверки позиции с суммой BUY fills по символу (paper). */
  fillsRepo?: FillsRepository;
  userId?: string;
}

function createKlinesClient(env: EngineEnv): BinanceRestClient {
  try {
    const cred = requireBinanceCredentials(env);
    return new BinanceRestClient({
      baseUrl: cred.baseUrl,
      apiKey: cred.apiKey,
      apiSecret: cred.apiSecret,
    });
  } catch {
    return binanceRestForMarketData(env.BINANCE_BASE_URL);
  }
}

export async function runEngineCycle(ctx: RunnerContext): Promise<void> {
  const halt = await resolveHalt({
    envHalt: envEmergencyHalt(),
    storeHalt: ctx.storeEmergencyHalt === true,
    log: ctx.log,
  });
  if (halt) return;

  const symbols = await ctx.universe.refresh();
  const rest = createKlinesClient(ctx.env);
  ctx.log.debug("klines client ready (public or signed)");

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

  await runReconciliationPass(ctx);
}

async function runReconciliationPass(ctx: RunnerContext): Promise<void> {
  const uid = ctx.userId ?? ctx.env.ENGINE_USER_ID;
  for (const sym of await ctx.universe.refresh()) {
    const pos = ctx.positions.get(sym);
    if (!pos || pos.state !== "open" || !pos.clientOrderIdOpen) continue;
    const localOrder = await ctx.broker.getOrder(sym, pos.clientOrderIdOpen);
    if (!localOrder) {
      ctx.log.warn(
        { symbol: sym, clientOrderId: pos.clientOrderIdOpen },
        "reconcile: broker has no order (restart seed missing?) — skip broker compare"
      );
    } else {
      const rec = await reconcileOrderVsBroker({
        symbol: sym,
        clientOrderId: pos.clientOrderIdOpen,
        localExecutedQty: localOrder.executedQty,
        broker: ctx.broker,
        log: ctx.log,
      });
      if (!rec.ok) ctx.log.warn({ symbol: sym, mismatches: rec.mismatches }, "reconcile order");
    }

    if (ctx.fillsRepo) {
      const net = await ctx.fillsRepo.netFilledQty(uid, sym);
      const posRec = reconcilePositionVsFills({
        symbol: sym,
        positionQty: pos.qty,
        fillsQtySum: net,
        log: ctx.log,
      });
      if (!posRec.ok) ctx.log.warn({ symbol: sym, mismatches: posRec.mismatches }, "reconcile position");
    }
  }
}
