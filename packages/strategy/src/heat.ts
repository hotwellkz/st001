/**
 * Portfolio heat: сумма долей риска по открытым позициям (каждая ~ riskPerTrade при полном стопе).
 * Кап 6% = не более maxPortfolioHeatFrac / riskPerTradeFrac «слотов» при равном риске.
 */

import type { StrategyMvpConfig } from "./config.js";

export interface OpenPositionRisk {
  /** Доля эквити, поставленная на риск (как при sizing), 0.005 = 0.5% */
  riskFrac: number;
}

export function portfolioHeatFrac(positions: readonly OpenPositionRisk[]): number {
  return positions.reduce((a, p) => a + p.riskFrac, 0);
}

export function canOpenNewPosition(
  positions: readonly OpenPositionRisk[],
  config: StrategyMvpConfig
): { ok: true } | { ok: false; reason: string } {
  if (positions.length >= config.maxConcurrentPositions) {
    return { ok: false, reason: "max_concurrent_positions" };
  }
  const heat = portfolioHeatFrac(positions);
  if (heat + config.riskPerTradeFrac > config.maxPortfolioHeatFrac + 1e-12) {
    return { ok: false, reason: "max_portfolio_heat" };
  }
  return { ok: true };
}
