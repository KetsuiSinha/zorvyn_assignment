# Finance dashboard (Next.js + TypeScript)

Backend-style API routes for a finance dashboard with **role-based access**, **SQLite persistence** (Prisma ORM + driver adapter), **JWT authentication**, and a **shadcn/ui** front end for manual testing.

This matches the assignment scenario: users, roles (viewer / analyst / admin), financial records, dashboard aggregates, validation, and clear separation between routes and domain logic.

## Roles

| Role | Access |
| ---- | ------ |
| **Viewer** | **Dashboard data only** — KPIs, trends, category totals, recent activity (notes hidden). Cannot list raw records or change data. |
| **Analyst** | **Dashboard + insights** (full summary) and **read-only** access to all financial records (list/filter). Cannot mutate records or users. |
| **Admin** | **Create, update, and delete** records; **create and manage users** (roles, active/inactive); same read access as an analyst. |

## Assumptions

- Records are **global** (not per-tenant); `createdBy` tracks who entered a row.
- Auth is **JWT** (`Authorization: Bearer <token>`), suitable for local development; use HTTPS and secure cookies in production.

## Setup

```bash
cp .env.example .env
# Edit AUTH_SECRET to a long random string (≥16 chars).

npm install
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seeded logins (password `Demo12345!`)

| Email               | Role    |
| ------------------- | ------- |
| `admin@demo.local`  | Admin   |
| `analyst@demo.local`| Analyst |
| `viewer@demo.local` | Viewer  |

## API overview

All JSON responses use `{ error: string }` on failure unless noted.

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| `POST` | `/api/auth/login` | No | `{ email, password }` → `{ token, user }` |
| `GET` | `/api/me` | Yes | Current user |
| `GET` | `/api/users` | Admin | List users |
| `POST` | `/api/users` | Admin | Create user (`email`, `password`, `name`, `role`) |
| `PATCH` | `/api/users/:id` | Admin | Update `name`, `role`, `status` |
| `GET` | `/api/records` | Analyst, Admin | Query: `type`, `category`, `dateFrom`, `dateTo`, `page`, `limit` |
| `POST` | `/api/records` | Admin | Create record |
| `PATCH` | `/api/records/:id` | Admin | Update record |
| `DELETE` | `/api/records/:id` | Admin | Delete record |
| `GET` | `/api/dashboard/summary` | All active roles | Query: `period=week\|month\|year` — totals, category breakdown, trends, recent activity |

## Project layout (high level)

- `prisma/schema.prisma` — `User`, `FinancialRecord`, enums (`Role`, `EntryType`, `UserStatus`).
- `src/lib/rbac.ts` — permission helpers used by route handlers.
- `src/lib/role-capabilities.ts` — human-readable copy for each role (kept in sync with RBAC).
- `src/lib/session.ts` — JWT verification + load user (must be `ACTIVE`).
- `src/lib/dashboard.ts` — aggregation and trend logic for the summary endpoint.
- `src/app/api/**/route.ts` — Route handlers (validation → auth → RBAC → Prisma).
- `src/components/finance-dashboard.tsx` — shadcn UI for login and dashboard.

## Tradeoffs

- **SQLite + `@prisma/adapter-better-sqlite3`** keeps setup simple; Prisma 7 expects a driver adapter for this database.
- **JWT in `localStorage`** is fine for a demo; production apps often prefer httpOnly cookies.
- **No pagination** on dashboard summary; list endpoint supports pagination for records.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run db:migrate` | Prisma migrate |
| `npm run db:seed` | Seed demo users + sample rows |
