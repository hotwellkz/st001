# Paper engine — команды для оператора

Краткая шпаргалка: как запускать, останавливать и проверять paper engine (Firestore).

## Основные команды

| Команда | Назначение |
|--------|------------|
| **`pnpm run paper:start`** | Запуск движка без ограничения по времени. Работает до ручной остановки (Ctrl+C). При каждом запуске сбрасывает lease и lastBarCloseTime (bootstrap). |
| **`pnpm run paper:bootstrap`** | Только сброс состояния Firestore (lease, lastBarCloseTime). Запускайте отдельно, когда нужен «чистый» старт перед paper:start. |
| **`pnpm run paper:audit`** | Аудит после прогона: engineState, logs, orders/fills/positions, счётчики bar-событий. Берёт .env автоматически. |
| **`pnpm run paper:supervised`** | Запуск с таймером (по умолчанию 6 ч), затем автоостановка и аудит. Для тестовых прогонов. |

## Обычный сценарий: долгий прогон

1. **Запуск** (из корня репозитория):
   ```bash
   pnpm run paper:start
   ```
   Движок запустится и будет работать, пока вы не остановите его.

2. **Проверка, что он жив:** в терминале идут логи (например, `closed_4h_bar_detected`, `cycle_summary`). Остановка не по таймеру — только вручную.

3. **Остановка:** в терминале, где запущен движок, нажмите **Ctrl+C**. Процесс завершится штатно.

4. **Аудит после остановки:**
   ```bash
   pnpm run paper:audit
   ```

## Когда нужен bootstrap

- **Нужен**, если хотите «чистый» старт: сброс lease и lastBarCloseTime. Команда **`paper:start`** уже делает bootstrap при каждом запуске (если не задан `SKIP_BOOTSTRAP=1`).
- **Отдельно** `paper:bootstrap` имеет смысл, если вы сначала сбрасываете состояние, а потом запускаете движок вручную из `apps/engine` без скрипта.

## Когда bootstrap не нужен

- Если вы только что остановили движок и снова запускаете его **без** сброса состояния (сохраняем lastBarCloseTime, но старый lease ещё ~90 с может мешать):
  ```bash
  pnpm run paper:start:no-bootstrap
  ```
  Либо: подождать ~90 с и запустить обычный `paper:start` (он сделает bootstrap и перехватит lease).

## Таймерный прогон (supervised)

Для прогона с ограничением по времени и последующим аудитом:

```bash
# 6 часов (по умолчанию), затем остановка и аудит
pnpm run paper:supervised

# 3 часа
DURATION_SEC=10800 pnpm run paper:supervised
```

Лог пишется в `logs/paper-supervised-<UTC>.log`.

## Требования

- В `.env`: `LIVE_TRADING_ENABLED=false`, `ENGINE_TRADING_MODE=paper`, при `ENGINE_PERSISTENCE=firestore` — путь в `GOOGLE_APPLICATION_CREDENTIALS` и при необходимости `ENGINE_INSTANCE_ID`.
- Проверка окружения: `pnpm run paper:check`.
