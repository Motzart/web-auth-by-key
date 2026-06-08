# Деплой на Vercel — пошаговая инструкция

Приложение лежит в папке `next-app/`. База данных хранится в **Upstash Redis** (через Vercel Storage) как один JSON-объект с ключом `yubikey:db`.

---

## 1. Подготовка репозитория

Убедись, что проект залит на GitHub / GitLab / Bitbucket (Vercel деплоит из git).

---

## 2. Создать проект на Vercel

1. Зайди на [vercel.com](https://vercel.com) → **Add New…** → **Project**
2. Импортируй репозиторий `yubikey-app`
3. В настройках импорта найди **Root Directory** → нажми **Edit** → выбери **`next-app`**
4. Framework Preset должен определиться как **Next.js** автоматически

---

## 3. Подключить Redis (Storage)

1. В Vercel открой свой проект
2. Вкладка **Storage** → **Create Database**
3. Выбери **Upstash for Redis** (или **Redis** в Marketplace)
4. Имя, например: `yubikey-redis`
5. Регион — ближайший к пользователям (например `Frankfurt` / `eu-central-1`)
6. Нажми **Create**
7. На экране подключения выбери **Connect to Project** → твой проект
8. Подтверди — Vercel **автоматически добавит** переменные:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

> Старые проекты с Vercel KV могут иметь `KV_REST_API_URL` / `KV_REST_API_TOKEN` — код поддерживает оба варианта.

> После подключения Redis **передеплой** проект (Deployments → … → Redeploy), чтобы env попали в runtime.

---

## 4. Добавить переменные окружения вручную

В проекте Vercel: **Settings** → **Environment Variables**

| Переменная | Значение | Environments |
|------------|----------|--------------|
| `SESSION_SECRET` | Случайная строка ≥ 32 символов. Сгенерировать: `openssl rand -base64 32` | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | URL продакшена, например `https://yubikey-app.vercel.app` | Production |
| `NEXT_PUBLIC_APP_URL` | URL preview (можно тот же или оставить пустым — `*.vercel.app` разрешён в коде) | Preview |

Для **Preview** деплоев `*.vercel.app` уже разрешён в `isAllowedOrigin`, поэтому YubiKey будет работать на preview-URL без отдельной настройки.

---

## 5. Деплой

1. Нажми **Deploy** (или сделай `git push` — Vercel задеплоит автоматически)
2. Дождись зелёного статуса **Ready**
3. Открой URL вида `https://твой-проект.vercel.app`

---

## 6. Первый запуск — регистрация YubiKey

1. Открой сайт на **том же домене**, где будешь входить (не localhost)
2. Вкладка **«Первый раз»** → приложи YubiKey
3. Ключ привяжется к `rpId` = hostname Vercel (например `yubikey-app.vercel.app`)
4. Ключи с `localhost` на проде **не работают** — это нормально для WebAuthn

---

## 7. Локальная разработка

```bash
cd next-app
cp .env.example .env.local
# Заполни SESSION_SECRET в .env.local
npm install
npm run dev
```

**Без KV** (локально): данные пишутся в `next-app/data/db.json` автоматически.

**С KV** (как на проде): подтяни env из Vercel:

```bash
npx vercel link          # привязать к проекту
npx vercel env pull .env.local
```

---

## 8. Миграция данных со старого `server/db.json`

Если хочешь перенести пользователей из старого Express-сервера:

1. После первого деплоя открой Redis в **Storage** → **Browse** (Upstash Console)
2. Создай ключ `yubikey:db`
3. Вставь содержимое `server/db.json` как значение (тип JSON/string)

Или через CLI:

```bash
# пример — импорт через redis-cli / Upstash console
```

---

## 9. Чеклист «всё работает»

- [ ] Root Directory = `next-app`
- [ ] Redis подключён к проекту (`UPSTASH_REDIS_REST_URL` есть в env)
- [ ] `SESSION_SECRET` задан (≥ 32 символов)
- [ ] `NEXT_PUBLIC_APP_URL` = продакшен URL
- [ ] Redeploy после добавления env
- [ ] Регистрация YubiKey на продакшен-домене (не localhost)
- [ ] HTTPS — на Vercel включён автоматически (нужен для NFC на iPhone)

---

## 10. Частые проблемы

| Симптом | Решение |
|---------|---------|
| `Unauthorized` после логина | Проверь `SESSION_SECRET` — одинаковый на всех инстансах |
| «Нет ключей для этого адреса» | Ключ зарегистрирован на другом домене — зарегистрируй заново на Vercel URL |
| Данные пропадают | Redis не подключён — проверь Storage → Connected Projects |
| CORS / origin error | Добавь домен в `NEXT_PUBLIC_APP_URL` или используй `*.vercel.app` |
