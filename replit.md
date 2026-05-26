# Vivi Calc

Калькулятор абонементов лазерной эпиляции для салонов: мастер собирает услуги, выбирает пакет, настраивает рассрочку, фиксирует продажу и генерирует PDF договора-оферты, отправялет по email. Админ управляет услугами, пакетами, перками, продажами и интеграцией с Yclients.

## Стек

- **Backend:** Express 4 + TypeScript (`server/`), запуск через `tsx` в dev, esbuild в prod
- **Frontend:** React 18 + Vite 5 + TypeScript, wouter для роутинга, TanStack Query v5 для данных, Tailwind + shadcn/ui
- **БД:** PostgreSQL (Neon serverless через `@neondatabase/serverless`), ORM — Drizzle
- **Сессии:** `express-session` + `connect-pg-simple` (таблица `session` создаётся автоматически)
- **Auth:** PIN-код, проверка хэша через bcrypt в `server/routes.ts` (роли `master` / `admin`)
- **PDF:** `puppeteer` в `server/services/pdf-generator.ts`
- **Внешний API:** Yclients (`server/services/yclients.ts`) — синк услуг и абонементов

## Структура проекта

```
server/
  index.ts              — bootstrap Express, сессии, Vite middleware в dev / serveStatic в prod
  routes.ts             — все API-роуты + middleware requireAuth / requireAdmin
  storage.ts            — интерфейс IStorage и его реализация поверх Drizzle
  db.ts                 — pg pool + drizzle client
  vite.ts               — dev-интеграция Vite (allowedHosts: true для Replit-прокси)
  services/
    yclients.ts         — клиент Yclients API (services/composites, abonement_types)
    pdf-generator.ts    — генерация HTML и рендер PDF через puppeteer

shared/
  schema.ts             — Drizzle-таблицы + insert-схемы (drizzle-zod) + типы
                          Таблицы: users, config, services, subscription_types,
                                   packages, perks, package_perk_values, clients, sales

client/
  index.html
  src/
    main.tsx, App.tsx       — роутинг (wouter): /admin (только admin), всё остальное → калькулятор
    index.css               — Tailwind + кастомные CSS-переменные
    pages/
      auth.tsx              — вход по PIN
      promo-calculator.tsx  — основная страница мастера (калькулятор + продажа)
      admin.tsx             — админка (настройки, Yclients, пакеты, услуги, юзеры)
      not-found.tsx
    components/
      service-selector.tsx       — выбор услуг и зон
      three-block-comparison.tsx — три пакета (economy/standard/vip) для сравнения
      client-modal.tsx           — ввод данных клиента и фиксация продажи + PDF
      master-sales-modal.tsx     — история продаж мастера
      admin-dashboard.tsx
      admin-perks.tsx            — управление перками пакетов
      admin-sales.tsx            — продажи в админке
      ui/                        — shadcn-компоненты
    hooks/
      use-calculator.ts          — главный стейт калькулятора + загрузка config
      use-package-perks.ts
      use-toast.ts
    lib/
      calculator.ts              — расчёт стоимости / скидок / рассрочки
      queryClient.ts             — настроенный TanStack QueryClient + apiRequest
      utils.ts
```

## Бизнес-логика — где что

- **Расчёт стоимости** — `client/src/lib/calculator.ts`. Применяет bulk discount при `procedureCount >= bulkDiscountThreshold` (значения берутся из `calculatorSettings`).
- **Состояние калькулятора** — `client/src/hooks/use-calculator.ts`. Подтягивает настройки из `/api/config/*`. Дефолтные fallback-значения (если API не ответил): `minimumDownPayment=5000`, `bulkDiscountThreshold=15`, `bulkDiscountPercentage=0.05`, `installmentMonthsOptions=[1..6]`.
- **Настройки админа** хранятся в таблице `config` (key/value json). Ключи: `minimum_down_payment`, `bulk_discount_threshold`, `bulk_discount_percentage`, `installment_months_options`, `yclients`.
- **Продажа** создаётся через `POST /api/subscription` → строка в `sales` с `offerNumber` (формат `MM-YYYY-NNN`, генерируется в `routes.ts::generateUniqueOfferNumber`). Договор-оферта живёт в той же записи `sales` (отдельной таблицы offers нет).
- **PDF** генерится по запросу `POST /api/sales/:id/pdf`, отдаётся `GET /api/pdf/:filename`.

## API кратко

Все защищённые роуты используют middleware `requireAuth` (любой залогиненный) или `requireAdmin` (только role=admin).

- Auth: `POST /api/auth`, `POST /api/logout`, `GET /api/auth/check`
- Услуги/абонементы: `GET /api/services`, `POST /api/services/sync` (admin), `POST /api/subscription-types/sync` (admin)
- Конфиги: `GET /api/config/:key` (admin), `POST /api/config` (admin)
- Пакеты/перки: `GET /api/packages`, `GET /api/perks`, плюс CRUD под `/api/admin/...`
- Продажи: `POST /api/subscription`, `GET /api/master/sales`, `GET /api/admin/sales`, `DELETE /api/admin/sales/:id`
- PDF: `POST /api/sales/:id/pdf`, `GET /api/pdf/:filename`

## Replit setup

- Workflow `Start application`: `npm run dev` → `tsx server/index.ts`, порт **5000**, output `webview`
- Один порт: Express на 5000 отдаёт и API, и Vite-фронт (host `0.0.0.0`)
- `.env`: `PORT=5000`, `NODE_ENV=development`, `SESSION_SECRET`
- `DATABASE_URL` приходит от Replit-managed Postgres
- Vite: `allowedHosts: true` в `server/vite.ts` — обязательно для iframe-прокси

## БД

- Sync схемы: `npm run db:push` (при ошибках — `npm run db:push --force`)
- Не править ID-колонки руками (см. `important_database_safety_rules`).

## Deployment

- Target: `autoscale`
- Build: `npm run build` (Vite собирает фронт + esbuild бандлит сервер в `dist/`)
- Run: `node ./dist/index.cjs`
- В prod `index.ts` использует `serveStatic` вместо Vite middleware

## Заметки

- Пинованные версии под Drizzle: `drizzle-orm@0.39.1`, `drizzle-kit@0.30.6`, `zod@3.24.2`
- НЕ редактировать `package.json` напрямую — пользоваться менеджером пакетов
- НЕ менять `vite.config.ts` и `server/vite.ts` без необходимости
- `puppeteer` тяжёлый, но нужен для PDF — не удалять
