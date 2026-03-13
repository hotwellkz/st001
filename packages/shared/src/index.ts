/**
 * @pkg/shared — общие типы домена и контрактов между сервисами.
 * Без зависимостей от Firebase/Binance/UI.
 */

export type TradingMode = "backtest" | "paper" | "live";

export type HealthStatus = "ok" | "degraded" | "down";

export interface HealthCheckResult {
  status: HealthStatus;
  service: string;
  timestampIso: string;
  details?: Record<string, string>;
}

export interface ServiceIdentity {
  name: string;
  version: string;
}

export {
  registerGracefulShutdown,
  type ShutdownFn,
  type GracefulShutdownOptions,
} from "./shutdown.js";
