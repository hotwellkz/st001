/**
 * Имена коллекций Firestore. Один префикс для мультитенанта при необходимости.
 */

export const COLLECTIONS = {
  users: "users",
  strategyConfigs: "strategyConfigs",
  symbolsUniverse: "symbolsUniverse",
  orders: "orders",
  fills: "fills",
  positions: "positions",
  engineState: "engineState",
  logs: "logs",
  alerts: "alerts",
  idempotencyKeys: "idempotencyKeys",
  locks: "locks",
} as const;
