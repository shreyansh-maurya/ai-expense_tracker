# AI Expense Tracker

A modern, local-first personal expense tracker built for India — INR-native, budget-aware, with charts and CSV import/export. Single-user by design (no auth yet), runs entirely on your machine with SQLite.

> **Status:** Phase A (M1–M6) — core tracking, dashboard, budgets, CSV. Phase B (AI auto-categorization, key optional) and Phase C (recurring expenses) are shipped. Auth / multi-user is next.

## Features

- **💸 Expense tracking** — add/edit/delete expenses with category, payment method (Cash / Card / UPI / Net Banking / Wallet / Other), merchant and notes
- **🔁 Recurring expenses** — weekly/monthly/yearly templates (any interval, optional end date) whose due occurrences are created automatically whenever you open the app — no cron or scheduler. Pause, resume and skip without losing history
- **✨ Auto-categorization** — deterministic keyword rules always; an OpenAI-compatible AI fills the gaps when `AI_API_KEY` is set (CSV import and a ✨ Suggest button in the form)
- **📊 Dashboard** — monthly total, MoM change, avg/day, top category, 12-month trend chart, category donut, recent expenses
- **🐷 Budgets** — overall + per-category monthly limits with 80% / 100% warning states
- **🏷️ Categories** — full CRUD, colors, archive (delete is guarded when expenses exist), keywords for future auto-categorization
- **📥 CSV import** — upload bank statements, auto-detect column mapping, preview rows, skip duplicates, optionally create missing categories (day-first DD/MM/YYYY dates supported)
- **📤 CSV export** — filtered export with Excel-friendly BOM, plus a starter template
- **🛍️ Wishlist price comparison** — save products from any store, then press **Compare prices** to fetch each product link's live price server-side (JSON-LD / meta / store markup, with one AI pass over the page text as a fallback). Every check is appended to price history, so each store gets a ▼/▲ trend and the all-time low; expand the arrow on a card to see every store's price inline
- **🌗 Dark mode** via `next-themes`

## Tech stack

| Layer      | Choice                                                        |
| ---------- | ------------------------------------------------------------- |
| Framework  | Next.js 15 (App Router, Server Actions) + TypeScript (strict) |
| Styling    | Tailwind CSS v4 + shadcn-style UI components                  |
| Charts     | Recharts                                                      |
| Database   | SQLite via Prisma ORM (file: `prisma/dev.db`)                 |
| Validation | Zod (form inputs, URL filters, server-side re-validation)     |
| Testing    | Vitest (pure logic: money, dates, CSV)                        |

## Key design decisions

- **Money is integer paise** (`amountPaise Int`) — no floats, ever. Indian digit grouping (`₹12,34,567.89`) via a custom formatter, not `Intl`, so tests stay deterministic.
- **Dates are UTC midnight** of the calendar day — no timezone drift for `monthKey` (`YYYY-MM`) aggregations.
- **Payment methods are Zod unions**, not Prisma enums — keeps the schema portable to Postgres later.
- **Server Actions** for all mutations with server-side re-validation; services layer (`src/lib/services`) owns all Prisma access.

## Getting started

```bash
npm install
npx prisma migrate deploy   # creates prisma/dev.db
npm run db:seed:demo        # optional: 238 demo expenses + budgets
npm run dev                 # http://localhost:3000
```

Other scripts:

| Command                | What it does                        |
| ---------------------- | ----------------------------------- |
| `npm run build`        | Production build                    |
| `npm run typecheck`    | `tsc --noEmit`                      |
| `npm run lint`         | ESLint                              |
| `npm test`             | Vitest (money, dates, CSV logic)    |
| `npm run db:studio`    | Prisma Studio GUI                   |
| `npm run db:seed`      | Seed 14 default categories          |
| `npm run db:seed:demo` | Categories + 6 months of demo data  |

## Project structure

```
prisma/            schema, migrations, seed
src/app/(app)/     dashboard, expenses, budgets, settings, import
src/app/api/       CSV export endpoint
src/components/    ui kit, charts, page-level client components
src/lib/           money, dates, csv, validators, services, actions
tests/             vitest unit tests
```

## Deploy: Vercel + Neon (production)

The app ships with two Prisma schemas: `prisma/schema.prisma` (SQLite, local dev) and `prisma/postgres/schema.prisma` (Postgres, production — pooled `DATABASE_URL` + `DIRECT_URL` for migrations). The `vercel-build` script generates the Postgres client, runs `prisma migrate deploy`, seeds the 14 default categories, then builds.

1. **Create a Neon database** at [neon.com](https://neon.com) (free tier) → copy both connection strings (pooled → `DATABASE_URL`, direct → `DIRECT_URL`)
2. **Create a Vercel project** at [vercel.com/new](https://vercel.com/new) importing `shreyansh-maurya/ai-expense_tracker`
3. **Add env vars** in Vercel → Settings → Environment Variables: `DATABASE_URL`, `DIRECT_URL` (include `sslmode=require`)
4. **Deploy** — the build runs migrations + seed automatically; every push to `main` redeploys

Or from the CLI: `npx vercel` (login) → `npx vercel env add DATABASE_URL` / `DIRECT_URL` → `npx vercel --prod`.

## Roadmap

- **Phase B (shipped):** provider-agnostic AI auto-categorization (`AI_PROVIDER` / `AI_MODEL` / `AI_BASE_URL` / `AI_API_KEY` env vars) with a deterministic keyword-rule fallback — no key required to run the app.
- **Phase C (shipped):** recurring expenses — schedules computed from the start-date anchor (month-end clamping), materialized on read instead of a cron job, idempotent thanks to a `(recurringId, date)` unique index, with pause / resume / skip and per-engine migrations (SQLite + Postgres).
- **Price fetching:** product pages are read on demand — the price comes from the store's own buybox data / JSON-LD / price markup, then one AI pass over the page text (needs `AI_API_KEY`). Amazon serves a price-less page to desktop user agents, so Amazon requests use a mobile user agent and read the buybox price data directly. Flipkart renders prices entirely in the browser and returns no price to any server-side request; set `PRICE_FETCH_PROXY_URL` to a scraping gateway URL template containing `{url}` (e.g. `https://api.scraperapi.com?api_key=KEY&render=true&url={url}`) to route those fetches through a gateway that renders JavaScript.
- **Next:** Auth.js multi-user with per-user data (needs a provider choice: OAuth app or email service), an insights page, and a feedback loop where correcting a suggestion retrains the keyword rules.
