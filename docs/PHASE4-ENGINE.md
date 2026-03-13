# Phase 4 — оркестрация engine

## Поток (engine flow)

1. **Kill switch** — `EMERGENCY_HALT` или `emergencyHalt` в Firestore → цикл не торгует.
2. **Universe refresh** — список символов (статический или сервис).
3. **По каждому символу** — REST klines 4h, последний бар только если `closeTime < now` (закрытый).
4. **Дедуп по бару** — `BarProcessedStore.getLastCloseTime(symbol) >= last.closeTime` → skip (никогда дважды один бар).
5. **Позиция открыта** — `evaluateExitLongAtIndex` → при выходе MARKET SELL paper + `close` позиции.
6. **Плоско** — `evaluateEntryAtIndex` → idempotency key → `validateEntryRisk` → `broker.placeOrder` BUY.
7. **После успеха** — `markProcessed(symbol, closeTime)` (восстановление при рестарте, если store персистентный).

## Reconciliation (где и что)

- **Файл** `reconciliation.ts`: `reconcileOrderVsBroker` (local executedQty vs `getOrder`), `reconcilePositionVsFills` (qty vs сумма fills).
- **Когда вызывать**: после batch user stream; периодически в цикле (не в MVP runner — хук готов).
- **Partial fills**: user stream `executionReport` — `PARTIALLY_FILLED` / `FILLED`; накопление через `PositionManager.addFill`; полный объём — когда `X === FILLED`.

## Рестарт / recovery

- **Firestore** `engineState.lastBarCloseTime[symbol]` — при старте загрузить в `BarProcessedStore` (MVP memory — для prod подключить `EngineStateRepository.setLastBarCloseTime` после каждого бара).
- **Позиции** — восстановить из `positions` collection + сверка с биржей.
- **Идемпотентность** — ключи в `idempotencyKeys`; при рестарте reserved без complete не должны блокировать новый бар (новый closeTime → новый ключ).

## Live

- `LIVE_TRADING_ENABLED=false` по умолчанию. `LiveBrokerStub` бросает, пока не подключён REST.

## Известные сбои

- Нет Binance creds — цикл пропускает klines (лог).
- Двойной процесс без lock — два лидера; нужен `tryAcquireLeader` перед циклом.
- Paper MARKET SELL без предварительного setLastPrice — может упасть на exit (нужна цена).
