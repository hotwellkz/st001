# Phase 2 — инфраструктура

## Решения

- **DTO vs домен**: ответы Binance типизированы в `@pkg/binance` как `*Dto`; документы Firestore в `@pkg/storage` как `*Doc` — отдельно от биржи.
- **Ордер ≠ исполнение**: REST `placeOrder` + user stream `executionReport` + периодический `getOrder` — состояние в `OrderDoc` обновляется после сверки.
- **User data stream**: listenKey + keepalive + reconnect с новым циклом; события — триггер reconciliation.
- **Секреты**: только `loadEngineEnv` / env на сервере; `requireBinanceCredentials` перед клиентом.
- **Блокировки**: см. `packages/storage/src/LOCKING.md` (lease в `engineState`).

## Проверка локально

```bash
pnpm install
pnpm --filter @pkg/binance test
pnpm --filter @pkg/storage test
pnpm --filter @pkg/binance run build
pnpm --filter @pkg/storage run build
```

Firestore: задать `GOOGLE_APPLICATION_CREDENTIALS`, затем в скрипте вызвать `getServerFirestore()` (без тестов против реального Firestore в CI).
