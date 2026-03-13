import type { Candle } from "@pkg/strategy";

/** Источник истории: только прошлые бары, отсортированные по времени */
export interface HistoricalCandleSource {
  getSymbolBars(symbol: string): Promise<readonly Candle[]>;
}

export interface AlignedSeries {
  symbols: string[];
  /** bars[symbol][i] — i-й бар; closeTime одинаковый для всех символов на i */
  bars: Record<string, readonly Candle[]>;
  closeTimes: readonly number[];
}
