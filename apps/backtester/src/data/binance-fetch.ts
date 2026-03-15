/**
 * Fetch historical 4h klines from Binance, persist to data dir. No lookahead; bars are closed.
 * Binance limit 1000 per request; we chunk by startTime/endTime.
 */

import { writeFileSync, readFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { BinanceKlineRowDto } from "@pkg/binance";
import { binanceRestForMarketData } from "@pkg/binance";
import { loadEngineEnv } from "@pkg/config";
import type { Candle } from "@pkg/strategy";

const INTERVAL = "4h";
const LIMIT_PER_REQUEST = 1000;
const MS_4H = 4 * 60 * 60 * 1000;

function rowToCandle(row: BinanceKlineRowDto): Candle {
  return {
    openTime: row[0],
    closeTime: row[6],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    isClosed: true,
  };
}

export interface FetchOptions {
  symbols: string[];
  dataDir: string;
  /** Start timestamp ms (inclusive). */
  startTimeMs: number;
  /** End timestamp ms (exclusive). */
  endTimeMs: number;
  baseUrl?: string;
}

export async function fetchAndSaveKlines(options: FetchOptions): Promise<{
  bars: Record<string, Candle[]>;
  closeTimes: number[];
  firstCloseTime: number;
  lastCloseTime: number;
}> {
  let baseUrl = options.baseUrl ?? "https://api.binance.com";
  try {
    const env = loadEngineEnv();
    baseUrl = env.BINANCE_BASE_URL ?? baseUrl;
  } catch {
    // no .env or config; use default
  }
  const rest = binanceRestForMarketData(baseUrl);
  mkdirSync(options.dataDir, { recursive: true });

  const bars: Record<string, Candle[]> = {};
  for (const symbol of options.symbols) {
    bars[symbol] = [];
    let start = options.startTimeMs;
    while (start < options.endTimeMs) {
      const chunk = await rest.getKlines(symbol, INTERVAL, {
        limit: LIMIT_PER_REQUEST,
        startTime: start,
        endTime: options.endTimeMs,
      });
      if (chunk.length === 0) break;
      for (const row of chunk) {
        bars[symbol].push(rowToCandle(row as BinanceKlineRowDto));
      }
      const lastCt = chunk[chunk.length - 1]?.[6];
      if (lastCt == null) break;
      start = lastCt + 1;
      if (chunk.length < LIMIT_PER_REQUEST) break;
    }
  }

  const closeTimesSet = new Set<number>();
  for (const sym of options.symbols) {
    const arr = bars[sym];
    if (arr) for (const c of arr) closeTimesSet.add(c.closeTime);
  }
  const closeTimes = [...closeTimesSet].sort((a, b) => a - b);

  for (const symbol of options.symbols) {
    const arr = bars[symbol];
    if (!arr) continue;
    const path = join(options.dataDir, `${symbol.replace("/", "_")}_4h.json`);
    writeFileSync(
      path,
      JSON.stringify(arr.map((c) => [c.openTime, c.closeTime, c.open, c.high, c.low, c.close, c.volume]))
    );
  }
  const meta = {
    symbols: options.symbols,
    interval: INTERVAL,
    startTimeMs: options.startTimeMs,
    endTimeMs: options.endTimeMs,
    firstCloseTime: closeTimes[0] ?? 0,
    lastCloseTime: closeTimes[closeTimes.length - 1] ?? 0,
    barsPerSymbol: Object.fromEntries(options.symbols.map((s) => [s, bars[s]?.length ?? 0])),
  };
  writeFileSync(join(options.dataDir, "meta.json"), JSON.stringify(meta, null, 2));

  return {
    bars,
    closeTimes,
    firstCloseTime: meta.firstCloseTime,
    lastCloseTime: meta.lastCloseTime,
  };
}

export function loadCandlesFromDataDir(dataDir: string, symbols: string[]): {
  bars: Record<string, Candle[]>;
  closeTimes: number[];
  meta: { firstCloseTime: number; lastCloseTime: number; barsPerSymbol: Record<string, number> };
} {
  const bars: Record<string, Candle[]> = {};
  for (const symbol of symbols) {
    const path = join(dataDir, `${symbol.replace("/", "_")}_4h.json`);
    if (!existsSync(path)) throw new Error(`Missing data file: ${path}. Run backtest:fetch first.`);
    const rows = JSON.parse(readFileSync(path, "utf8")) as [number, number, number, number, number, number, number][];
    bars[symbol] = rows.map((r) => ({
      openTime: r[0],
      closeTime: r[1],
      open: r[2],
      high: r[3],
      low: r[4],
      close: r[5],
      volume: r[6] ?? 0,
      isClosed: true,
    }));
  }
  const metaPath = join(dataDir, "meta.json");
  if (!existsSync(metaPath)) throw new Error(`Missing ${metaPath}`);
  const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
    firstCloseTime: number;
    lastCloseTime: number;
    barsPerSymbol: Record<string, number>;
  };
  const closeTimesSet = new Set<number>();
  for (const sym of symbols) {
    const arr = bars[sym];
    if (arr) for (const c of arr) closeTimesSet.add(c.closeTime);
  }
  const closeTimes = [...closeTimesSet].sort((a, b) => a - b);
  return { bars, closeTimes, meta };
}

/**
 * Align bars so that bars[sym][i] shares the same closeTime for all symbols (by closeTime intersection).
 */
export function alignBarsByCloseTime(
  bars: Record<string, Candle[]>,
  symbols: string[]
): { bars: Record<string, Candle[]>; closeTimes: number[] } {
  const ctSet = new Set<number>();
  for (const sym of symbols) {
    const a = bars[sym];
    if (a) for (const c of a) ctSet.add(c.closeTime);
  }
  const closeTimes = [...ctSet].sort((a, b) => a - b);
  const byCt = new Map<number, Record<string, Candle>>();
  for (const sym of symbols) {
    const arr = bars[sym];
    if (!arr) continue;
    for (const c of arr) {
      if (!byCt.has(c.closeTime)) byCt.set(c.closeTime, {});
      byCt.get(c.closeTime)![sym] = c;
    }
  }
  const aligned: Record<string, Candle[]> = {};
  for (const sym of symbols) aligned[sym] = [];
  const alignedCloseTimes: number[] = [];
  for (const ct of closeTimes) {
    const row = byCt.get(ct);
    if (!row) continue;
    let ok = true;
    for (const sym of symbols) {
      if (!row[sym]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (const sym of symbols) aligned[sym]!.push(row[sym]!);
    alignedCloseTimes.push(ct);
  }
  return { bars: aligned, closeTimes: alignedCloseTimes };
}
