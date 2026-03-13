export type { StrategyMvpConfig } from "./config.js";
export { defaultStrategyMvpConfig } from "./config.js";
export type { Candle } from "./candle.js";
export { assertClosed, candleDedupKey } from "./candle.js";
export { smaAt, smaSeries } from "./indicators/sma.js";
export { trueRange, atrSeries, atrAt } from "./indicators/atr.js";
export {
  previousNBarHigh,
  previousNBarLow,
  isBreakoutAbove,
  isBreakdownBelow,
} from "./indicators/breakout.js";
export type { ExchangeOrderConstraints } from "./exchange-constraints.js";
export { floorToStep, roundToTick, satisfiesExchange } from "./exchange-constraints.js";
export {
  sizeLongPosition,
  computeLongStopPrice,
  type SizePositionInput,
  type SizePositionResult,
} from "./sizing.js";
export { portfolioHeatFrac, canOpenNewPosition, type OpenPositionRisk } from "./heat.js";
export type { SymbolEligibility } from "./eligibility.js";
export { isEligibleForEntry } from "./eligibility.js";
export type { DomainEvent } from "./events.js";
export { ProcessedCandleGuard } from "./candle-guard.js";
export { validateEntryRisk, type RiskValidationInput } from "./risk-rules.js";
export {
  minBarsRequired,
  evaluateEntryAtIndex,
  evaluateExitLongAtIndex,
  type SignalEngineSeries,
} from "./signal-engine.js";
