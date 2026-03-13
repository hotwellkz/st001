# Firestore — paper engine

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

1. **fills** — composite:
   - Поля: `userId` (Ascending), `symbol` (Ascending)
   - Query: `where('userId','==',…).where('symbol','==',…)` в `netFilledQty`

Создание: Firebase Console → Firestore → Indexes → Composite, или ссылка из ошибки в логах при первом запуске.

2. **positions** — single-field `userId` (часто уже есть) для `listOpenPaperPositions`.

## Аварийный стоп без рестарта

В документе `engineState/{ENGINE_INSTANCE_ID}` установите:

```json
{ "emergencyHalt": true }
```

Движок перестаёт выполнять циклы при следующем чтении (каждый тик). Снятие: `emergencyHalt: false` или удалить поле.

## Пример Firestore Rules (клиентский доступ к engine не нужен)

Engine пишет через Admin SDK (правила не для SA). Для web оставьте deny по умолчанию на эти коллекции.
