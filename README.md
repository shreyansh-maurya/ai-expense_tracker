# AI Expense Tracker

A modern, local-first personal expense tracker built for India — INR-native, budget-aware, with charts and CSV import/export. Single-user by design (no auth yet), runs entirely on your machine with SQLite.

> **Status:** Phase A (M1–M6) — core tracking, dashboard, budgets, CSV. AI-assisted categorization (Phase B) is optional and comes next.

## Features

- **💸 Expense tracking** — add/edit/delete expenses with category, payment method (Cash / Card / UPI / Net Banking / Wallet / Other), merchant and notes
- **📊 Dashboard** — monthly total, MoM change, avg/day, top category, 12-month trend chart, category donut, recent expenses
- **🐷 Budgets** — overall + per-category monthly limits with 80% / 100% warning states
- **🏷️ Categories** — full CRUD, colors, archive (delete is guarded when expenses exist), keywords for future auto-categorization
- **📥 CSV import** — upload bank statements, auto-detect column mapping, preview rows, skip duplicates, optionally create missing categories (day-first DD/MM/YYYY dates supported)
- **📤 CSV export** — filtered export with Excel-friendly BOM, plus a starter template
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

- **M7+ (Phase B, optional):** provider-agnostic AI auto-categorization (`AI_PROVIDER` / `AI_MODEL` / `AI_BASE_URL` / `AI_API_KEY` env vars) with a deterministic keyword-rule fallback — no key required to run the app.
- **Later (Phase C):** recurring expenses, Auth.js multi-user, Postgres (Neon) deployment.
