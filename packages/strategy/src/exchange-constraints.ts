/**
 * Числовые ограничения биржи (домен не знает Binance — только числа).
 * Округление и minNotional — до размещения ордера.
 */

export interface ExchangeOrderConstraints {
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number;
}

export function floorToStep(qty: number, stepSize: number): number {
  if (stepSize <= 0 || !Number.isFinite(qty)) return qty;
  const prec = Math.min(16, Math.max(0, Math.round(-Math.log10(stepSize))));
  const steps = Math.floor(qty / stepSize + 1e-12);
  return Number((steps * stepSize).toFixed(prec));
}

export function roundToTick(price: number, tickSize: number): number {
  if (tickSize <= 0 || !Number.isFinite(price)) return price;
  const prec = Math.min(16, Math.max(0, Math.round(-Math.log10(tickSize))));
  const ticks = Math.round(price / tickSize);
  return Number((ticks * tickSize).toFixed(prec));
}

export function satisfiesExchange(
  qty: number,
  price: number,
  c: ExchangeOrderConstraints
): { ok: true } | { ok: false; reason: string } {
  if (qty < c.minQty - 1e-14) return { ok: false, reason: "qty_below_min" };
  if (qty > c.maxQty + 1e-14) return { ok: false, reason: "qty_above_max" };
  if (qty * price < c.minNotional - 1e-8) return { ok: false, reason: "below_min_notional" };
  return { ok: true };
}
