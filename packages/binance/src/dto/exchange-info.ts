/**
 * DTO: Binance GET /api/v3/exchangeInfo (фрагменты, строго под спот).
 * Не смешивать с доменными моделями ордеров/позиций.
 */

export interface BinanceExchangeInfoSymbolDto {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  filters: BinanceSymbolFilterDto[];
}

export type BinanceSymbolFilterDto =
  | BinancePriceFilterDto
  | BinanceLotSizeFilterDto
  | BinanceMinNotionalDto
  | BinanceNotionalDto
  | Record<string, string>;

export interface BinancePriceFilterDto {
  filterType: "PRICE_FILTER";
  minPrice: string;
  maxPrice: string;
  tickSize: string;
}

export interface BinanceLotSizeFilterDto {
  filterType: "LOT_SIZE";
  minQty: string;
  maxQty: string;
  stepSize: string;
}

/** Старые символы — MIN_NOTIONAL */
export interface BinanceMinNotionalDto {
  filterType: "MIN_NOTIONAL";
  minNotional?: string;
  applyToMarket?: string;
}

/** Новый фильтр notional */
export interface BinanceNotionalDto {
  filterType: "NOTIONAL";
  minNotional: string;
  applyMinToMarket?: string;
  maxNotional?: string;
  applyMaxToMarket?: string;
  avgPriceMins?: string;
}

export interface BinanceExchangeInfoDto {
  timezone: string;
  serverTime: number;
  rateLimits: unknown[];
  symbols: BinanceExchangeInfoSymbolDto[];
}
