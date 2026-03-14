# Firestore — paper engine

## Перед bootstrap

1. **Firebase Console** → проект **strategydenisa** → **Build → Firestore** → **Create database** (режим Production или Test, регион). Это включает API и создаёт БД.
2. При ошибке `SERVICE_DISABLED` / Firestore API: [включить API](https://console.developers.google.com/apis/api/firestore.googleapis.com/overview?project=strategydenisa).

## Сервисный аккаунт (минимальные права)

- Отдельный SA **только для engine** (не общий admin).
- Рекомендуется **Custom role** с правами:
  - `datastore.documents.get`, `create`, `update` (или `datastore.documents.*`) **только** на нужные коллекции — в Firestore Rules ограничьте `request.auth == null` не используйте; для Admin SDK правила не применяются → права только через **IAM + отдельный проект/DB** или **VPC + ограничение ключей**.
- Практично для paper: отдельный Firebase-проект «paper», SA с ролью **Cloud Datastore User** на этот проект; JSON-ключ хранить в Secret Manager / не в git.
- **Не** кладите ключ в репозиторий. Ротация ключа при компрометации.

## Коллекции (engine paper)

| Коллекция          | Назначение |
|--------------------|------------|
| `engineState`      | Документ id = `ENGINE_INSTANCE_ID`: lease (`leaderLeaseUntil`, `leaderHolderId`), `lastBarCloseTime`, `emergencyHalt` |
| `idempotencyKeys`  | Ключи входа по бару |
| `orders`           | Paper ордера, doc id = `clientOrderId` |
| `fills`            | Исполнения; doc id см. `FillsRepository.docId` |
| `positions`        | Позиции paper; doc id = `{userId}_{symbol}` |
| `logs`             | События `paper_fill` и др. |

## Индексы (обязательно для reconciliation)

В репозитории уже описаны в **`firestore.indexes.json`** (коллекция **fills**: `userId` + `symbol`).

Деплой (из корня, Firebase CLI залогинен в нужный проект):

```bash
firebase use strategydenisa   # или ваш project id
pnpm run firestore:indexes
```

Либо вручную: Console → Firestore → Indexes → Composite → collection `fills`, поля `userId` Asc, `symbol` Asc.

## Bootstrap коллекций / engineState

Коллекции появятся сами при первой записи engine. Чтобы сразу был документ `engineState` и тестовый лог:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/sa.json
export ENGINE_INSTANCE_ID=strategydenisa-paper-1   # как в .env
pnpm --filter @pkg/storage run firestore:bootstrap
```

Затем **`pnpm run firestore:indexes`** и дождаться статуса индекса **Enabled** (1–5 минут).

Операционные чеклисты: **[PAPER-RUN-OPERATIONS.md](./PAPER-RUN-OPERATIONS.md)**.

## Аварийный стоп без рестарта

В документе `engineState/{ENGINE_INSTANCE_ID}` установите:

```json
{ "emergencyHalt": true }
```

Движок перестаёт выполнять циклы при следующем чтении (каждый тик). Снятие: `emergencyHalt: false` или удалить поле.

## Пример Firestore Rules (клиентский доступ к engine не нужен)

Engine пишет через Admin SDK (правила не для SA). Для web оставьте deny по умолчанию на эти коллекции.
