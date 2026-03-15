# Валидация закрытия 4h-бара и paper-пути

## Исправление (март 2026): последний элемент Binance = формирующаяся свеча

**Причина пустого `lastBarCloseTime` при 20+ ч работы:** в ответе Binance klines массив упорядочен по open time по возрастанию; **последний элемент — всегда текущая (ещё не закрытая) свеча**. Код ошибочно проверял именно её на `closeTime < now`, поэтому почти всегда получал «бар не закрыт» и не вызывал пайплайн. **Исправление:** ищем последнюю строку с `row[6] < now` (последний закрытый бар) и передаём в пайплайн её; в пайплайн передаётся срез `candles[0..lastClosedIdx]`, чтобы `candles[candles.length-1]` был этим баром.

**Быстрая проверка без длинного прогона:**
```bash
cd apps/engine && pnpm exec tsx scripts/validate-4h-klines-closed.ts
```

**После короткого прогона через paper:start:** в аудите возможны `closed_4h_bar_detected` и `bar_processed` при пустом `lastBarCloseTime` в engineState (задержка репликации или порядок чтения). Наличие записей в Firestore logs по bar_processed подтверждает, что пайплайн и `markProcessed` вызываются.

## Почему `lastBarCloseTime` мог оставаться пустым (до фикса)

Пока **последняя** свеча в ответе Binance по интервалу **4h** ещё **формируется**, у неё `closeTime > now` → в runner бар помечается как **не закрытый** → пайплайн **не вызывается** → `markProcessed` / Firestore **не обновляются**. Окно в несколько часов может целиком лежать **внутри одного открытого 4h-бара**.

## Событие, которое обязано произойти

В момент **закрытия 4h-свечи** (UTC-граница 00:00 / 04:00 / … для 4h) при следующем тике движка:

1. Последний ряд klines получает `row[6] < now` → `last.isClosed === true`.
2. Лог **stdout**: `closed_4h_bar_detected — running pipeline`.
3. В Firestore **logs**: сообщение `closed_4h_bar_detected` (+ далее по ветке).
4. Пайплайн: дедуп → стратегия → при необходимости paper `placeOrder` → **`markProcessed`** → **`lastBarCloseTime.{symbol}`** в `engineState`.

## Логи / Firestore после доработки

| Сообщение (logs collection / stdout) | Смысл |
|-------------------------------------|--------|
| `cycle_summary — no closed 4h bar this tick` | Тик прошёл, границы 4h ещё не было |
| `closed_4h_bar_detected` | Закрытый бар есть, пайплайн запущен |
| `bar_pipeline_duplicate_skip` | Этот бар уже обработан ранее |
| `bar_processed` (contextJson: `outcome`) | Бар обработан; смотреть `outcome` |
| `strategy_evaluated — no entry signal` | Входа нет, бар всё равно помечен |
| `paper_entry_placed` / `paper_fill` | Вход (paper) |
| `paper_exit_placed` | Выход |

## План прогона через закрытие 4h

1. Узнать **следующее UTC-время закрытия** текущего 4h BTCUSDT (или ваш universe): часы кратные 4 (0, 4, 8, 12, 16, 20 UTC).
2. **За 5–15 мин до закрытия**: `pnpm run paper:start` (или `LOG_LEVEL=info` в `.env`).
3. **Держать процесс минимум до T+15 мин** после границы (один poll после закрытия достаточен при интервале ≤ 15 мин; при `ENGINE_POLL_INTERVAL_MS=120000` — до T+3 мин обычно хватает одного тика).
4. Остановить по Ctrl+C.
5. Аудит:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=...
export ENGINE_INSTANCE_ID=...
cd packages/storage && pnpm exec tsx scripts/audit-paper-post-run.ts
```

## Доказательства успеха

- В **engineState** появились ключи **lastBarCloseTime** (хотя бы по одному символу).
- В **logs** есть **closed_4h_bar_detected** и хотя бы одна **bar_processed** (или **paper_fill** при сигнале).
- Отсутствие сделок при наличии **bar_processed** + **outcome: no_entry_signal** или **risk_rejected** — **нормально**.

## Одна команда на длинный лог

```bash
cd apps/engine && LOG_LEVEL=info node --env-file=../../.env --import tsx src/main.ts 2>&1 | tee /tmp/paper-bar-close.log
```

(Перед этим один раз `pnpm run paper:bootstrap`, если нужен сброс lease.)
