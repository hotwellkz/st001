# Paper-run: операционная проверка

Live выключен: `ENGINE_TRADING_MODE=paper`, `LIVE_TRADING_ENABLED=false`.

---

## 1. Firestore: коллекции, документы, индексы

### Индексы (обязательно до reconcile)

| Коллекция | Поля composite | Статус в Console |
|-----------|----------------|------------------|
| **fills** | `userId` ↑, `symbol` ↑ | **Enabled** |
| **orders** (опц.) | `userId` ↑, `updatedAt` ↓ | Enabled |

Файл: `firestore.indexes.json` → `pnpm run firestore:indexes`.

### Документы и коллекции (появляются при работе)

| Коллекция | Doc id / паттерн | Когда появляется |
|-----------|------------------|------------------|
| **engineState** | `{ENGINE_INSTANCE_ID}` | bootstrap + каждый цикл (lease, `lastBarCloseTime`) |
| **idempotencyKeys** | SHA-ключ (~40 симв.) | Первый entry на новый закрытый бар |
| **orders** | `clientOrderId` | Paper BUY/SELL |
| **fills** | `{userId}_{exchangeOrderId}_{tradeId}` | Каждый paper fill |
| **positions** | `{userId}_{symbol}` | После BUY; SELL → `quantity: "0"` |
| **logs** | auto-id | `paper_fill`, bootstrap |

### Поля, которые должны меняться (норма)

- **engineState**: `leaderLeaseUntil` (продлевается), `leaderHolderId`, `lastBarCloseTime.{SYMBOL}` после закрытого бара, `updatedAt`.
- **positions** (при открытой long): `quantity`, `avgEntryPrice`, `stopPriceQuote`, `clientOrderIdOpen`, `updatedAt`.

### Признаки поломки

| Симптом | Вероятная причина |
|---------|-------------------|
| Ошибка запроса к **fills** | Нет composite index userId+symbol |
| Два процесса пишут одно и то же | Два инстанса с одним `ENGINE_INSTANCE_ID` и оба лидеры (не должно при корректном lease) |
| Позиция есть, reconcile в Telegram | Несовпадение broker / fills — смотреть лог |
| Циклы внезапно прекратились | `emergencyHalt: true` или потерян lease / non-leader |

---

## 2. Env для Firestore paper run

**Обязательно**

| Переменная | Пример |
|------------|--------|
| `GOOGLE_APPLICATION_CREDENTIALS` | абсолютный путь к SA JSON |
| `ENGINE_PERSISTENCE` | `firestore` |
| `ENGINE_INSTANCE_ID` | один на процесс, напр. `paper-1` |
| `ENGINE_LEADER_RENEW_MS` | **&lt; 50%** от `ENGINE_LEADER_LEASE_MS` |

**Рекомендуется**

| Переменная | Пример |
|------------|--------|
| `ENGINE_TRADING_MODE` | `paper` |
| `LIVE_TRADING_ENABLED` | `false` |
| `ENGINE_USER_ID` | стабильный id для позиций, напр. `system` |
| `ENGINE_POLL_INTERVAL_MS` | ≥ `30000` (default 120000) |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_DEFAULT_CHAT_ID` | алерты |

**Не обязательно для klines**

- `BINANCE_API_KEY` / `SECRET` (публичные klines без них).

Загрузка `.env` при запуске из корня: скрипт `pnpm dev:engine` использует `node --env-file=.env`.

---

## 3. Чеклист перед paper-run

- [ ] `pnpm build` без ошибок
- [ ] Firestore БД создана, индекс **fills** Enabled
- [ ] `pnpm run firestore:bootstrap` (или уже есть `engineState/{INSTANCE_ID}`)
- [ ] `.env`: `GOOGLE_APPLICATION_CREDENTIALS`, `ENGINE_PERSISTENCE=firestore`, `ENGINE_INSTANCE_ID`, lease/renew
- [ ] Один запущенный engine на этот `ENGINE_INSTANCE_ID`
- [ ] `LIVE_TRADING_ENABLED=false`
- [ ] (Опц.) Telegram настроен и приходит тестовое сообщение

---

## 4. Чеклист restart-test

- [ ] Запустить engine, дождаться хотя бы одного цикла (лог `cycle timing` / отсутствие ошибок).
- [ ] Остановить процесс (Ctrl+C).
- [ ] Снова запустить **с теми же** `ENGINE_INSTANCE_ID`, `ENGINE_USER_ID`, `GOOGLE_APPLICATION_CREDENTIALS`.
- [ ] Ожидание: лог старта без `non-leader` (если lease истёк — может быть короткое ожидание или сразу лидер).
- [ ] Если была открытая позиция: после рестарта стратегия видит ту же позицию (`stopPriceQuote` в Firestore, восстановление в памяти).

---

## 5. Чеклист halt-test

- [ ] Engine запущен, идут циклы.
- [ ] В Console: Firestore → `engineState` → документ `{ENGINE_INSTANCE_ID}` → поле **`emergencyHalt`** = `true`.
- [ ] В течение ~1–2 интервалов опроса в логах: `emergency halt: engineState.emergencyHalt`, циклы без записи сделок.
- [ ] Выставить `emergencyHalt` = `false` → циклы возобновляются.

---

## 6. Чеклист верификации Firestore (первый час)

| Проверка | OK если |
|----------|---------|
| `engineState/{id}.leaderLeaseUntil` | В будущем относительно «сейчас», обновляется |
| `engineState.{id}.lastBarCloseTime` | По символам из universe растёт при новых 4h барах |
| `idempotencyKeys` | Появляются при сигналах входа, не дублируются на тот же бар |
| `orders` / `fills` | Только после paper-сделок |
| `positions` | Соответствует открытым long; после SELL quantity 0 |
| Индекс fills | Запросы reconcile без ошибки в логах |

---

## 7. Логи: норма / warning / опасно

### Норма

- `engine runner started` с `persistence: firestore`, `pollMs`
- `cycle timing` / `elapsedMs`, `klinesRequests` (debug)
- `duplicate bar skip` (debug) — тот же бар не обрабатывается дважды

### Warning (разобрать)

- `cycle slow vs poll interval` — цикл дольше ~85% интервала → риск rate limit / наложения тиков
- `lost leader lease` / `non-leader` — второй процесс или lease истёк
- `reconcile:` / Telegram `reconciliation_mismatch` — расхождение учёта
- `leader renew skipped` — возможен failover

### Опасно / стоп

- `engine bootstrap failed` — не стартует (env, Firestore, сеть)
- `cycle symbol error` по всем символам — Binance недоступен / бан
- Повторяющиеся `telegram send failed` — алерты не доходят
- `fatal` — любой

---

## 8. Не переходить к 24h paper-run, пока…

- Нет **стабильного** часа без `cycle symbol error` по сети.
- Индекс **fills** не в статусе **Enabled**.
- Не проверены **restart-test** и **halt-test**.
- Запущено **больше одного** engine с одним `ENGINE_INSTANCE_ID` без понимания последствий.
- `LIVE_TRADING_ENABLED` не проверен как `false`.
- (Желательно) Telegram получает хотя бы одно сообщение от engine при тесте.

---

## Команды

```bash
pnpm build
pnpm test
pnpm dev:engine   # из корня, подхватывает .env
```
