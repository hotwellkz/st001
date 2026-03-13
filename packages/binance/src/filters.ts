/**
 * Парсинг exchange filters → нормализованные лимиты для sizing.
 */

import type {
  BinanceExchangeInfoSymbolDto,
  BinanceLotSizeFilterDto,
  BinanceMinNotionalDto,
  BinanceNotionalDto,
  BinancePriceFilterDto,
  BinanceSymbolFilterDto,
} from "./dto/exchange-info.js";

export interface ParsedSymbolFilters {
  symbol: string;
  tickSize: number;
  stepSize: number;
  minQty: number;
  maxQty: number;
  minNotional: number;
}

function num(s: string): number {
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`Invalid numeric filter: ${s}`);
  return n;
}

function filterType(f: BinanceSymbolFilterDto): string {
  return (f as { filterType?: string }).filterType ?? "";
}

function isPriceFilter(f: BinanceSymbolFilterDto): f is BinancePriceFilterDto {
  return filterType(f) === "PRICE_FILTER";
}

function isLotSize(f: BinanceSymbolFilterDto): f is BinanceLotSizeFilterDto {
  return filterType(f) === "LOT_SIZE";
}

function isMinNotional(f: BinanceSymbolFilterDto): f is BinanceMinNotionalDto {
  return filterType(f) === "MIN_NOTIONAL";
}

function isNotional(f: BinanceSymbolFilterDto): f is BinanceNotionalDto {
  return filterType(f) === "NOTIONAL";
}

/**
 * Округление количества вниз к stepSize (как требует LOT_SIZE).
 */
export function roundQtyToStep(qty: number, stepSize: number): number {
  if (stepSize <= 0 || !Number.isFinite(qty)) return qty;
  const precision = Math.round(-Math.log10(stepSize));
  const steps = Math.floor(qty / stepSize);
  const rounded = steps * stepSize;
  return Number(rounded.toFixed(precision > 0 ? precision : 8));
}

/**
 * Округление цены к tickSize.
 */
export function roundPriceToTick(price: number, tickSize: number): number {
  if (tickSize <= 0 || !Number.isFinite(price)) return price;
  const precision = Math.round(-Math.log10(tickSize));
  const ticks = Math.round(price / tickSize);
  return Number((ticks * tickSize).toFixed(precision > 0 ? precision : 8));
}

export function parseSymbolFilters(symbol: BinanceExchangeInfoSymbolDto): ParsedSymbolFilters {
  let tickSize = 0;
  let stepSize = 0;
  let minQty = 0;
  let maxQty = Number.POSITIVE_INFINITY;
  let minNotional = 0;

  for (const f of symbol.filters) {
    if (isPriceFilter(f)) {
      tickSize = num(f.tickSize);
    } else if (isLotSize(f)) {
      stepSize = num(f.stepSize);
      minQty = num(f.minQty);
      maxQty = num(f.maxQty);
    } else if (isMinNotional(f)) {
      if (f.minNotional !== undefined) minNotional = Math.max(minNotional, num(f.minNotional));
    } else if (isNotional(f)) {
      minNotional = Math.max(minNotional, num(f.minNotional));
    }
  }

  if (tickSize <= 0) tickSize = 1e-8;
  if (stepSize <= 0) stepSize = 1e-8;

  return {
    symbol: symbol.symbol,
    tickSize,
    stepSize,
    minQty,
    maxQty,
    minNotional,
  };
}

/**
 * Проверка: qty и notional удовлетворяют фильтрам (после округления).
 */
export function validateOrderConstraints(
  parsed: ParsedSymbolFilters,
  qty: number,
  price: number
): { ok: true } | { ok: false; reason: string } {
  if (qty < parsed.minQty - 1e-12) return { ok: false, reason: "qty_below_minQty" };
  if (qty > parsed.maxQty + 1e-12) return { ok: false, reason: "qty_above_maxQty" };
  const notional = qty * price;
  if (notional < parsed.minNotional - 1e-8) return { ok: false, reason: "below_minNotional" };
  return { ok: true };
}
