/**
 * Идемпотентность: clientOrderId и ключи обработки событий.
 * Дубликаты по одному clientOrderId на бирже отклоняются — генерируем уникально.
 */

import { createHash, randomBytes } from "node:crypto";

const CLIENT_ID_MAX = 36;

/**
 * Префикс (например engine instance) + время + случайность → уникальный clientOrderId.
 */
export function generateClientOrderId(prefix: string): string {
  const safe = prefix.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "eng";
  const t = Date.now().toString(36);
  const r = randomBytes(6).toString("hex");
  const raw = `${safe}_${t}_${r}`;
  return raw.length <= CLIENT_ID_MAX ? raw : raw.slice(0, CLIENT_ID_MAX);
}

/**
 * Стабильный ключ для дедупа user-stream событий (executionReport по orderId+tradeId или clientOrderId+status).
 */
export function executionReportDedupKey(parts: {
  orderId: number;
  lastTradeId?: number;
  clientOrderId?: string;
  status: string;
}): string {
  const base = `${String(parts.orderId)}|${parts.status}|${String(parts.lastTradeId ?? "")}|${parts.clientOrderId ?? ""}`;
  return createHash("sha256").update(base).digest("hex").slice(0, 32);
}

/**
 * Ключ идемпотентности для произвольной операции (один раз записать в Firestore).
 */
export function operationIdempotencyKey(scope: string, id: string): string {
  return createHash("sha256").update(`${scope}:${id}`).digest("hex").slice(0, 40);
}
