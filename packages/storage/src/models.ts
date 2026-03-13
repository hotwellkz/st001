/**
 * Модели документов Firestore (доменные, не DTO Binance).
 * reconciliation: orders/fills обновляются из user stream + периодический sync.
 */

import type { Timestamp } from "firebase-admin/firestore";

export type TradingMode = "backtest" | "paper" | "live";

export interface UserDoc {
  uid: string;
  email?: string;
  displayName?: string;
  createdAt: Timestamp;
  liveTradingEnabled: boolean;
  liveTradingAcknowledgedAt?: Timestamp;
}

export interface StrategyConfigDoc {
  userId: string;
  name: string;
  timeframe: string;
  universeRef?: string;
  updatedAt: Timestamp;
  paramsJson: string;
}

export interface SymbolsUniverseDoc {
  name: string;
  symbols: string[];
  updatedAt: Timestamp;
}

export type OrderStatus =
  | "new"
  | "pending_submit"
  | "partially_filled"
  | "filled"
  | "canceled"
  | "rejected"
  | "expired";

/**
 * Ордер в нашей системе. status — после сверки с биржей; не доверять только place response.
 */
export interface OrderDoc {
  userId: string;
  clientOrderId: string;
  exchangeOrderId?: number;
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  status: OrderStatus;
  quantity: string;
  executedQty: string;
  quoteQty?: string;
  price?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastReconciledAt?: Timestamp;
  rawPlaceResponse?: Record<string, unknown>;
}

export interface FillDoc {
  userId: string;
  orderClientId: string;
  exchangeOrderId: number;
  symbol: string;
  tradeId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  isBuyer: boolean;
  time: Timestamp;
}

export interface PositionDoc {
  userId: string;
  symbol: string;
  quantity: string;
  avgEntryPrice?: string;
  /** Последний открывающий ордер (paper recovery + reconcile). */
  clientOrderIdOpen?: string;
  updatedAt: Timestamp;
  source: "reconciled" | "paper";
}

export interface EngineStateDoc {
  instanceId: string;
  leaderLeaseUntil: Timestamp;
  /** Последний обработанный closeTime по символу — восстановление после рестарта */
  lastBarCloseTime?: Record<string, number>;
  lastUserStreamEventTime?: Timestamp;
  /** Аварийная остановка торговли */
  emergencyHalt?: boolean;
  /** Дневной PnL (quote), для лимита потерь */
  dailyPnlQuote?: number;
  dailyLossLimitFrac?: number;
  updatedAt: Timestamp;
}

export interface LogDoc {
  level: string;
  service: string;
  message: string;
  contextJson?: string;
  time: Timestamp;
}

export interface AlertDoc {
  userId?: string;
  channel: "telegram" | "internal";
  title: string;
  body: string;
  severity: "info" | "warning" | "critical";
  createdAt: Timestamp;
  deliveredAt?: Timestamp;
}

export interface IdempotencyKeyDoc {
  key: string;
  createdAt: Timestamp;
  outcome: "reserved" | "completed" | "failed";
  metadata?: Record<string, string>;
}

export interface LockDoc {
  holderId: string;
  leaseUntil: Timestamp;
  renewedAt: Timestamp;
}
