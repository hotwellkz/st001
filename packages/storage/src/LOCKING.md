# Distributed lock и безопасная обработка

## Цель

Один активный engine на аккаунт/проект; без дублей ордеров при рестарте или нескольких репликах.

## Стратегия

1. **Leader lease (`engineState`)**
   - Документ `engineState/{instanceId}` (или глобальный `singleton`).
   - Поля: `leaderLeaseUntil`, `updatedAt`.
   - Перед торговым циклом: транзакция — взять лидерство только если `leaderLeaseUntil < now`.
   - Цикл продления lease каждые `leaseMs/2` (например lease 60s → renew каждые 30s).
   - При падении процесса lease истекает → другой инстанс станет лидером.

2. **Идемпотентность ордеров**
   - Уникальный `clientOrderId` на каждую попытку входа.
   - Перед `placeOrder`: `idempotencyKeys` — ключ «символ + бар closeTime + side» — если уже `completed`, не слать второй раз.

3. **User data stream + reconciliation**
   - События не заменяют REST: периодически `GET /api/v3/order` и сверка `executedQty`.
   - Fills пишем по уникальному `(orderId, tradeId)` из executionReport.

4. **Firestore rules**
   - Запись в `orders`/`positions` только с сервера (Admin SDK); клиент read-only где нужно.

## Не делать

- Не полагаться только на ответ `placeOrder` как на «исполнено».
- Не обрабатывать один и тот же бар дважды без idempotency key.
