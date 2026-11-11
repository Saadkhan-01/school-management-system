# School Management System (MERN ERP)

A complete School Management System for a **single school**: a public website +
a secure ERP with 8 roles (Admin, Principal, Teacher, Student, Parent,
Accountant, Librarian, Receptionist). TypeScript throughout, built phase by
phase (Phases 1–10). The honest status of every module — including what is
**Tested** versus only **Implemented** — lives in `docs/feature-tracker.md`,
and the final assessment against the original brief is in
`docs/completion-report.md`.

## Architecture

```
frontend/  React 18 + Vite + Tailwind SPA ──► backend/  Express + Mongoose API ──► MongoDB (Atlas)
                                                  ├─ REST API under /api/v1 (JWT access token +
                                                  │  HttpOnly rotating refresh cookie, bcrypt, RBAC
                                                  │  enforced in services — never just hidden UI)
                                                  ├─ Socket.IO (live notifications, same server/port)
                                                  └─ PDF generation (report cards, receipts, challans,
                                                     payslips, certificates) via pdfkit
```

- **Roles & permissions**: the 8-role matrix (`docs/permissions.md`) is
  enforced in route middleware AND service-level scope checks (anti-IDOR:
  students see only their own record, parents only verified-linked children,
  teachers only assigned classes).
- **Money** is always integer minor units (e.g. `575000` = 5,750.00) — no
  floats anywhere in finance.
- **Honesty rules**: no fake data, no fake payment success. Online payments,
  email/SMS/WhatsApp and file storage are structure-only until real
  credentials are configured (checkout answers 503, channels are no-ops).
- **Degradation**: without a database the API still boots — health works and
  DB-backed routes answer `503 DB_UNAVAILABLE` instead of inventing data.

## Stack
- Frontend: React 18 + TypeScript + Vite + Tailwind CSS + React Router + TanStack Query + Axios + React Hook Form + Zod + Lucide
- Backend: Node + Express + TypeScript + MongoDB/Mongoose + Zod + JWT + bcrypt + Helmet + CORS + rate limiting + Socket.IO + pdfkit/exceljs
- Database: MongoDB Atlas (production) · in-memory MongoDB (tests)

## Prerequisites
Node 20+ (developed on Node 24), npm, a free MongoDB Atlas cluster for real use.

## Setup
```bash
# 1. Database (Atlas): cloud.mongodb.com -> create cluster -> Database Access (create user)
#    -> Network Access (allow your/host IP) -> Connect -> Drivers -> copy SRV URI
# 2. Backend
cd backend && cp .env.example .env   # fill MONGODB_URI + JWT secrets with YOUR values
npm install
# 3. Frontend
cd ../frontend && cp .env.example .env.local
npm install
```

## Run (development)
```bash
# terminal 1
cd backend && npm run dev        # http://localhost:5000  (health: GET /api/v1/health — works even without DB)
# terminal 2
cd frontend && npm run dev       # http://localhost:5173
```

## Creating the first Admin account
Public sign-up is disabled by design (§4). Use the provided seed script —
it reads `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `backend/.env`,
refuses to run without them, and never prints the password:

```bash
cd backend
# set ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD in .env first
npm run seed:admin
```

After that, the Admin creates every other account (Admin-only
`POST /api/v1/auth/register`, or the Users page in the ERP).

## Testing (Phase 10)
The backend has a real automated suite (Vitest + Supertest +
`mongodb-memory-server`): it boots the **real Express app** against a **real
in-memory MongoDB** — no mocks of the app or the database.

```bash
cd backend
npm test              # everything: 58 tests (unit + integration + §36 end-to-end scenario)
npm run test:unit     # pure logic: money math, grading, library fines, provider honesty
npm run test:integration
npm run build && npm run test:probes   # no-DB regression probes (8 checks) against dist/
```

Notes: a standalone in-memory mongod has **no multi-document transactions**,
so the admission→enrollment conversion exercises its documented sequential
fallback in tests (Atlas/production uses the transactional path). In-memory
MongoDB validates logic against real MongoDB semantics but is **not** a
substitute for testing against the school's Atlas environment. If the
`mongodb-memory-server` binary download is unavailable, set
`MONGOMS_SYSTEM_BINARY` to a local `mongod` binary (see
`backend/tests/helpers/testDb.ts`).

## Scripts
| Where | Script | Purpose |
|---|---|---|
| backend | `npm run dev` | dev server (ts-node-dev) |
| backend | `npm run build` / `npm start` | production build / run |
| backend | `npm run typecheck` | `tsc --noEmit` |
| backend | `npm run seed:admin` | create the first Admin from `ADMIN_*` env vars |
| backend | `npm test` / `test:unit` / `test:integration` / `test:probes` | see Testing above |
| frontend | `npm run dev` / `npm run build` | dev server / production build (`tsc` + vite) |
| frontend | `npm run preview` | preview the production build locally |

## Phase status (summary)
Phases 1–9 implemented (public website + CMS, admissions, people, academics,
attendance/timetable/exams, portals, finance, library/transport/inventory/
operations, notifications/messaging/reports/audit). **Phase 10** added the
automated test suite (58 passing), fixed 3 real bugs it exposed, and prepared
deployment. Per-module Tested/Implemented status: `docs/feature-tracker.md`.
Final report: `docs/completion-report.md`.

## Deployment
See `docs/deployment.md` (Atlas → Render → Vercel, step by step, with the
full env table and a pre-launch checklist). Never commit `.env` files or real
secrets.

## Docs
- `docs/requirements.md` · `docs/database-design.md` · `docs/api-documentation.md`
- `docs/permissions.md` (8-role matrix) · `docs/workflows.md` · `docs/deployment.md`
- `docs/feature-tracker.md` (live status) · `docs/completion-report.md` (final §42 report)
