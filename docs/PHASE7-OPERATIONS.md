# Phase 7 — Деплой, CI/CD, эксплуатация

## Release plan (MVP)

| Этап | Содержание | Критерий |
|------|------------|----------|
| **R0** | CI зелёный, правила Firestore задеплоены | Merge только после CI |
| **R1** | Staging: engine paper + Firebase admin | Чеклист pre-paper |
| **R2** | Paper 2+ недели, reconciliation в норме | Чеклист pre-live |
| **R3** | Live (опционально) | Явное включение + чеклист pre-live |

**По умолчанию:** `LIVE_TRADING_ENABLED=false` везде; live только после R3 и ручного подтверждения.

---

## CI/CD

### Предложение

| Компонент | CI (GitHub Actions) | CD |
|-----------|---------------------|-----|
| Monorepo | Lint, format, build, тесты | Ручной или workflow deploy |
| Hosting (web) | Build с `VITE_*` secrets | `firebase deploy --only hosting` |
| Functions | `npm run build` в `apps/functions` | `firebase deploy --only functions` |
| Engine (Cloud Run) | Docker build в CI (опционально) | Deploy в staging/prod отдельными сервисами |
| Правила Firestore | — | `firebase deploy --only firestore:rules` |

### Pipeline (реализовано: `.github/workflows/ci.yml`)

1. `pnpm install`
2. ESLint + Prettier check
3. Сборка пакетов и api/engine/backtester
4. Vitest: binance, storage, strategy, testing, engine, backtester
5. Web build с placeholder `VITE_*` (или secrets в GitHub Environments)

**Не в CI:** реальные Binance ключи, live торговля, длительный paper soak.

---

## Стратегия тестов

| Уровень | Что | Где | Частота |
|---------|-----|-----|---------|
| **Unit** | Индикаторы, фильтры, idempotency, metrics, execution model | Vitest в packages | Каждый PR |
| **Integration** | Paper flow engine, config env | `apps/engine`, `@pkg/testing` | Каждый PR |
| **Paper simulation** | Длительный paper на staging, сравнение логов/ордеров | Staging + ручной/скрипт | Перед live |
| **Regression** | Фиксированный набор баров + ожидаемое число сделок/метрик (snapshot) | Backtester + golden run | Перед релизом engine |

---

## `.env.example`

См. корень репозитория `.env.example` — дополнено переменными **staging / production** (комментарии). Секреты никогда не коммитить.

---

## Secrets management

| Секрет | Где хранить | Кто читает |
|--------|-------------|------------|
| `BINANCE_API_KEY` / `SECRET` | GCP Secret Manager / Cloud Run secrets | Engine (prod/staging) |
| `TELEGRAM_BOT_TOKEN` | Secret Manager | Engine, опционально Functions |
| `BOOTSTRAP_ADMIN_SECRET` | Functions secrets | Только bootstrap |
| Firebase service account | Workload Identity / CI service account | CI deploy, Cloud Run |
| `VITE_FIREBASE_*` | GitHub Actions secrets (build web) | Только build-time |

**Правило:** веб-клиент и репозиторий **не** содержат Binance секретов.

---

## Local / Staging / Production

| | Local | Staging | Production |
|--|--------|---------|------------|
| **Engine** | `ENGINE_TRADING_MODE=paper`, нет live | Paper; те же правила | Paper по умолчанию; live только явно |
| **LIVE_TRADING_ENABLED** | false | false | false до чеклиста |
| **Firestore** | Emulator или dev project | Отдельный project / префикс | Prod project |
| **Binance** | Testnet опционально | Testnet или mainnet read-only | Mainnet только с live |
| **Admin UI** | localhost + dev Firebase | Staging Hosting | Prod Hosting |

---

## Safe deployment flow

1. CI зелёный на ветке релиза.
2. Deploy **rules** → **functions** → **hosting** (или engine образ).
3. Smoke: `/health` API (если используется), admin login, read engineState.
4. Убедиться `emergencyHalt=false` только если намеренно.
5. Мониторинг первые 30–60 мин после деплоя.

---

## Rollback

| Компонент | Действие |
|-----------|----------|
| **Cloud Run engine** | Откат на предыдущий revision (`gcloud run services update-traffic`) |
| **Hosting** | Предыдущий релиз Firebase Hosting (версии в консоли) |
| **Functions** | Redeploy предыдущего коммита или откат версии |
| **Аварийно** | `EMERGENCY_HALT=true` + Admin UI kill switch + остановка Cloud Run |

---

## Monitoring & alerting

| Сигнал | Канал |
|--------|--------|
| Engine не продлевает lease / нет логов | Telegram + GCP Alerting |
| Ошибки Cloud Run (5xx, crash) | Log-based metrics → alert |
| `emergencyHalt` выставлен | Уже стоп; алерт причины в audit |
| Telegram доставка | Пинг при старте engine раз в сутки (опционально) |

**Минимум:** структурированные логи (pino), алерт на ошибки и на отсутствие heartbeat leader.

---

## Incident response (базово)

1. **Стабилизация:** kill switch + при live — отключить трафик на engine.
2. **Сбор:** логи Cloud Run, Firestore audit, последние ордера.
3. **Связь:** зафиксировать время, затронутые символы, PnL приблизительно.
4. **Разбор:** root cause; не включать live до устранения.
5. **Постмортем:** один документ на инцидент.

---

## Pre-paper-trading checklist

- [ ] CI зелёный; unit + integration проходят.
- [ ] Firestore rules задеплоены; клиент не может писать в engineState/orders.
- [ ] Admin bootstrap выполнен; kill switch проверен (вкл/выкл).
- [ ] Engine в **paper**; `LIVE_TRADING_ENABLED=false`.
- [ ] Universe и strategy заданы через Functions.
- [ ] Логи engine видны; Telegram тестовое сообщение.
- [ ] Один инстанс engine (leader lock) или осознанно один реплика.
- [ ] Backtest на том же universe не противоречит здравому смыслу (нет «вечной прибыли» без причины).

---

## Pre-live-trading checklist (обязательно до `LIVE_TRADING_ENABLED=true`)

1. **Юридическое/операционное:** принятие риска; лимиты капитала.
2. **Paper:** минимум **2 недели** paper на staging/prod-окружении без критических багов.
3. **Reconciliation:** процедура ниже отработана вручную хотя бы раз.
4. **Binance:** API key с ограничением IP; права только Spot Trade; withdraw off.
5. **Окружение prod:** секреты только Secret Manager; не в env файлах в образе в plain (mount secrets).
6. **Двойное подтверждение:** Admin UI live + `ackLive` + env на Cloud Run.
7. **Стоп-краны:** kill switch протестирован; дневной лимит потерь (если включён) задан.
8. **Капитал:** старт с минимальным номиналом на 48 ч наблюдения.

---

## MVP acceptance criteria

- [ ] Live **по умолчанию выключен**; включение только после чеклиста pre-live.
- [ ] Kill switch останавливает новые входы (engine читает halt).
- [ ] Все критичные действия админа через Functions.
- [ ] Reconciliation: расхождение `executedQty` / позиция → алерт + ручной разбор до продолжения.
- [ ] CI на main зелёный.
- [ ] Runbook и red flags доступны команде.

---

## Automatic trading stop — red flags

Остановить торговлю (halt + расследование), если:

| Red flag | Действие |
|----------|----------|
| **Reconciliation mismatch** | Немедленно halt; сверка REST `getOrder` / баланс; не размещать новые ордера до согласования. |
| **Двойной ордер** (тот же clientOrderId / дубль позиции) | Halt; проверка idempotency и lock. |
| **Превышение daily loss** | Halt (если реализовано); иначе ручной. |
| **User stream отвалился > N минут** при открытых позициях | Halt новых входов; приоритет сверке позиций. |
| **Ошибки API 429/5xx сериями** | Временный backoff; при live — рассмотреть halt. |
| **Резкий рост проскальзывания** (если метрика есть) | Уменьшить universe / halt. |
| **Несанкционированное изменение env** (live без записи в audit) | Halt + ротация ключей. |

---

## Reconciliation mismatch — процедура

1. Зафиксировать символ, clientOrderId, локальный `executedQty`, биржу `GET /api/v3/order`.
2. Сравнить сумму fills в Firestore с биржей.
3. Если биржа больше — догрузить состояние из биржи в canonical; не дублировать ордера.
4. Если локально больше — ошибка учёта; halt до ручного выравнивания.
5. Запись в audit + Telegram `reconciliation_mismatch`.

---

## Operations runbook (кратко)

| Задача | Шаги |
|--------|------|
| **Включить paper** | `ENGINE_TRADING_MODE=paper`, `LIVE_TRADING_ENABLED=false`, deploy engine, снять halt при необходимости. |
| **Включить live** | Pre-live checklist → Secret Manager ключи → Cloud Run env → Admin ack live → мониторинг 48h. |
| **Аварийный стоп** | Admin kill switch → `EMERGENCY_HALT` → при необходимости scale engine 0. |
| **Деплой web** | `pnpm build` + `firebase deploy hosting`. |
| **Новый admin** | Bootstrap или `setCustomUserClaims` вручную. |
| **Потеря лидерства** | Проверить второй инстанс; один должен быть active; lease в Firestore. |

---

## Документы по фазам

- Phase 2: инфраструктура Binance/Firestore  
- Phase 3: домен стратегии  
- Phase 4: engine orchestration  
- Phase 5: backtest честность  
- Phase 6: admin + rules  
- **Phase 7 (этот файл):** релиз и эксплуатация  
