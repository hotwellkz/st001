# Включить Firestore (только владелец проекта)

Сервисный аккаунт **firebase-adminsdk** **не может** включать API и создавать БД — нужен вход под **владельцем** Google-аккаунта проекта **strategydenisa**.

## 1. Включить API (1 клик)

Открой в браузере (залогинься под владельцем):

**https://console.cloud.google.com/apis/library/firestore.googleapis.com?project=strategydenisa**

→ **Enable**.

## 2. Создать базу Firestore

**https://console.firebase.google.com/project/strategydenisa/firestore**

→ **Create database** → режим **Production** (или Test) → регион, например **europe-west1** → **Enable**.

## 3. Firebase CLI (логин — только у тебя в браузере)

```bash
firebase login
firebase use strategydenisa
cd /path/to/st
pnpm run firestore:indexes
pnpm run firestore:bootstrap
```

`firebase login` откроет браузер — войти Google-аккаунтом с доступом к проекту.

## Почему не «само»

| Действие | Кто может |
|----------|-----------|
| Enable API | Owner / Editor проекта (человек в Console) |
| Create database | То же, через Firebase Console |
| Деплой индексов | После `firebase login` |
| Запись в БД | Сервисный аккаунт (после шагов 1–2) |
