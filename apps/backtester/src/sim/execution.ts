/**
 * Модель исполнения: следующая доступная цена = open следующей свечи ± slippage.
 */

import { roundToTick, floorToStep } from "@pkg/strategy";

export function entryFillPrice(
  nextBarOpen: number,
  slippageBuyFrac: number,
  tickSize: number
): number {
  return roundToTick(nextBarOpen * (1 + slippageBuyFrac), tickSize);
}

export function exitFillPrice(
  nextBarOpen: number,
  slippageSellFrac: number,
  tickSize: number
): number {
  return roundToTick(nextBarOpen * (1 - slippageSellFrac), tickSize);
}

export function feeOnNotional(notional: number, feeRate: number): number {
  return notional * feeRate;
}

export function qtyFromRisk(
  equity: number,
  riskFrac: number,
  entryPrice: number,
  stopPrice: number,
  stepSize: number,
  minQty: number,
  maxQty: number,
  minNotional: number
): number {
  const dist = entryPrice - stopPrice;
  if (dist <= 0) return 0;
  const risk$ = equity * riskFrac;
  let q = risk$ / dist;
  q = floorToStep(q, stepSize);
  if (q < minQty) return 0;
  if (q > maxQty) q = floorToStep(maxQty, stepSize);
  if (q * entryPrice < minNotional) return 0;
  return q;
}
