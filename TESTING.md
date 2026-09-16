# Arise Backend — Testing & Reference

## What was built and why

This is the real Node/Express/TypeScript backend for the Arise admin portal
(and, eventually, the mobile app), built from scratch against the exact
endpoint contracts already documented as `// TODO: API - replace with real
endpoint` comments throughout `Arise-Admin`. Since no Supabase project exists
yet, the data layer is built behind a `UserRepository` / `TaskRepository` /
`ReviewRepository` / `DashboardRepository` abstraction (`src/db/repository.ts`)
with two interchangeable drivers: an in-memory driver (`src/db/memory/*`,
seeded with realistic data at process startup — 26 users including one
seeded admin, 15 tasks covering every verification method, pending reviews,
transactions, referrals, coupons, etc.) and a Supabase/Postgres driver
(`src/db/supabase/*`, code-complete against `supabase/migrations/0001_init.sql`
but untested live, since no Supabase credentials exist). Switching between
them is a single env var (`DB_DRIVER=memory|supabase`) — no route, controller,
or service code changes. Auth is custom JWT (15m access / 30d refresh,
rotated-on-use and revocable) against `bcryptjs`-hashed passwords, with admin
accounts living in the same `users` table as regular app users (`role='admin'`),
matching the frontend's existing dev-mock admin shape.

## Setup

```bash
cd Arise-Backend
npm install
cp .env.example .env
npm run dev
```

The server listens on `http://localhost:4000` by default; all routes are
under `/api/v1` (matching `NEXT_PUBLIC_API_URL`'s default in Arise-Admin).

### Environment variables (`.env.example`)

| Variable | Meaning |
|---|---|
| `PORT` | HTTP port the Express server listens on (default `4000`). |
| `JWT_ACCESS_SECRET` | HMAC secret used to sign/verify access tokens. |
| `JWT_REFRESH_SECRET` | HMAC secret used to sign/verify refresh tokens (kept separate from the access secret so leaking one doesn't compromise the other). |
| `JWT_ACCESS_EXPIRES_IN` | Access token lifetime (default `15m`). |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime (default `30d`). |
| `DB_DRIVER` | `memory` or `supabase`. If unset, defaults to `memory` unless both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, in which case it defaults to `supabase`. |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Required only when `DB_DRIVER=supabase`. |
| `CORS_ORIGIN` | Allowed origin for the admin portal (default `http://localhost:3000`). |

### npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | `tsx watch src/index.ts` — dev server with hot reload. |
| `npm run build` | `tsc` — compiles `src/` to `dist/` (CommonJS). |
| `npm start` | `node dist/index.js` — runs the compiled build. |
| `npm run seed` | `tsx src/seed/run.ts` — seeds a **Supabase** database with the same demo data the memory driver generates in-process. No-ops (with a message) if `DB_DRIVER` isn't `supabase`, since the memory driver self-seeds automatically on every boot. |

## Endpoint reference

Base path: `/api/v1`. Every response uses the envelope
`{ success: true, data: T }` or `{ success: false, error: { code, message } }`.
All examples below are real output captured from a local `npm run dev` run
against the seeded in-memory data (values like ids/timestamps will differ on
your own seeded run, since some ids are timestamp-based).

### Auth (public)

| Method | Path | Auth | Body | Example response |
|---|---|---|---|---|
| POST | `/auth/login` | none | `{ email, password }` | `{"success":true,"data":{"user":{"id":"usr_1000","hunterId":"HTR-00001","displayName":"Dev Admin","email":"admin@arise.com","level":99,"xp":999999,"rank":"mythic",...,"role":"admin",...},"accessToken":"eyJ...","refreshToken":"eyJ..."}}` |
| POST | `/auth/refresh` | none | `{ refreshToken }` | `{"success":true,"data":{"accessToken":"eyJ...","refreshToken":"eyJ..."}}` (old refresh token is revoked; reusing it returns 401 `invalid_refresh_token`) |
| POST | `/auth/logout` | none | `{ refreshToken }` | `{"success":true,"data":{"success":true}}` |

Login failure modes observed: wrong password → `401 {"success":false,"error":{"code":"invalid_credentials","message":"Invalid email or password"}}`; correct credentials for a non-admin user → `403 {"success":false,"error":{"code":"not_admin","message":"Access denied: admin role required"}}`; malformed body (e.g. missing password) → `400 {"success":false,"error":{"code":"validation_error","message":"..."}}`.

### All `/admin/*` routes require `Authorization: Bearer <accessToken>` for an admin user (401 if missing/invalid token, 403 if the token's user isn't role `admin`).

#### Dashboard

| Method | Path | Example response |
|---|---|---|
| GET | `/admin/dashboard/kpis` | `{"success":true,"data":{"totalUsers":26,"activeToday":14,"newSignupsToday":3,"activeSubscriptions":18,"tasksCompletedToday":47,"openFeedbackTickets":5,"totalUsersDelta":4.2,"activeTodayDelta":-2.1,"newSignupsTodayDelta":12.5,"activeSubscriptionsDelta":1.8,"tasksCompletedTodayDelta":6.4,"openFeedbackTicketsDelta":-8.3}}` |
| GET | `/admin/dashboard/subscriptions` | `{"success":true,"data":{"mrr":8420,"activeSubscribers":18,"newSubsToday":2,"newSubsWeek":9,"churnedThisWeek":3,"trialToPaidPct":62,"statusBreakdown":[{"status":"Active","count":18},...]}}` |
| GET | `/admin/dashboard/mrr-trend?days=90` | `{"success":true,"data":[{"date":"2026-06-18","value":3372},...]}` (90 points) |
| GET | `/admin/dashboard/dau-trend?days=30` | `{"success":true,"data":[{"date":"2026-08-17","value":12},...]}` (30 points) |
| GET | `/admin/dashboard/streak-dropoff` | `{"success":true,"data":[{"day":1,"usersRemaining":22},...]}` (14 points) |
| GET | `/admin/dashboard/rank-distribution` | `{"success":true,"data":[{"rank":"Bronze","users":9},{"rank":"Silver","users":6},...]}` |
| GET | `/admin/dashboard/transactions?limit=10` | `{"success":true,"data":[{"id":"txn_5001","userName":"Ava Thompson","plan":"Hunter Monthly","amount":12,"status":"paid","date":"...","method":"Visa •••• 4242"},...]}` |
| GET | `/admin/dashboard/referrals` | `{"success":true,"data":{"totalLinksSent":342,"successfulSignups":96,"referralToPaidPct":34}}` |
| GET | `/admin/dashboard/top-referrers` | `{"success":true,"data":[{"userId":"usr_1003","userName":"Priya Sharma","linksSent":48,"signups":21,"paidConversions":9},...]}` |
| GET | `/admin/dashboard/referral-activity` | `{"success":true,"data":[{"id":"ref_0","referrerName":"Priya Sharma","refereeName":"Oscar Petrova","status":"converted","date":"..."},...]}` |
| GET | `/admin/dashboard/coupons` | `{"success":true,"data":{"issued":210,"redeemed":134,"unredeemed":58,"expired":18,"redemptionRatePct":64,"byTier":[{"tier":"Bronze","used":40,"unused":15,"expired":5},...]}}` |
| GET | `/admin/dashboard/coupon-activity` | `{"success":true,"data":[{"id":"cpn_0","code":"ARISE-XXXX","partner":"FitGear Co.","userName":"Ava Thompson","action":"redeemed","date":"..."},...]}` |
| GET | `/admin/dashboard/needs-attention` | `{"success":true,"data":[{"id":"att_review_rev_tsk_2001_a","type":"gps_review","title":"Flagged submission — Morning 5K Run","description":"Ava Thompson: GPS speed spike detected — possible vehicle assist.","timestamp":"...","href":"/tasks/review"},...]}` |

#### Users

| Method | Path | Body | Example response |
|---|---|---|---|
| GET | `/admin/users` | — | `{"success":true,"data":[{"id":"usr_1000","displayName":"Dev Admin",...},{"id":"usr_1001","displayName":"Ava Thompson","level":6,"xp":1848,"rank":"bronze",...},...]}` (26 users) |
| GET | `/admin/users/:id` | — | `200` full `User` object, or `404 {"success":false,"error":{"code":"not_found","message":"User usr_x not found"}}` |
| GET | `/admin/users/stats` | — | `{"success":true,"data":{"totalUsers":26,"activeToday":14,"avgLevel":24,"avgStreak":23}}` |
| PATCH | `/admin/users/:id/ban` | `{ reason }` | `200` updated `User` with `status:"banned"`, `banReason` set, `currentStreak:0` |
| PATCH | `/admin/users/:id/unban` | — | `200` updated `User` with `status:"active"`, `banReason:null` |
| POST | `/admin/users/:id/xp-adjustment` | `{ delta, reason }` | `200` updated `User` with `xp = max(0, xp+delta)`; `delta:0` → `400 {"success":false,"error":{"code":"validation_error","message":"delta: delta must not be 0"}}` |
| POST | `/admin/users/:id/reset-streak` | — | `200` updated `User` with `currentStreak:0` |

#### Tasks

| Method | Path | Body | Example response |
|---|---|---|---|
| GET | `/admin/tasks` | — | `{"success":true,"data":[{"id":"tsk_2001","title":"Morning 5K Run",...,"rewardEligibility":"premium",...},...]}` (15 tasks) |
| GET | `/admin/tasks/:id` | — | `200` full `Task`, or `404` |
| GET | `/admin/tasks/stats` | — | `{"success":true,"data":{"totalTasks":15,"activeTasks":12,"pendingReviews":12,"avgXpReward":185,"completionsToday":47}}` |
| GET | `/admin/tasks/:id/completions` | — | `{"success":true,"data":[{"id":"cmp_tsk_2001_0","taskId":"tsk_2001","userId":"usr_1001","userName":"Ava Thompson","date":"...","valueAchieved":5,"verificationStatus":"approved"},...]}` |
| GET | `/admin/tasks/:id/assignment-stats` | — | `{"success":true,"data":{"usersAssigned":88,"completionRate":50,"avgCompletionTimeMin":33}}` |
| GET | `/admin/tasks/review-queue` | — | `{"success":true,"data":[{"id":"rev_tsk_2001_a","taskId":"tsk_2001","taskTitle":"Morning 5K Run","userId":"usr_1001","userName":"Ava Thompson","submittedValue":5.5,"submittedUnit":"km","verificationMethod":"gps_tracked","gpsSessionSummary":"Route logged 5.5 km over 38 min, avg pace steady.","flagReason":"GPS speed spike detected — possible vehicle assist.","status":"pending"},...]}` |
| POST | `/admin/tasks/review-queue/:id/decision` | `{ status: 'approved'\|'rejected' }` | `200` updated `PendingReviewItem`, or `404` if the review id doesn't exist, or `400 validation_error` for any other status value |
| POST | `/admin/tasks` | `TaskInput` | `201` created `Task` with server-computed `id`, `createdAt`, and `rewardEligibility` (verified: `manual` + `xpReward:100` → `"standard"`; `gps_tracked` + `xpReward:250` → `"premium"`) |
| PUT | `/admin/tasks/:id` | `TaskInput` | `200` updated `Task` (same `rewardEligibility` recompute), or `404` |

## End-to-end smoke test

`scripts/smoke-test.sh` logs in as the seeded admin, stores the token, and
hits every endpoint above in sequence — including the negative-path checks
(no token, wrong password, non-admin login, unknown ids, bad validation,
refresh-token reuse-after-rotation, and refresh-after-logout) — printing
PASS/FAIL per step:

```bash
npm run dev                      # in one terminal
bash scripts/smoke-test.sh       # in another
```

Last local run (in-memory driver, after `npm run build` was also verified
to produce a working `dist/` server serving the same responses):

```
== Arise Backend smoke test ==
Base URL: http://localhost:4000/api/v1

PASS  [401] GET /admin/users with no Authorization header -> 401
PASS  [401] POST /auth/login wrong password -> 401
PASS  [200] POST /auth/login admin@arise.com/admin123 -> 200
PASS  [401] GET /admin/users with invalid token -> 401
PASS  [200] GET /admin/dashboard/kpis -> 200
PASS  [200] GET /admin/dashboard/subscriptions -> 200
PASS  [200] GET /admin/dashboard/mrr-trend?days=90 -> 200
PASS  [200] GET /admin/dashboard/dau-trend?days=30 -> 200
PASS  [200] GET /admin/dashboard/streak-dropoff -> 200
PASS  [200] GET /admin/dashboard/rank-distribution -> 200
PASS  [200] GET /admin/dashboard/transactions?limit=10 -> 200
PASS  [200] GET /admin/dashboard/referrals -> 200
PASS  [200] GET /admin/dashboard/top-referrers -> 200
PASS  [200] GET /admin/dashboard/referral-activity -> 200
PASS  [200] GET /admin/dashboard/coupons -> 200
PASS  [200] GET /admin/dashboard/coupon-activity -> 200
PASS  [200] GET /admin/dashboard/needs-attention -> 200
PASS  [200] GET /admin/users -> 200
PASS  [200] GET /admin/users/stats -> 200
PASS  [200] GET /admin/users/:id -> 200
PASS  [404] GET /admin/users/:id (unknown id) -> 404
PASS  [200] PATCH /admin/users/:id/ban -> 200
PASS  [200] PATCH /admin/users/:id/unban -> 200
PASS  [200] POST /admin/users/:id/xp-adjustment -> 200
PASS  [400] POST /admin/users/:id/xp-adjustment delta=0 -> 400
PASS  [200] POST /admin/users/:id/reset-streak -> 200
PASS  [200] GET /admin/tasks -> 200
PASS  [200] GET /admin/tasks/stats -> 200
PASS  [200] GET /admin/tasks/:id -> 200
PASS  [404] GET /admin/tasks/:id (unknown id) -> 404
PASS  [200] GET /admin/tasks/:id/completions -> 200
PASS  [200] GET /admin/tasks/:id/assignment-stats -> 200
PASS  [200] GET /admin/tasks/review-queue -> 200
PASS  [200] POST /admin/tasks/review-queue/:id/decision -> 200
PASS  [404] POST /admin/tasks/review-queue/:id/decision (unknown id) -> 404
PASS  [201] POST /admin/tasks -> 201
PASS  [200] PUT /admin/tasks/:id -> 200
PASS  [404] PUT /admin/tasks/:id (unknown id) -> 404
PASS  [200] POST /auth/refresh -> 200
PASS  [401] POST /auth/refresh reusing a rotated-out token -> 401
PASS  [200] POST /auth/logout -> 200
PASS  [401] POST /auth/refresh with a revoked (logged out) token -> 401

Passed: 42   Failed: 0
```

## Switching to real Supabase later

1. Create a Supabase project.
2. Run `supabase/migrations/0001_init.sql` against it (Supabase Studio's SQL
   editor, or `supabase db push` / `psql` if you have the CLI set up).
3. Set these four env vars in `.env`:
   ```
   DB_DRIVER=supabase
   SUPABASE_URL=https://<your-project>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<service role key, not the anon key>
   ```
   (`DB_DRIVER` can actually be omitted — it defaults to `supabase` once both
   Supabase vars are set — but setting it explicitly is clearer.)
4. Run `npm run seed` to populate the same demo data the memory driver
   generates in-process (26 users incl. the `admin@arise.com` / `admin123`
   admin, 15 tasks, completions, pending reviews, transactions, referral
   activity, coupon activity).
5. Restart the server: `npm run dev` (or `npm run build && npm start`). No
   route/controller/service code changes are needed — `src/db/index.ts`
   picks the Supabase repositories automatically based on `DB_DRIVER`.

The Supabase driver (`src/db/supabase/*`) is code-complete and type-checked
but has **not** been run against a live database, since no Supabase project
/ credentials exist yet. See the comments at the top of
`supabase/migrations/0001_init.sql` and in `src/db/supabase/dashboardRepository.ts`
for the schema/design decisions made in its absence (e.g. `top_referrers` is
computed from `referral_activity` rather than stored separately; MRR/DAU/
streak-dropoff/subscription numbers are generated the same deterministic way
the memory driver does, since no billing-provider integration exists yet).

## Frontend integration

`Arise-Admin` has since been wired to this backend — the `// TODO: API`
mock functions in `lib/api/*.ts` and `lib/auth/actions.ts` now call these
real endpoints, and the whole flow (login through every page) has been
verified end-to-end in a real browser. See `TESTING.md` at the root of
`Arise-Admin` for that combined test plan and results.
