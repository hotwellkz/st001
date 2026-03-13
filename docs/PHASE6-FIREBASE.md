# Phase 6 — Admin UI + Firebase

## Выбор стека: **Vite + React** (не Next.js)

- Админка за Firebase Auth — типичный SPA.
- **Firebase Hosting** отдаёт статику; SSR не нужен.
- Callable Functions — единственная точка для kill switch / universe / strategy writes.
- Next.js усложнил бы деплой (SSR на Cloud Run или ограниченный static export) без выигрыша для этой панели.

## Маршруты

| Путь | Страница |
|------|----------|
| `/login` | Вход |
| `/` | Dashboard |
| `/strategy` | Strategy (Function) |
| `/universe` | Universe (Function) |
| `/positions` | Позиции (read) |
| `/orders` | Ордера (read) |
| `/fills` | Fиллы (read) |
| `/backtest` | Backtest results (read) |
| `/logs` | Alerts + audit (read) |
| `/health` | engineState (read) |
| `/controls` | Kill switch (Function) |
| `/trading` | Paper/Live (Function) |

## Firestore (использование)

- `engineState/singleton` — halt, lastBar… (пишет только engine/Functions).
- `users/{uid}` — tradingMode (пишет Function).
- `strategyConfigs`, `symbolsUniverse` — пишет только Function.
- `orders`, `fills`, `positions` — пишет engine; клиент только читает (admin).
- `auditLog` — только Functions.
- `backtestResults` — запись из job; чтение admin.

## Роли

- **admin** — custom claim `admin: true` (Firebase Auth). Без него UI не пускает в панель.
- Bootstrap: вызов `adminBootstrapFirstAdmin` с секретом `BOOTSTRAP_ADMIN_SECRET` (один раз).

## Деплой

```bash
# 1. Firebase CLI
npm i -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID

# 2. Functions
cd apps/functions && npm i && npm run build
cd ../..
# Задать секрет bootstrap (опционально)
firebase functions:secrets:set BOOTSTRAP_ADMIN_SECRET

# 3. Web
cp apps/web/.env.example apps/web/.env.local  # заполнить VITE_*
cd apps/web && pnpm i && pnpm build && cd ../..

# 4. Правила + hosting + functions
firebase deploy --only firestore:rules,hosting,functions
```

После деплоя: создать пользователя в Auth → вызвать bootstrap с email → перелогиниться (новый токен с claim).

## Критичные действия

Все через **onCall**: `adminSetKillSwitch`, `adminSetTradingMode`, `adminSaveStrategyConfig`, `adminSaveUniverse`. Клиент **не** пишет в `engineState` (Rules: `allow write: if false`).
