import { describe, it, expect } from "vitest";
import {
  parseSymbolFilters,
  roundQtyToStep,
  roundPriceToTick,
  validateOrderConstraints,
} from "./filters.js";
import type { BinanceExchangeInfoSymbolDto } from "./dto/exchange-info.js";

describe("parseSymbolFilters", () => {
  it("parses PRICE_FILTER + LOT_SIZE + NOTIONAL", () => {
    const symbol: BinanceExchangeInfoSymbolDto = {
      symbol: "BTCUSDT",
      status: "TRADING",
      baseAsset: "BTC",
      quoteAsset: "USDT",
      filters: [
        { filterType: "PRICE_FILTER", minPrice: "0.01", maxPrice: "1000000", tickSize: "0.01" },
        { filterType: "LOT_SIZE", minQty: "0.00001", maxQty: "9000", stepSize: "0.00001" },
        { filterType: "NOTIONAL", minNotional: "5", applyMinToMarket: "true" },
      ],
    };
    const p = parseSymbolFilters(symbol);
    expect(p.tickSize).toBe(0.01);
    expect(p.stepSize).toBe(0.00001);
    expect(p.minQty).toBe(0.00001);
    expect(p.minNotional).toBe(5);
  });

  it("roundQtyToStep floors to step", () => {
    expect(roundQtyToStep(0.100009, 0.00001)).toBe(0.1);
    expect(roundQtyToStep(1.23456, 0.001)).toBe(1.234);
  });

  it("roundPriceToTick", () => {
    expect(roundPriceToTick(43210.126, 0.01)).toBe(43210.13);
  });

  it("validateOrderConstraints minNotional", () => {
    const symbol: BinanceExchangeInfoSymbolDto = {
      symbol: "ETHUSDT",
      status: "TRADING",
      baseAsset: "ETH",
      quoteAsset: "USDT",
      filters: [
        { filterType: "PRICE_FILTER", minPrice: "0.01", maxPrice: "1000000", tickSize: "0.01" },
        { filterType: "LOT_SIZE", minQty: "0.001", maxQty: "10000", stepSize: "0.001" },
        { filterType: "NOTIONAL", minNotional: "10" },
      ],
    };
    const p = parseSymbolFilters(symbol);
    expect(validateOrderConstraints(p, 0.01, 100)).toEqual({
      ok: false,
      reason: "below_minNotional",
    });
    expect(validateOrderConstraints(p, 0.2, 100).ok).toBe(true);
  });
});
