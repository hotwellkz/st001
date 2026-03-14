# Supervised 60-minute paper run — операционно

## Перед запуском (обязательно)

1. **Сброс lease** (иначе второй процесс увидит `non-leader: no polls`):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/sa.json
   export ENGINE_INSTANCE_ID=<как в .env>
   pnpm run firestore:bootstrap
   ```
2. Сразу после bootstrap запустить **один** engine на этот `ENGINE_INSTANCE_ID`.
3. **Логи:** для наблюдения циклов — `LOG_LEVEL=debug` (на `info` между опросами почти тишина).
4. **Интервал:** для 60 мин с несколькими циклами при опросе 120s — минимум ~30 циклов; при желании временно `ENGINE_POLL_INTERVAL_MS=60000`.

## Команда engine

```bash
cd apps/engine
LOG_LEVEL=debug ENGINE_POLL_INTERVAL_MS=120000 node --env-file=../../.env --import tsx src/main.ts
```

Или с корня: `pnpm dev:engine` (в `.env` выставить `LOG_LEVEL=debug` на время прогона).

## Что смотреть в логах (норма)

- `engine runner started`, нет `non-leader`
- `klines client ready`
- `cycle timing` — `elapsedMs`, `klinesRequests` = число символов в universe
- Редко `duplicate bar skip` (debug)

## Firestore во время прогона

| Документ / поле | Ожидание |
|-----------------|----------|
| `engineState/{INSTANCE_ID}.leaderLeaseUntil` | В будущем, обновляется |
| `leaderHolderId` | PID-процесса |
| `lastBarCloseTime.{SYMBOL}` | Появляется/растёт, когда для символа обработан **закрытый** 4h бар (если последняя свеча ещё открыта — поле может долго быть пустым) |
| `orders` / `fills` / `positions` | Только при срабатывании стратегии (вход/выход) |

Проверка индекса: `pnpm --filter @pkg/storage exec tsx scripts/verify-firestore-paper.ts`

## Halt-test (процесс запущен)

1. Console → `engineState/{INSTANCE_ID}` → `emergencyHalt` = **true**
2. В логах на следующем тике: `emergency halt: engineState.emergencyHalt`
3. `emergencyHalt` = **false** → циклы снова идут

## Ограничение среды

Полные **60 минут** в одной автоматической сессии CI/агента часто недоступны. Имеет смысл гнать engine **локально** в отдельном терминале 60 мин и параллельно смотреть логи + Console.

## Readiness после успешного 60 мин

Один стабильный процесс, нет спама ошибок Binance, `lastBarCloseTime` или сделки появляются согласно рынку → **готовность к 3–6 h supervised**; 24h — только после нескольких часов без инцидентов.
