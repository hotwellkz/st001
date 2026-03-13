/**
 * Обработка executionReport (partial fills): накопление executedQty, запись fills по tradeId.
 */

import type { Logger } from "@pkg/logger";
import type { PositionManager } from "./position-manager.js";

export interface ExecutionReportLike {
  e?: string;
  s?: string;
  S?: string;
  x?: string;
  X?: string;
  i?: number;
  l?: string;
  L?: string;
  t?: number;
  n?: string;
  m?: boolean;
}

export function handleExecutionReport(
  ev: ExecutionReportLike,
  pm: PositionManager,
  log: Logger
): void {
  if (ev.e !== "executionReport") return;
  const symbol = ev.s;
  const side = ev.S;
  const lastQty = ev.l ? Number(ev.l) : 0;
  const lastPrice = ev.L ? Number(ev.L) : 0;
  const status = ev.X;
  if (!symbol || side !== "BUY" || lastQty <= 0) return;
  if (status === "PARTIALLY_FILLED" || status === "FILLED") {
    pm.addFill(symbol, lastQty, lastPrice);
    log.info({ symbol, status, lastQty }, "executionReport partial/full fill");
  }
}
