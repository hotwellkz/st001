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
  persistStopPrice?: (symbol: string, stopPrice: number) => Promise<void>;
  /** Firestore audit rows for bar-close validation (leader + firestore only). */
  persistAuditLog?: (message: string, context: Record<string, unknown>) => Promise<void>;
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

  const t0 = Date.now();
  const symbols = await ctx.universe.refresh();
  const rest = createKlinesClient(ctx.env);
  let klinesRequests = 0;
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
    ...(ctx.persistStopPrice != null ? { persistStopPrice: ctx.persistStopPrice } : {}),
    ...(ctx.persistAuditLog != null ? { persistAuditLog: ctx.persistAuditLog } : {}),
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

  const now = Date.now();
  let anyClosedBar = false;
  let anyOpenBarOnly = false;
  for (const symbol of symbols) {
    try {
      klinesRequests += 1;
      const rows = await rest.getKlines(symbol, "4h", { limit: 250 });
      if (rows.length < minBarsRequired(cfg)) continue;
      // Binance returns ascending by open time; LAST element is the current (still-forming) candle.
      // We need the last CLOSED bar: last row where closeTime (row[6]) < now.
      let lastClosedIdx = -1;
      for (let i = rows.length - 1; i >= 0; i--) {
        const row = rows[i];
        if (row && Number(row[6]) < now) {
          lastClosedIdx = i;
          break;
        }
      }
      if (lastClosedIdx < 0) {
        anyOpenBarOnly = true;
        const lastRow = rows[rows.length - 1];
        ctx.log.debug(
          {
            symbol,
            lastRowOpenTime: lastRow?.[0],
            lastRowCloseTime: lastRow?.[6],
            now,
            reason: "no closed bar in response",
          },
          "4h kline: last row is forming candle — skip"
        );
        continue;
      }
      const candlesAll = rows.map((row, idx) =>
        klineRowToCandle(row, Number(row[6]) < now || idx < rows.length - 1)
      );
      const lastClosedCandle = candlesAll[lastClosedIdx];
      if (!lastClosedCandle) continue;
      const candles = candlesAll.slice(0, lastClosedIdx + 1);
      ctx.log.info(
        {
          symbol,
          lastClosedCloseTime: lastClosedCandle.closeTime,
          lastClosedClose: lastClosedCandle.close,
          now,
          lastClosedIdx,
          arrayLastCloseTime: candlesAll[candlesAll.length - 1]?.closeTime,
        },
        "closed_4h_bar_detected — running pipeline (using last closed bar, not array tail)"
      );
      anyClosedBar = true;
      await ctx.persistAuditLog?.("closed_4h_bar_detected", {
        symbol,
        closeTime: lastClosedCandle.closeTime,
        close: lastClosedCandle.close,
      });
      if ("setLastPrice" in ctx.broker && typeof ctx.broker.setLastPrice === "function") {
        (ctx.broker as { setLastPrice: (s: string, p: number) => void }).setLastPrice(
          symbol,
          lastClosedCandle.close
        );
      }
      await processSymbolClosedBar({
        symbol,
        candles,
        lastClosed: lastClosedCandle,
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

  if (symbols.length > 0 && !anyClosedBar && anyOpenBarOnly) {
    ctx.log.info(
      { symbols: symbols.length },
      "cycle_summary — no closed 4h bar this tick (last row is forming candle; lastBarCloseTime unchanged)"
    );
  }

  await runReconciliationPass(ctx);

  const elapsed = Date.now() - t0;
  const interval = ctx.env.ENGINE_POLL_INTERVAL_MS;
  if (elapsed > interval * 0.85) {
    ctx.log.warn(
      { elapsedMs: elapsed, intervalMs: interval, klinesRequests, symbols: symbols.length },
      "cycle slow vs poll interval — rate-limit risk; raise ENGINE_POLL_INTERVAL_MS or shrink universe"
    );
  } else {
    ctx.log.debug({ elapsedMs: elapsed, klinesRequests }, "cycle timing");
  }
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
      await alertTelegram(
        ctx.telegram,
        ctx.log,
        "reconciliation_mismatch",
        `${sym} broker_order_missing ${pos.clientOrderIdOpen}`
      );
    } else {
      const rec = await reconcileOrderVsBroker({
        symbol: sym,
        clientOrderId: pos.clientOrderIdOpen,
        localExecutedQty: localOrder.executedQty,
        broker: ctx.broker,
        log: ctx.log,
      });
      if (!rec.ok) {
        ctx.log.warn({ symbol: sym, mismatches: rec.mismatches }, "reconcile order");
        await alertTelegram(
          ctx.telegram,
          ctx.log,
          "reconciliation_mismatch",
          `${sym} order ${rec.mismatches.join("; ")}`
        );
      }
    }

    if (ctx.fillsRepo) {
      const net = await ctx.fillsRepo.netFilledQty(uid, sym);
      const posRec = reconcilePositionVsFills({
        symbol: sym,
        positionQty: pos.qty,
        fillsQtySum: net,
        log: ctx.log,
      });
      if (!posRec.ok) {
        ctx.log.warn({ symbol: sym, mismatches: posRec.mismatches }, "reconcile position");
        await alertTelegram(
          ctx.telegram,
          ctx.log,
          "reconciliation_mismatch",
          `${sym} position ${posRec.mismatches.join("; ")}`
        );
      }
    }
  }
}
