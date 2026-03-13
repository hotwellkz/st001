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
  config?: StrategyMvpConfig;
  onOpen?: (symbol: string, qty: number, price: number) => void;
  onClose?: (symbol: string, reason: string) => void;
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
    deps.log.debug({ symbol, closeTime: lastClosed.closeTime }, "duplicate bar skip");
    return;
  }

  if (candles.length < minBarsRequired(cfg)) {
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    return;
  }

  const i = candles.length - 1;
  const pos = deps.positions.get(symbol);

  if (pos && pos.state === "open") {
    const ex = evaluateExitLongAtIndex({ candles, config: cfg }, i, pos.avgEntry, pos.stopPrice);
    if (ex.exit) {
      const reason = ex.reason === "stop" ? "stop_loss" : "exit_signal";
      await deps.broker.placeOrder({
        symbol,
        side: "SELL",
        quantity: String(pos.qty),
        clientOrderId: generateClientOrderId("exit"),
        type: "MARKET",
      });
      deps.positions.close(symbol);
      deps.onClose?.(symbol, reason);
    }
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    return;
  }

  const entry = evaluateEntryAtIndex({ candles, config: cfg }, i);
  if (!entry.entry) {
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    return;
  }

  const idemKey = entryOrderIdempotencyKey(symbol, lastClosed.closeTime);
  const reserved = await deps.idempotencyTryReserve(idemKey);
  if (!reserved) {
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
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
    await deps.idempotencyComplete(idemKey);
    await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
    return;
  }

  const clientOrderId = generateClientOrderId("entry");
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
  deps.onOpen?.(symbol, risk.qty, lastClosed.close);
  await deps.idempotencyComplete(idemKey);
  await deps.barStore.markProcessed(symbol, lastClosed.closeTime);
}
