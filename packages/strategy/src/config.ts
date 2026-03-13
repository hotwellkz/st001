/**
 * Все числовые параметры MVP — только здесь. Наружу не «размазываем» магические константы.
 */

export interface StrategyMvpConfig {
  /** Таймфрейм логики (4H) */
  timeframe: "4h";
  /** SMA тренда */
  smaPeriod: number;
  /** Вход: пробой максимума предыдущих N баров (не включая текущий) */
  breakoutLookback: number;
  /** Выход: пробой минимума предыдущих M баров */
  exitLookback: number;
  /** Период ATR (Wilder) */
  atrPeriod: number;
  /** Стоп: atrStopMult * ATR от цены входа (long: ниже) */
  atrStopMult: number;
  /** Доля эквити на сделку при расчёте размера (0.005 = 0.5%) */
  riskPerTradeFrac: number;
  /** Макс. суммарный «риск в работе» как доля эквити (0.06 = 6%) */
  maxPortfolioHeatFrac: number;
  /** Макс. одновременно открытых позиций */
  maxConcurrentPositions: number;
}

/** Дефолт MVP — совпадает с ТЗ */
export const defaultStrategyMvpConfig = (): StrategyMvpConfig => ({
  timeframe: "4h",
  smaPeriod: 200,
  breakoutLookback: 20,
  exitLookback: 10,
  atrPeriod: 20,
  atrStopMult: 2,
  riskPerTradeFrac: 0.005,
  maxPortfolioHeatFrac: 0.06,
  maxConcurrentPositions: 12,
});
