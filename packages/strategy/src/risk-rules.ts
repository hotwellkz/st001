/**
 * Агрегированная проверка риска перед входом.
 */

import type { StrategyMvpConfig } from "./config.js";
import { canOpenNewPosition, type OpenPositionRisk } from "./heat.js";
import { isEligibleForEntry, type SymbolEligibility } from "./eligibility.js";
import type { ExchangeOrderConstraints } from "./exchange-constraints.js";
import { satisfiesExchange, floorToStep, roundToTick } from "./exchange-constraints.js";

export interface RiskValidationInput {
  config: StrategyMvpConfig;
  eligibility: SymbolEligibility;
  positions: OpenPositionRisk[];
  equityQuote: number;
  entryPrice: number;
  atr: number;
  constraints: ExchangeOrderConstraints;
}

export type RiskValidationResult =
  | { ok: true; stopPrice: number; qty: number }
  | { ok: false; reason: string };

export function validateEntryRisk(input: RiskValidationInput): RiskValidationResult {
  if (!isEligibleForEntry(input.eligibility)) {
    return { ok: false, reason: "symbol_not_eligible" };
  }
  const cap = canOpenNewPosition(input.positions, input.config);
  if (!cap.ok) return { ok: false, reason: cap.reason };

  const stopPrice = roundToTick(
    input.entryPrice - input.config.atrStopMult * input.atr,
    input.constraints.tickSize
  );
  const stopDist = input.entryPrice - stopPrice;
  if (stopDist <= 0) return { ok: false, reason: "stop_not_below_entry" };

  const riskQuote = input.equityQuote * input.config.riskPerTradeFrac;
  let qty = riskQuote / stopDist;
  qty = floorToStep(qty, input.constraints.stepSize);
  const ex = satisfiesExchange(qty, input.entryPrice, input.constraints);
  if (!ex.ok) return { ok: false, reason: ex.reason };

  return { ok: true, stopPrice, qty };
}
