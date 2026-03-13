/**
 * ATR Wilder: первое значение — среднее TR за period; далее сглаживание.
 */

export function trueRange(high: number, low: number, prevClose: number): number {
  return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
}

export function atrSeries(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  period: number
): (number | null)[] {
  const n = closes.length;
  const out: (number | null)[] = Array.from({ length: n }, () => null);
  if (n < period + 1 || period < 1) return out;

  const tr: number[] = [];
  const h0 = highs[0];
  const l0 = lows[0];
  if (h0 === undefined || l0 === undefined) return out;
  tr[0] = h0 - l0;
  for (let i = 1; i < n; i++) {
    const hi = highs[i];
    const lo = lows[i];
    const pc = closes[i - 1];
    if (hi === undefined || lo === undefined || pc === undefined) return out;
    tr[i] = trueRange(hi, lo, pc);
  }

  let sum = 0;
  for (let i = 1; i <= period; i++) {
    const t = tr[i];
    if (t === undefined) return out;
    sum += t;
  }
  out[period] = sum / period;

  for (let i = period + 1; i < n; i++) {
    const prevAtr = out[i - 1];
    const ti = tr[i];
    if (prevAtr === null || prevAtr === undefined || ti === undefined) break;
    out[i] = (prevAtr * (period - 1) + ti) / period;
  }
  return out;
}

export function atrAt(
  highs: readonly number[],
  lows: readonly number[],
  closes: readonly number[],
  index: number,
  period: number
): number | null {
  const s = atrSeries(highs, lows, closes, period);
  return s[index] ?? null;
}
