# YubiKey Auth — Next.js

Единое Next.js-приложение с WebAuthn (YubiKey) и хранением данных в Upstash Redis (Vercel Storage).

## Структура

```
next-app/
├── app/                  # страницы и API routes
├── components/           # UI компоненты
├── lib/
│   ├── server/           # бизнес-логика (WebAuthn, DB, сессии)
│   └── client/           # браузерный WebAuthn клиент
└── data/                 # локальный fallback db.json (без KV)
```

## Запуск локально

```bash
npm install
cp .env.example .env.local
# SESSION_SECRET=... (openssl rand -base64 32)
npm run dev
```

Открой http://localhost:3000

## Деплой на Vercel

Подробная инструкция: **[VERCEL_SETUP.md](./VERCEL_SETUP.md)**

Кратко:
1. Root Directory → `next-app`
2. Storage → Create Upstash Redis → Connect to Project
3. Env: `SESSION_SECRET`, `NEXT_PUBLIC_APP_URL`
4. Deploy
