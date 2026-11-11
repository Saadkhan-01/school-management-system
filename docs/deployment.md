# Deployment Guide — School Management System (ERP)

Production topology: **MongoDB Atlas** (database) + **Render** (backend API) +
**Vercel** (frontend). Nothing in this system is deployed yet — this guide is
the exact, step-by-step path. Every step uses accounts/credentials the SCHOOL
must provide (see `docs/completion-report.md` → "What the school must provide").

```
Browser ──► Vercel (React SPA, static) ──► Render (Express API + Socket.IO) ──► Atlas (MongoDB)
                     VITE_API_BASE_URL ───────►  CORS_ORIGIN must equal the Vercel origin
```

---

## 1. MongoDB Atlas (database)

1. Sign in at https://cloud.mongodb.com → **Create a cluster** (M10+ recommended
   for production; the free M0 tier works for a pilot). Pick a region close to
   the Render region.
2. **Database Access → Add New Database User**: username + a strong generated
   password, role `readWrite` on the `school-erp` database only. Save the
   password in a password manager — it goes into the URI and is never committed.
3. **Network Access → Add IP Address**: add Render's outbound access. Render's
   free/static plans do not offer fixed outbound IPs, so most schools use
   `0.0.0.0/0` here — acceptable ONLY together with a strong DB password;
   prefer a paid plan/VPC peering if the school requires a tight allowlist.
4. **Connect → Drivers → Node.js**: copy the SRV connection string, e.g.
   `mongodb+srv://<user>:<password>@<cluster>.mongodb.net/school-erp?retryWrites=true&w=majority`
   — this is `MONGODB_URI` for the backend. Replace `<password>` (URL-encode
   special characters).
5. **Backups**: enable Atlas Cloud Backup (continuous/scheduled snapshots on
   paid tiers). Additionally schedule a periodic logical backup:
   `mongodump --uri "<MONGODB_URI>" --out ./backup-$(date +%F)` stored outside
   Atlas. Test a restore (`mongorestore`) once before go-live — an untested
   backup is not a backup.
6. Atlas runs replica sets, so multi-document **transactions work in
   production** (the admission→enrollment conversion uses its transactional
   path there; the sequential fallback exercised in tests is only for
   standalone MongoDB).

## 2. Backend on Render

1. **New → Web Service**, connect this repository, root directory `backend`.
2. Settings:
   - Runtime: Node 20+
   - Build command: `npm install && npm run build`
   - Start command: `npm start`
   - Health check path: `/api/v1/health` (works without the DB by design, so
     Render won't kill the service during a DB outage).
3. **Environment variables** (Render → Environment). Every variable the code
   reads (audited against `backend/src/config/env.ts` in Phase 10):

   | Variable | Production value | Notes |
   |---|---|---|
   | `PORT` | (Render injects it) | `env.ts` defaults to 5000 locally |
   | `NODE_ENV` | `production` | enables prod behaviours (e.g. reset tokens never exposed) |
   | `MONGODB_URI` | the Atlas SRV URI from step 1 | secret |
   | `JWT_ACCESS_SECRET` | ≥ 32 random chars | secret; rotating it logs everyone out |
   | `JWT_REFRESH_SECRET` | ≥ 32 random chars, DIFFERENT from access | secret |
   | `JWT_ACCESS_EXPIRES_IN` | `15m` | |
   | `JWT_REFRESH_EXPIRES_IN_DAYS` | `7` | |
   | `CORS_ORIGIN` | `https://<your-app>.vercel.app` | exact origin, no trailing slash; multiple origins comma-separated |
   | `COOKIE_SECURE` | `true` | refresh cookie is HttpOnly; Secure requires HTTPS (Render provides it) |
   | `ADMIN_NAME` / `ADMIN_EMAIL` / `ADMIN_PASSWORD` | only for the first-admin seed (step 4) | remove after seeding |
   | `PAYMENT_PROVIDER` / `PAYMENT_GATEWAY_KEY` / `PAYMENT_GATEWAY_SECRET` / `PAYMENT_WEBHOOK_SECRET` | leave EMPTY until the school contracts a gateway | while unset: checkout → 503, webhooks refused, manual payments unaffected |
   | `SMTP_HOST` / `SMTP_USER` / `SMTP_PASSWORD` | leave EMPTY until an SMTP account exists | email channel is a no-op until set + adapter enabled |
   | `SMS_PROVIDER` / `SMS_API_KEY` | leave EMPTY | SMS channel no-op until configured |
   | `WHATSAPP_PROVIDER` / `WHATSAPP_API_KEY` | leave EMPTY | WhatsApp channel no-op until configured |
   | `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | leave EMPTY until a storage account exists | file uploads stay metadata-only until configured |

4. **First admin (production)**: with `ADMIN_*` set in the Render environment,
   open a Render **Shell** and run `npm run seed:admin` (it refuses to run
   without the env vars, creates role `admin`, isVerified, and never prints
   the password). Then log in, verify, and REMOVE the `ADMIN_*` variables.
   There is no public registration — all other accounts are created by this
   admin from inside the ERP.
5. Socket.IO runs on the SAME service/port as the REST API — no extra service
   is needed. (If you later scale beyond one instance, add the Redis adapter
   for Socket.IO and sticky sessions; a single Render instance needs neither.)

## 3. Frontend on Vercel

1. **New Project**, connect this repository, root directory `frontend`.
2. Framework preset: Vite. Build command: `npm run build`. Output: `dist`.
3. Environment variable: `VITE_API_BASE_URL=https://<your-backend>.onrender.com/api/v1`
   (build-time variable — redeploy after changing it).
4. SPA routing: the app is a single-page app; Vercel's Vite preset handles the
   fallback. If deep links 404, add a rewrite of `/*` → `/index.html`.
5. After the first deploy, copy the final Vercel origin into the backend's
   `CORS_ORIGIN` and redeploy the backend. (Custom domain? Set it in both
   places.)

## 4. Production settings checklist (security-relevant)

- [ ] `NODE_ENV=production`, `COOKIE_SECURE=true`
- [ ] `CORS_ORIGIN` is the exact frontend origin (not `*`)
- [ ] JWT secrets are long, random, and different from each other
- [ ] Atlas DB user is `readWrite` on `school-erp` only; password stored in a password manager
- [ ] No secret is committed to git (`.env` files are git-ignored; check `git log` before first push)
- [ ] `ADMIN_*` seed variables removed after the first admin is created
- [ ] Payment/SMTP/SMS/WhatsApp variables left empty unless the real accounts exist (features stay honestly disabled)

## 5. Pre-launch checklist

- [ ] `GET /api/v1/health` on the deployed backend returns `db: "connected"`
- [ ] First admin can log in on the deployed frontend; refresh survives a page reload
- [ ] A smoke pass of the golden path on production: create session/class → register a teacher → public admission → review → approve → enroll → invoice → manual payment → verify → receipt visible to the parent account
- [ ] Atlas backup snapshot exists; one `mongodump` taken and a test `mongorestore` verified
- [ ] The school has decided the open policy items (see completion report): library-fine collection, transport fee billing, auto-invoice on enrollment
- [ ] `npm test` passes locally (58 tests, Phase 10) — re-run after any change
- [ ] Git identity configured and the first commit made (`git config user.name/user.email`), repository pushed to the school's remote

## 6. Local development

See the root `README.md` (setup, scripts, testing). Local runs without a DB
degrade honestly: health works, DB-backed routes answer 503, nothing is faked.
For full local flows point `MONGODB_URI` at a local/Atlas database, or run the
test suite which boots an in-memory MongoDB automatically.
