import type { Candle } from "@pkg/strategy";
import type { BinanceKlineRowDto } from "@pkg/binance";

/** Только закрытые бары: последний ряд с closeTime < now можно считать закрытым при опросе после закрытия. */
export function klineRowToCandle(row: BinanceKlineRowDto, closed: boolean): Candle {
  return {
    openTime: row[0],
    closeTime: row[6],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    isClosed: closed,
  };
}
