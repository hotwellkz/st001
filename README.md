# Crypto trading platform (monorepo)

Node.js + TypeScript, pnpm workspaces. Phase 1 — каркас: API с `/health`, engine/backtester bootstrap, общие пакеты, Docker.

## Требования

- Node.js ≥ 20
- pnpm 9 (`corepack enable`)

## Установка

```bash
cp .env.example .env   # при необходимости поправьте PORT/HOST
pnpm install
```

### Paper engine — один раз для новичка

1. Откройте **Terminal** (macOS).
2. Перейдите в папку проекта: `cd путь/к/st`
3. Один раз: `cp .env.example .env`, откройте `.env` и укажите путь к JSON-ключу в **GOOGLE_APPLICATION_CREDENTIALS**, выставьте **ENGINE_PERSISTENCE=firestore** (или `memory` без ключа).
4. Сборка: `pnpm build`
5. Проверка: `pnpm run paper:check`
6. Запуск: **`pnpm run paper:start`** — это paper-only (live не включается). Остановка: **Ctrl+C**.

Дополнительно: `pnpm run paper:bootstrap` — только сброс lease Firestore. Подробности: [docs/PAPER-RUN-OPERATIONS.md](./docs/PAPER-RUN-OPERATIONS.md).

## Сборка

```bash
pnpm build
# Web (нужны VITE_FIREBASE_*):
# VITE_FIREBASE_API_KEY=x VITE_FIREBASE_AUTH_DOMAIN=x VITE_FIREBASE_PROJECT_ID=x pnpm build:web
```

## Локальный запуск

```bash
# HTTP API + healthcheck
pnpm dev:api
# curl http://127.0.0.1:3000/health

pnpm dev:engine
pnpm dev:backtester

# Статическая оболочка web (без бизнес-логики)
pnpm --filter @app/web dev
```

### Engine — paper mode (ручной запуск)

Предпочтительно для всех: **`pnpm run paper:start`** (см. блок «для новичка» выше).  
Ниже — низкоуровневые команды при необходимости.

Полный чеклист: **[docs/PAPER-RUN-OPERATIONS.md](./docs/PAPER-RUN-OPERATIONS.md)**. Firestore: **[docs/FIRESTORE-PAPER.md](./docs/FIRESTORE-PAPER.md)**.

```bash
pnpm install && pnpm build && pnpm dev:engine
```

**Memory:** `ENGINE_PERSISTENCE=memory` в `.env`. **Firestore:** ключ + `ENGINE_PERSISTENCE=firestore`; индексы: `pnpm run firestore:indexes`.

## Тесты

```bash
pnpm test
pnpm --filter @pkg/binance test
pnpm --filter @pkg/storage test
pnpm --filter @app/backtester test
pnpm --filter @app/backtester run build && node apps/backtester/dist/cli.js --out backtest-out
node apps/backtester/dist/cli.js --walkforward --out backtest-out
```

## Phase 7 — деплой и эксплуатация

- **[docs/PHASE7-OPERATIONS.md](./docs/PHASE7-OPERATIONS.md)** — CI/CD, чеклисты pre-paper / pre-live, red flags, runbook, acceptance.
- **CI:** `.github/workflows/ci.yml` (lint, test, build).
- **Live по умолчанию выключен** — см. чеклист pre-live в PHASE7.

## Линт и формат

```bash
pnpm lint
pnpm format
```

## Docker

Из корня репозитория:

```bash
docker build -f docker/Dockerfile.engine -t trading-engine .
# compose: docker compose build engine
docker run --rm -e LOG_LEVEL=info trading-engine
```

Локально с compose (из корня репозитория):

```bash
docker compose up api
```

Engine: `docker compose up engine` (сборка `docker/Dockerfile.engine`).

## Пакеты (зачем каждый)

| Пакет                | Назначение                                               |
| -------------------- | -------------------------------------------------------- |
| `@pkg/shared`        | Общие типы и graceful shutdown (без Firebase/Binance).   |
| `@pkg/logger`        | Structured logs (pino) для всех сервисов.                |
| `@pkg/config`        | Валидация env (zod) при старте.                          |
| `@pkg/binance`       | Граница интеграции с Binance (Phase 1 — константы/типы). |
| `@pkg/storage`       | Персистентность / порты к Firestore.                     |
| `@pkg/strategy`      | Сигналы и таймфреймы (домен стратегии).                  |
| `@pkg/risk`          | Лимиты и риск (домен).                                   |
| `@pkg/notifications` | Telegram и др. алерты.                                   |
| `@pkg/testing`       | Vitest + интеграционные тесты инфраструктуры.            |

## Приложения

| App               | Роль                                                                             |
| ----------------- | -------------------------------------------------------------------------------- |
| `@app/api`        | HTTP API, `/health`, позже — безопасные маршруты без секретов Binance в клиенте. |
| `@app/engine`     | Торговый цикл (Cloud Run).                                                       |
| `@app/backtester` | Офлайн бэктесты.                                                                 |
| `@app/web`        | Hosting; Phase 1 — только оболочка.                                              |

Секреты Binance не задаются в Phase 1 и никогда не попадают в `@app/web`.
