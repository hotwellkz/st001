/**
 * Синтетические бары для примера/тестов (детерминированный тренд).
 */

import type { Candle } from "@pkg/strategy";

export function syntheticAlignedBars(params: {
  symbols: string[];
  numBars: number;
  seedBase: number;
}): { bars: Record<string, Candle[]>; closeTimes: number[] } {
  const closeTimes: number[] = [];
  const bars: Record<string, Candle[]> = {};
  const t0 = 1_700_000_000_000;
  for (const sym of params.symbols) {
    bars[sym] = [];
    let px = params.seedBase + sym.charCodeAt(0) % 100;
    for (let i = 0; i < params.numBars; i++) {
      px += 2 + Math.sin(i * 0.05) * 0.5 + (i > 50 ? 0.3 : 0);
      const open = px - 0.2;
      const close = px;
      const high = close + 0.4;
      const low = open - 0.2;
      const ct = t0 + i * 4 * 3600_000;
      bars[sym].push({
        openTime: ct - 4 * 3600_000,
        closeTime: ct,
        open,
        high,
        low,
        close,
        volume: 1000,
        isClosed: true,
      });
      if (sym === params.symbols[0]) closeTimes.push(ct);
    }
  }
  return { bars, closeTimes };
}
