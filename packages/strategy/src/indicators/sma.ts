/**
 * Простая SMA по close. Индекс i — SMA по closes[i-period+1..i].
 */

export function smaAt(closes: readonly number[], index: number, period: number): number | null {
  if (period < 1 || index < period - 1 || index >= closes.length) return null;
  let s = 0;
  for (let j = index - period + 1; j <= index; j++) {
    const v = closes[j];
    if (v === undefined) return null;
    s += v;
  }
  return s / period;
}

export function smaSeries(closes: readonly number[], period: number): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: closes.length }, () => null);
  for (let i = period - 1; i < closes.length; i++) {
    out[i] = smaAt(closes, i, period);
  }
  return out;
}
