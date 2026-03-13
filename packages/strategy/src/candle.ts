/**
 * Доменная свеча. Сигналы только при isClosed === true (закрытый бар биржи).
 */

export interface Candle {
  /** Unix ms открытия */
  openTime: number;
  /** Unix ms закрытия (включительно) */
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export function assertClosed(c: Candle): void {
  if (!c.isClosed) {
    throw new Error("domain: closed candle required for signal logic");
  }
}

/** Уникальный ключ идемпотентности: символ + closeTime (race: один поток на символ или lock снаружи). */
export function candleDedupKey(symbol: string, closeTime: number): string {
  return `${symbol}:${String(closeTime)}`;
}
