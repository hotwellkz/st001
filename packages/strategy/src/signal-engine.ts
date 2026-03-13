/**
 * Движок сигналов на закрытых барах. Long-only.
 * Индекс `i` — последний закрытый бар (в массиве только closed).
 */

import type { StrategyMvpConfig } from "./config.js";
import type { Candle } from "./candle.js";
import { assertClosed } from "./candle.js";
import { smaAt } from "./indicators/sma.js";
import { atrAt } from "./indicators/atr.js";
import {
  previousNBarHigh,
  previousNBarLow,
  isBreakoutAbove,
  isBreakdownBelow,
} from "./indicators/breakout.js";
import type { DomainEvent } from "./events.js";

export interface SignalEngineSeries {
  candles: readonly Candle[];
  config: StrategyMvpConfig;
}

/** Требуемая длина истории: max(sma, breakout, atr) + запас */
export function minBarsRequired(config: StrategyMvpConfig): number {
  return Math.max(config.smaPeriod, config.breakoutLookback + 1, config.atrPeriod + 2) + 1;
}

export function evaluateEntryAtIndex(
  series: SignalEngineSeries,
  i: number
): { entry: true; events: DomainEvent[] } | { entry: false; reason: string } {
  const { candles, config } = series;
  const c = candles[i];
  if (!c) return { entry: false, reason: "index_oob" };
  assertClosed(c);
  const highs = candles.map((x) => x.high);
  const lows = candles.map((x) => x.low);
  const closes = candles.map((x) => x.close);

  const sma = smaAt(closes, i, config.smaPeriod);
  if (sma === null) return { entry: false, reason: "insufficient_sma" };
  if (c.close <= sma) return { entry: false, reason: "trend_filter_fail" };

  const prevHigh = previousNBarHigh(highs, i, config.breakoutLookback);
  if (prevHigh === null) return { entry: false, reason: "insufficient_breakout" };
  if (!isBreakoutAbove(c.close, prevHigh)) return { entry: false, reason: "no_breakout" };

  const atr = atrAt(highs, lows, closes, i, config.atrPeriod);
  if (atr === null || atr <= 0) return { entry: false, reason: "insufficient_atr" };

  const stopPrice = c.close - config.atrStopMult * atr;
  const events: DomainEvent[] = [
    {
      type: "signal_detected",
      symbol: "",
      closeTime: c.closeTime,
      side: "LONG",
      entryRefPrice: c.close,
      stopPrice,
    },
  ];
  return { entry: true, events };
}

export function evaluateExitLongAtIndex(
  series: SignalEngineSeries,
  i: number,
  _entryPrice: number,
  stopPrice: number
): { exit: true; reason: "exit_signal" | "stop"; events: DomainEvent[] } | { exit: false } {
  const { candles, config } = series;
  const c = candles[i];
  if (!c) return { exit: false };
  assertClosed(c);
  const lows = candles.map((x) => x.low);

  if (c.close <= stopPrice) {
    return {
      exit: true,
      reason: "stop",
      events: [
        {
          type: "position_closed",
          symbol: "",
          closeTime: c.closeTime,
          reason: "stop",
          price: c.close,
        },
      ],
    };
  }

  const prevLow = previousNBarLow(lows, i, config.exitLookback);
  if (prevLow !== null && isBreakdownBelow(c.close, prevLow)) {
    return {
      exit: true,
      reason: "exit_signal",
      events: [
        {
          type: "position_closed",
          symbol: "",
          closeTime: c.closeTime,
          reason: "exit_signal",
          price: c.close,
        },
      ],
    };
  }
  return { exit: false };
}
