/**
 * Уровни пробоя по уже закрытым барам.
 */

export function previousNBarHigh(
  highs: readonly number[],
  index: number,
  lookback: number
): number | null {
  if (lookback < 1 || index < lookback) return null;
  let m = -Infinity;
  for (let j = index - lookback; j <= index - 1; j++) {
    const h = highs[j];
    if (h === undefined) return null;
    m = Math.max(m, h);
  }
  return Number.isFinite(m) ? m : null;
}

export function previousNBarLow(
  lows: readonly number[],
  index: number,
  lookback: number
): number | null {
  if (lookback < 1 || index < lookback) return null;
  let m = Infinity;
  for (let j = index - lookback; j <= index - 1; j++) {
    const lo = lows[j];
    if (lo === undefined) return null;
    m = Math.min(m, lo);
  }
  return Number.isFinite(m) ? m : null;
}

export function isBreakoutAbove(close: number, prevHigh: number, epsilon = 0): boolean {
  return close > prevHigh + epsilon;
}

export function isBreakdownBelow(close: number, prevLow: number, epsilon = 0): boolean {
  return close < prevLow - epsilon;
}
