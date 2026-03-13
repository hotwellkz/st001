/**
 * Размер позиции: risk$ = equity * riskPerTradeFrac; qty = risk$ / stopDistance.
 */

import type { StrategyMvpConfig } from "./config.js";
import { floorToStep, roundToTick } from "./exchange-constraints.js";

export interface SizePositionInput {
  equityQuote: number;
  entryPrice: number;
  stopPrice: number;
  config: StrategyMvpConfig;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number;
}

export interface SizePositionResult {
  qty: number;
  stopPriceRounded: number;
  riskQuote: number;
  stopDistancePerUnit: number;
  skippedReason?: string;
}

export function computeLongStopPrice(
  entryPrice: number,
  atr: number,
  atrStopMult: number,
  tickSize: number
): number {
  return roundToTick(entryPrice - atrStopMult * atr, tickSize);
}

export function sizeLongPosition(input: SizePositionInput): SizePositionResult {
  const { equityQuote, entryPrice, stopPrice, config } = input;
  const stopDistance = entryPrice - stopPrice;
  if (stopDistance <= 0 || !Number.isFinite(stopDistance)) {
    return {
      qty: 0,
      stopPriceRounded: stopPrice,
      riskQuote: 0,
      stopDistancePerUnit: 0,
      skippedReason: "invalid_stop_distance",
    };
  }
  const riskQuote = equityQuote * config.riskPerTradeFrac;
  let qty = riskQuote / stopDistance;
  qty = floorToStep(qty, input.stepSize);
  if (qty < input.minQty) {
    return {
      qty: 0,
      stopPriceRounded: stopPrice,
      riskQuote,
      stopDistancePerUnit: stopDistance,
      skippedReason: "qty_below_min_after_round",
    };
  }
  let qtyCapped = qty;
  if (qtyCapped > input.maxQty) qtyCapped = floorToStep(input.maxQty, input.stepSize);
  const notional = qtyCapped * entryPrice;
  if (notional < input.minNotional) {
    return {
      qty: 0,
      stopPriceRounded: stopPrice,
      riskQuote,
      stopDistancePerUnit: stopDistance,
      skippedReason: "below_min_notional",
    };
  }
  return {
    qty: qtyCapped,
    stopPriceRounded: stopPrice,
    riskQuote,
    stopDistancePerUnit: stopDistance,
  };
}
