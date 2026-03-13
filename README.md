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

### Engine — paper mode (E2E с Firestore)

1. Скопируйте `.env.example` → `.env`.
2. **Только память (klines с Binance, без записи в БД):**  
   `ENGINE_PERSISTENCE=memory` (по умолчанию). Ключи Binance не нужны для свечей.
3. **Paper + Firestore (рекомендуется для многодневного прогона):**
   - Сервисный аккаунт Firebase/GCP, JSON ключ.
   - В `.env`:  
     `GOOGLE_APPLICATION_CREDENTIALS=/abs/path/to/service-account.json`  
     `ENGINE_PERSISTENCE=firestore`  
     `ENGINE_INSTANCE_ID=local-1`  
     `GCP_PROJECT_ID=<id проекта>` (опционально, для логов)
   - В Firestore создаются коллекции: `engineState`, `idempotencyKeys`, `orders`, `fills`, `positions`, `logs`.
4. Запуск:

```bash
pnpm --filter @pkg/config build && pnpm --filter @pkg/binance build && pnpm --filter @pkg/storage build && pnpm --filter @app/engine build
ENGINE_PERSISTENCE=memory pnpm dev:engine
# или с Firestore:
# ENGINE_PERSISTENCE=firestore GOOGLE_APPLICATION_CREDENTIALS=... ENGINE_INSTANCE_ID=local-1 pnpm dev:engine
```

По умолчанию: `ENGINE_TRADING_MODE=paper`, `LIVE_TRADING_ENABLED=false` — live не включать без чеклиста.

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
