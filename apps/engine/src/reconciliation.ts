/**
 * Reconciliation: где запускается — после user stream событий и периодически в цикле.
 * Проверки:
 * - getOrder(clientOrderId) vs локальный OrderDoc.executedQty
 * - сумма fills по ордеру vs executedQty
 * - позиция: агрегат fills vs PositionManager (paper: внутренний ledger)
 *
 * Partial fills: executionReport с накоплением z (executedQty); каждый trade создаёт fill;
 * статус PARTIALLY_FILLED до FILLED.
 */

import type { Logger } from "@pkg/logger";
import type { Broker } from "./brokers/types.js";
export interface ReconciliationResult {
  ok: boolean;
  mismatches: string[];
}

export async function reconcileOrderVsBroker(params: {
  symbol: string;
  clientOrderId: string;
  localExecutedQty: string;
  broker: Broker;
  log: Logger;
}): Promise<ReconciliationResult> {
  const remote = await params.broker.getOrder(params.symbol, params.clientOrderId);
  const mismatches: string[] = [];
  if (!remote) {
    mismatches.push("broker_order_missing");
    return { ok: false, mismatches };
  }
  const a = Number(params.localExecutedQty);
  const b = Number(remote.executedQty);
  if (Math.abs(a - b) > 1e-8) {
    mismatches.push(`executedQty local=${params.localExecutedQty} remote=${remote.executedQty}`);
  }
  return { ok: mismatches.length === 0, mismatches };
}

export function reconcilePositionVsFills(params: {
  symbol: string;
  positionQty: number;
  fillsQtySum: number;
  log: Logger;
}): ReconciliationResult {
  const mismatches: string[] = [];
  if (Math.abs(params.positionQty - params.fillsQtySum) > 1e-8) {
    mismatches.push(
      `position_qty ${String(params.positionQty)} vs fills_sum ${String(params.fillsQtySum)} ${params.symbol}`
    );
  }
  return { ok: mismatches.length === 0, mismatches };
}
