# 🚀 Ora Pads — Unified Control & Impact Platform

A controlled distribution, donation and education platform for Ora Pads — **not** a normal online shop. Stock, pricing and financial decisions are fully governed by admin, while partners and users operate through a structured, **request-based** system. No public pricing. No retail checkout.

Built as a single, production-ready Next.js application.

---

## ✨ What's inside

| Area | Highlights |
| --- | --- |
| 🔐 **One login, three roles** | Admin · Agent/Partner · General User, with automatic role-based routing |
| 🏭 **Inventory engine** | Every stock movement (inbound → assigned → distributed → restocked) is an immutable ledger entry. No invisible stock. |
| 📩 **Request-based orders** | No cart, no checkout, no public prices. Submit → admin prices → admin approves → fulfil. |
| 💰 **Credit system** | Admin-approved pay-later orders with manual repayment tracking and progress. |
| 🔁 **Returns** | User/agent returns require admin approval, then auto-restock the warehouse. |
| 💝 **Donations** | Guest or member donations (pads or money), preset packages, full distribution tracking. |
| 📚 **Education hub** | Menstrual-health articles in English & Kiswahili, category filtering, admin authoring. |
| 📅 **Period tracker** | Private cycle logging with next-period prediction, fertile window and health tips. |
| 📊 **Admin dashboard** | SaaS-grade overview: live stock, request queue, donations, credit, returns, users, full activity log. |
| 🧾 **Activity log** | Append-only audit trail of every state change across the platform. |

---

## 🧱 Tech stack

- **Next.js 15** (App Router, Server Components, Server Actions) + **React 19**
- **TypeScript** (strict)
- **Prisma ORM** + **PostgreSQL**
- **Auth.js v5 (NextAuth)** — credentials, JWT sessions, role in token, edge middleware
- **Tailwind CSS** + a hand-built shadcn-style component library
- **bcryptjs**, **Zod**, **date-fns**, **lucide-react** — charts are hand-rolled SVG/CSS (zero chart deps)

---

## 🛠️ Getting started

### Prerequisites
- Node.js **18.18+** (tested on 20.x)
- A running **PostgreSQL** instance (local Homebrew Postgres or Neon)

### 1. Install
```bash
npm install
```

### 2. Configure environment
A local `.env` is already provided. Adjust `DATABASE_URL` to your Postgres, and set a fresh `AUTH_SECRET` for anything non-local:
```bash
# .env
DATABASE_URL="postgresql://USER@localhost:5432/ora?schema=public"
AUTH_SECRET="$(openssl rand -base64 33)"
AUTH_TRUST_HOST="true"
NEXTAUTH_URL="http://localhost:3000"
```

### 3. Create the database (local)
```bash
createdb ora            # if it doesn't exist yet
```

### 4. Push schema + seed demo data
```bash
npm run db:push         # sync Prisma schema to the database
npm run db:seed         # load demo accounts, products, stock, requests, donations…
```

### 5. Run
```bash
npm run dev             # http://localhost:3000
```

---

## 👤 Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@orapads.org` | `Admin@123` |
| Agent / Partner | `agent@orapads.org` | `Agent@123` |
| General User | `user@orapads.org` | `User@123` |

> A second agent (`grace@orapads.org`) and a **pending** partner (`partner@orapads.org`, `Partner@123`) exist to demo the approval flow. Pending partners cannot log in until an admin activates them.

---

## 📜 Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build (type-checked) |
| `npm start` | Run the production build |
| `npm run db:push` | Sync schema to the database |
| `npm run db:seed` | Seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:reset` | **Wipe** & re-seed the database |
| `npm run typecheck` | `tsc --noEmit` |

---

## 🗂️ Project structure

```
app/
  (public)/        Landing, donate, education, education/[slug], impact
  (auth)/          login, request-access  (centred brand layout)
  admin/           Admin console (overview, inventory, requests, donations,
                   credit, returns, users, education, activity)
  agent/           Partner portal (overview, catalogue, request, orders,
                   credit, returns)
  dashboard/       User account (overview, request, requests, donations, tracker)
  api/auth/        Auth.js route handler
components/
  ui/              Design system (button, card, table, dialog, charts, …)
  public/ auth/ admin/ dashboard/ brand/   Feature components
lib/
  actions/         Server actions (auth, requests, inventory, donations,
                   credit, returns, users, products, education, cycle)
  services/        inventory.ts — the single source of truth for stock maths
  db.ts rbac.ts activity.ts stats.ts utils.ts types.ts
prisma/
  schema.prisma    Full data model
  seed.ts          Demo data
auth.ts auth.config.ts middleware.ts
```

---

## 🔑 Key concepts

**Request lifecycle**
`PENDING` → (admin prices) → `PRICED` → (admin approves, stock reserved) → `APPROVED` → (admin fulfils, stock distributed) → `FULFILLED`. Can be `REJECTED` or `CANCELLED` while still open.

**Inventory is a ledger.** Stock only ever changes through `applyMovement()` in `lib/services/inventory.ts`, which writes an immutable `StockMovement` *and* reconciles the `Inventory` snapshot in one transaction. Warehouse + assigned + distributed always reconciles.

**No public pricing.** Products carry **no price column**. Prices live on `RequestItem.unitPrice` and are assigned per-request by admin — only visible to the requester after pricing/approval.

**Admin is the only financial authority.** Pricing, approvals, credit issuance, repayment recording and returns are all gated to the `ADMIN` role (enforced in middleware *and* in every server action via `requireActor`).

---

## ☁️ Deploying with Neon (production)

1. Create a Neon project and copy the **pooled** connection string.
2. Set `DATABASE_URL` to it, set a strong `AUTH_SECRET`, and `NEXTAUTH_URL` to your domain.
3. `npm run db:push` (or generate a migration with `prisma migrate deploy`).
4. `npm run build && npm start`, or deploy to Vercel.

---

Built for impact — request-based distribution, full admin governance, dignity in every cycle.
