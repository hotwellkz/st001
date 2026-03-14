# Первая контролируемая paper-run — отчёт о проверке

## Запуск engine с корня репозитория

`pnpm dev:engine` должен выполняться из **apps/engine** (tsx в зависимостях engine):

```bash
cd apps/engine && node --env-file=../../.env --import tsx src/main.ts
```

либо с корня (скрипт в `package.json`): `pnpm dev:engine`

## Smoke (один цикл без долгого poll)

```bash
cd apps/engine && node --env-file=../../.env --import tsx scripts/paper-smoke-once.ts
```

Firestore + lease (новый `ENGINE_INSTANCE_ID` если основной lease занят):

```bash
cd apps/engine && ENGINE_INSTANCE_ID=smoke-$(date +%s) node --env-file=../../.env --import tsx scripts/paper-smoke-firestore-once.ts
```

## Проверка Firestore

```bash
pnpm --filter @pkg/storage exec tsx scripts/verify-firestore-paper.ts
```

## Первые 60 минут — чеклист

| Время | Логи | Firestore |
|-------|------|-----------|
| 0–5 мин | `engine runner started`, нет `bootstrap failed` | `engineState`: `leaderHolderId`, `leaderLeaseUntil` в будущем |
| 5–30 мин | Периодически циклы; нет спама `cycle symbol error` | `lastBarCloseTime.*` обновляется при новых 4h барах |
| 30–60 мин | Нет `lost leader` при одном процессе | При сделках: `orders`, `fills`, `positions` |

**Стоп-run:** повторяющиеся ошибки Binance, `fatal`, reconcile spam в Telegram без разбора.

## Readiness (строго)

После одного успешного smoke (Binance + опционально Firestore цикл) — **короткий supervised smoke test**.  
24h — только после нескольких часов стабильных циклов одного инстанса и проверок restart/halt.
