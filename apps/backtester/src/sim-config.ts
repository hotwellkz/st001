/**
 * Параметры симуляции (не домен стратегии) — комиссии, проскальзывание, стартовый капитал.
 */

export interface SimulationConfig {
  initialCashQuote: number;
  /** Доля от сделки (taker), например 0.001 = 0.1% */
  feeRateTaker: number;
  /** Покупка: хуже цены */
  slippageBuyFrac: number;
  /** Продажа: хуже цены */
  slippageSellFrac: number;
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number;
}

export const defaultSimulationConfig = (): SimulationConfig => ({
  initialCashQuote: 100_000,
  feeRateTaker: 0.001,
  slippageBuyFrac: 0.0005,
  slippageSellFrac: 0.0005,
  tickSize: 0.01,
  stepSize: 0.00001,
  minQty: 0.00001,
  maxQty: 9000,
  minNotional: 10,
});
