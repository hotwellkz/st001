/**
 * Перед placeOrder: ключ symbol + closeTime + "ENTRY" — один раз на бар.
 */

import { operationIdempotencyKey } from "@pkg/storage";

export function entryOrderIdempotencyKey(symbol: string, closeTime: number): string {
  return operationIdempotencyKey("entry", `${symbol}:${String(closeTime)}`);
}
