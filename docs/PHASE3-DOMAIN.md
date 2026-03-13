# Phase 3 — домен стратегии и риска

## Дизайн

- **Конфиг** (`StrategyMvpConfig`): все пороги и доли — только из объекта конфига (дефолт совпадает с MVP).
- **Свеча**: сигналы только при `isClosed === true`; иначе `assertClosed` бросает — защита от lookahead.
- **Вход long**: `close[i] > SMA200[i]` и `close[i] > max(high[i-20..i-1])`.
- **Выход long**: `close[i] <= stop` или `close[i] < min(low[i-10..i-1])`.
- **Стоп**: `entry - atrStopMult * ATR(20)` (Wilder).
- **Sizing**: `risk$ = equity * riskPerTradeFrac`, `qty = risk$ / (entry - stop)`, округление `stepSize`, проверка `minNotional` / `minQty`.
- **Heat**: сумма `riskFrac` по открытым позициям + новая сделка не выше `maxPortfolioHeatFrac`; плюс лимит `maxConcurrentPositions`.

## Допущения

- ATR — классический Wilder; первое значение на индексе `atrPeriod` — среднее TR с бара 1..period.
- Пробой — по **close** относительно уровня предыдущих N баров (не intrabar).
- Одинаковый `riskFrac` на позицию = доля от эквити, заложенная при входе (0.5%).

## Гонки (race conditions)

- **Двойная обработка одного бара**: ключ `symbol:closeTime` + `ProcessedCandleGuard` в процессе; между процессами — **distributed lock** (Firestore) + тот же ключ в idempotency (Phase 2).
- **Два входа по одному символу**: решает слой оркестрации (одна позиция на символ); домен не хранит портфель.
- **Heat**: пересчёт должен быть под транзакцией/lock перед размещением ордера.

## Edge cases

- Недостаточно баров → нет сигнала / null индикаторы.
- `stopDistance <= 0` → sizing skip.
- Округление `stepSize` может обнулить qty → skip.

## Модули

`packages/strategy/src`: `config`, `candle`, `indicators/*`, `exchange-constraints`, `sizing`, `heat`, `eligibility`, `events`, `candle-guard`, `risk-rules`, `signal-engine`.
