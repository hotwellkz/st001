# Отчёт: расширение универсума до 4 символов (BTC, ETH, SOL, BNB)

**Дата:** 2025-03-13  
**Цель:** Проверка робастности стратегии на расширенном наборе ликвидных пар (BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT) без изменения правил стратегии и исполнения.

---

## Механизм передачи символов

- **Fetch:** аргумент CLI `--symbols BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT` (в package.json по умолчанию только BTC,ETH для `backtest:fetch`; для 4 символов команда вызывалась вручную с полным списком).
- **Run / OOS / Walk-forward / Robustness:** тот же аргумент `--symbols`; при запуске без него используется значение по умолчанию в `cli.ts` (`BTCUSDT,ETHUSDT`).
- **Скрипт робастности:** второй аргумент скрипта — список символов: `bash scripts/backtest-robustness-matrix.sh backtest-out "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT"`.

Изменения в коде: только доработка `scripts/backtest-robustness-matrix.sh` для поддержки опционального второго аргумента `SYMBOLS` и передачи `--symbols "$SYMBOLS"` во все прогоны.

---

## Выполненные команды

1. **Fetch:**  
   `pnpm --filter @app/backtester exec node --import tsx src/cli.ts --fetch --data-dir backtest-data --symbols BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT --years 5`
2. **Основной бэктест:**  
   `... --data-dir backtest-data --out backtest-out --symbols BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT`
3. **OOS 70/30:**  
   `... --oos 0.3 --symbols BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT`
4. **Walk-forward:**  
   `... --walkforward --symbols BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT`
5. **Матрица робастности:**  
   `bash scripts/backtest-robustness-matrix.sh backtest-out "BTCUSDT,ETHUSDT,SOLUSDT,BNBUSDT"`
6. **По символам:**  
   для каждого из BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT: `... --symbols <SYM>`

Данные загружались заново (fetch для 4 символов). Существующие данные в `backtest-data` перезаписаны.

---

## Данные

- **Источник:** Binance REST API, 4h klines.
- **Символы:** BTCUSDT, ETHUSDT, SOLUSDT, BNBUSDT.
- **Выровненных баров:** 10 956 (по пересечению closeTime).
- **Период:** 2021-03-15 … 2026-03-15 (≈5 лет).
- **Каталог данных:** `apps/backtester/backtest-data/` (файлы `*_4h.json`, `meta.json`).

---

## Baseline (4 символа)

| Метрика | Значение |
|--------|----------|
| Return % | 90,58 |
| CAGR % | 14,04 |
| MaxDD % | 18,84 |
| Trades (round trips) | 460 |
| Win rate | 32,8 |
| Profit factor | 1,41 |
| Sharpe | 0,90 |
| Sortino | 0,64 |
| Exposure (доля баров в позиции) | 47,2% |
| Longest drawdown (баров) | 2584 |

---

## Пессимистичные сценарии (fee/slippage bps)

| Сценарий | Return % | MaxDD % | Trades | Sharpe |
|----------|----------|---------|--------|--------|
| Baseline (10/5) | 90,58 | 18,84 | 460 | 0,90 |
| 15/10 | 66,25 | 20,27 | 461 | 0,73 |
| 20/20 | 35,35 | 23,01 | 462 | 0,46 |
| 25/25 | 17,89 | 25,33 | 463 | 0,29 |
| 30/30 | 2,24 | 27,06 | 464 | 0,11 |

При 30/30: PF ≈ 1,01, CAGR ≈ 0,45%, expectancy ≈ 3,4 — край почти исчезает.

---

## OOS и Walk-forward

- **OOS 70/30:** in-sample return 69,72%, OOS return **10,58%** (положительный), OOS MaxDD 13,86%, OOS сделок 131.
- **Walk-forward (4 окна):** return по окнам 42,69%, 2,87%, 15,95%, 12,28%. Все окна неотрицательные; одно окно дало лишь +2,87%.

---

## По символам (изолированные прогоны)

| Символ | Return % | MaxDD % | Trades | Sharpe |
|--------|----------|---------|--------|--------|
| BTCUSDT | 34,36 | 6,98 | 107 | 1,05 |
| ETHUSDT | 25,42 | 7,72 | 111 | 0,84 |
| SOLUSDT | 18,01 | 10,66 | 125 | 0,61 |
| BNBUSDT | 10,00 | 8,52 | 119 | 0,37 |

В совокупном прогоне по 4 символам вклад по PnL: BTC 32,8k, ETH 30,1k, SOL 14,9k, BNB 11,1k. Результат не завязан на одном инструменте; все четыре дают положительный вклад.

---

## Вердикт

**Promising but fragile** (перспективно, но хрупко).

- Расширение на SOL и BNB сохраняет положительную доходность и положительный OOS; все четыре символа по отдельности прибыльны.
- При ужесточении комиссий/проскальзывания (30/30 bps) запас прочности заметно меньше, чем на 2 символах: return падает до ~2,24% против ~16% при двух символах.
- Рекомендация: продолжать осторожную бумажную проверку; при выходе на большее число инструментов или худшие условия исполнения учитывать повышенную чувствительность к издержкам.

---

## Изменённые файлы

- `scripts/backtest-robustness-matrix.sh` — добавлена поддержка второго аргумента `SYMBOLS` и передача `--symbols` во все прогоны.
- `docs/BACKTEST-ROBUSTNESS-4SYMBOLS.md` — создан данный отчёт.
