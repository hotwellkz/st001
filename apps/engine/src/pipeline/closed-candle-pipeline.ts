/**
 * Пайплайн одного закрытого бара: дедуп → стратегия → риск → брокер.
 */

import type { Logger } from "@pkg/logger";
import type { Candle } from "@pkg/strategy";
import {
  defaultStrategyMvpConfig,
  minBarsRequired,
  evaluateEntryAtIndex,
  evaluateExitLongAtIndex,
  validateEntryRisk,
  type StrategyMvpConfig,
} from "@pkg/strategy";
import type { BarProcessedStore } from "../state/bar-processed-store.js";
import type { PositionManager } from "../position-manager.js";
import type { Broker } from "../brokers/types.js";
import { generateClientOrderId } from "@pkg/storage";
import { entryOrderIdempotencyKey } from "../order-idempotency.js";
import type { ExchangeOrderConstraints } from "@pkg/strategy";

export interface PipelineDeps {
  log: Logger;
  barStore: BarProcessedStore;
  positions: PositionManager;
  broker: Broker;
  userId: string;
  equityQuote: number;
  constraints: ExchangeOrderConstraints;
  idempotencyTryReserve: (key: string) => Promise<boolean>;
  idempotencyComplete: (key: string) => Promise<void>;
  /** После открытия long — точный стоп в Firestore (paper). */
  persistStopPrice?: (symbol: string, stopPrice: number) => Promise<void>;
  config?: StrategyMvpConfig;
  onOpen?: (symbol: string, qty: number, price: number) => void;
  onClose?: (symbol: string, reason: string) => void;
  /** Firestore + stdout visibility for bar-close validation (optional). */
  persistAuditLog?: (message: string, context: Record<string, unknown>) => Promise<void>;
}

export async function processSymbolClosedBar(params: {
  symbol: string;
  candles: Candle[];
  lastClosed: Candle;
  deps: PipelineDeps;
}): Promise<void> {
  const { symbol, candles, lastClosed, deps } = params;
  const cfg = deps.config ?? defaultStrategyMvpConfig();

  if (!lastClosed.isClosed) {
    deps.log.warn({ symbol }, "skip unclosed bar");
    return;
  }

  const lastProcessed = await deps.barStore.getLastCloseTime(symbol);
  if (lastProcessed !== undefined && lastProcessed >= lastClosed.closeTime) {
    deps.log.info({ symbol, closeTime: lastClosed.closeTime }, "bar_pipeline_duplicate_skip (already processed)");
    await deps.persistAuditLog?.("bar_pipeline_duplicate_skip", {
      symbol,
      closeTime: lastClosed.closeTime,
    });
    return;
  }

  if (candles.length < minBarsRequired(cfg)) {
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    deps.log.info(
      { symbol, closeTime: lastClosed.closeTime, reason: "min_bars" },
      "bar_processed — lastBarCloseTime updated (warmup/min bars only)"
    );
    await deps.persistAuditLog?.("bar_processed", {
      symbol,
      closeTime: lastClosed.closeTime,
      outcome: "min_bars_warmup",
    });
    return;
  }

  const i = candles.length - 1;
  const pos = deps.positions.get(symbol);

  if (pos && pos.state === "open") {
    const ex = evaluateExitLongAtIndex({ candles, config: cfg }, i, pos.avgEntry, pos.stopPrice);
    if (ex.exit) {
      const reason = ex.reason === "stop" ? "stop_loss" : "exit_signal";
      const cid = generateClientOrderId("exit");
      deps.log.info({ symbol, reason, clientOrderId: cid }, "paper_exit_placed (closed bar)");
      await deps.broker.placeOrder({
        symbol,
        side: "SELL",
        quantity: String(pos.qty),
        clientOrderId: cid,
        type: "MARKET",
      });
      deps.positions.close(symbol);
      deps.onClose?.(symbol, reason);
      await deps.persistAuditLog?.("paper_exit_placed", { symbol, reason, clientOrderId: cid });
    } else {
      deps.log.info({ symbol }, "strategy_evaluated — hold long, no exit on this bar");
      await deps.persistAuditLog?.("strategy_hold_long", { symbol, closeTime: lastClosed.closeTime });
    }
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    await deps.persistAuditLog?.("bar_processed", {
      symbol,
      closeTime: lastClosed.closeTime,
      outcome: ex.exit ? "after_exit" : "holding",
    });
    return;
  }

  const entry = evaluateEntryAtIndex({ candles, config: cfg }, i);
  if (!entry.entry) {
    deps.log.info({ symbol, closeTime: lastClosed.closeTime }, "strategy_evaluated — no entry signal");
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    await deps.persistAuditLog?.("bar_processed", {
      symbol,
      closeTime: lastClosed.closeTime,
      outcome: "no_entry_signal",
    });
    return;
  }

  const idemKey = entryOrderIdempotencyKey(symbol, lastClosed.closeTime);
  const reserved = await deps.idempotencyTryReserve(idemKey);
  if (!reserved) {
    deps.log.info({ symbol, idemKey }, "bar_processed — idempotency skip (already reserved)");
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    await deps.persistAuditLog?.("bar_processed", {
      symbol,
      closeTime: lastClosed.closeTime,
      outcome: "idempotency_skip",
    });
    return;
  }

  const ev0 = entry.events[0];
  const stopRef = ev0?.type === "signal_detected" ? ev0.stopPrice : lastClosed.close;
  const atr = (lastClosed.close - stopRef) / cfg.atrStopMult;

  const risk = validateEntryRisk({
    config: cfg,
    eligibility: { symbol, isLiquid: true, inUniverse: true },
    positions: [],
    equityQuote: deps.equityQuote,
    entryPrice: lastClosed.close,
    atr: atr > 0 ? atr : 1,
    constraints: deps.constraints,
  });

  if (!risk.ok) {
    deps.log.info(
      { symbol, reason: risk.reason },
      "strategy_entry_signal — risk rejected, no paper order"
    );
    await deps.idempotencyComplete(idemKey);
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    await deps.persistAuditLog?.("bar_processed", {
      symbol,
      closeTime: lastClosed.closeTime,
      outcome: "risk_rejected",
      riskReason: risk.reason,
    });
    return;
  }

  const clientOrderId = generateClientOrderId("entry");
  deps.log.info(
    { symbol, clientOrderId, qty: risk.qty, price: lastClosed.close },
    "paper_entry_placed (closed bar)"
  );
  await deps.broker.placeOrder({
    symbol,
    side: "BUY",
    quantity: String(risk.qty),
    clientOrderId,
    type: "MARKET",
  });

  deps.positions.openLong({
    symbol,
    qty: risk.qty,
    avgEntry: lastClosed.close,
    stopPrice: risk.stopPrice,
    clientOrderIdOpen: clientOrderId,
  });
  await deps.persistStopPrice?.(symbol, risk.stopPrice);
  deps.onOpen?.(symbol, risk.qty, lastClosed.close);
  await deps.idempotencyComplete(idemKey);
  await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
  await deps.persistAuditLog?.("bar_processed", {
    symbol,
    closeTime: lastClosed.closeTime,
    outcome: "paper_entry_placed",
    clientOrderId,
  });
}
