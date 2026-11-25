# GradLink — Alumni Network

Web platform (installable on phones as a PWA) connecting students and alumni:
alumni registration and verification, a searchable alumni directory, networking, jobs, events, donations,
success stories, and feedback/surveys.

**Stack:** Node.js 20+ · Express 5 · PostgreSQL (`pg`) · JWT auth · zod validation · Jest + Supertest · vanilla JS frontend served by Express.

| | |
|---|---|
| Hosted URL | _add after deploying_ |
| ER diagram | [docs/er-diagram.svg](docs/er-diagram.svg) |
| Approved scope checklist | [docs/scope-checklist.md](docs/scope-checklist.md) |
| Team plan & Git workflow | [docs/team-plan.md](docs/team-plan.md) |
| How to add a module | [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md) |

---

## Run it locally

**Prerequisites:** Node.js 20 or newer, PostgreSQL 14 or newer (pgAdmin is fine for managing it).

```bash
git clone https://github.com/geetxnshgoyal/alumni.git && cd alumni
npm install
cp .env.example .env        # Windows: copy .env.example .env
```

Edit `.env`:

- Put your Postgres password in **both** `DATABASE_URL` and `TEST_DATABASE_URL`.
  Installed Postgres with Homebrew or Postgres.app? The user is your Mac username and there is no password:
  `postgresql://<mac-username>@localhost:5432/alumni_db`.
- Replace `JWT_SECRET` with the output of `openssl rand -hex 32` (any long random string works).

```bash
npm run db:create           # creates alumni_db and alumni_test if they don't exist
npm run migrate             # creates the tables
npm run seed                # demo departments, admin, alumni and students
npm run dev                 # http://localhost:3000 (restarts on file changes)
```

Demo logins created by the seed:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@alumni.test` | value of `SEED_ADMIN_PASSWORD` (default `Admin@12345`) |
| Alumni | `aarav@alumni.test`, `diya@alumni.test`, ... | `Alumni@123` |
| Student | `harsh@student.test` | `Alumni@123` |

These are demo accounts only. Change `SEED_ADMIN_PASSWORD` before seeding a hosted database.

### Checkpoint demo

With `npm run dev` running in another terminal, `npm run demo` runs one live check per acceptance test of
items L1–L9 in the [scope checklist](docs/scope-checklist.md) and prints PASS/FAIL for each. Pass a URL to check
the hosted app: `npm run demo -- https://<your-service>.onrender.com`. Needs `curl` and `jq`.

### If setup fails

| Error | Fix |
|---|---|
| `Invalid environment configuration` | `.env` is missing or a value is wrong; the message names the field |
| `password authentication failed for user "postgres"` | Wrong password in `.env` (it is the one you chose when installing Postgres) |
| Password contains `@ : / # ?` or `%` | Write those characters URL-encoded in `.env`, e.g. `@` as `%40` |
| `role "postgres" does not exist` | Homebrew/Postgres.app install: use your Mac username in the URLs, no password |
| `connect ECONNREFUSED 127.0.0.1:5432` | Postgres is not running. pgAdmin does not start it: start the PostgreSQL service (Windows: Services app; Homebrew: `brew services start postgresql@16`) |
| `Warning: ... changed after it was applied` | Someone edited a migration you already ran. Run `npm run db:reset` (local databases only: deletes and rebuilds them with demo data) |
| `Migration ... failed` after `git pull` | Run `npm run db:reset` |
| Port 3000 in use | Set `PORT=3001` in `.env` |

### Tests

```bash
npm test
```

Tests run against `TEST_DATABASE_URL`. That database is wiped between tests, so never point it at real data.

GitHub Actions runs the same tests against a fresh PostgreSQL on every pull request and every push to `main`
([.github/workflows/test.yml](.github/workflows/test.yml)). A pull request should only be merged when the **Tests** check is green.

## Environment variables

| Name | Required | Description |
|---|---|---|
| `NODE_ENV` | no | `development` (default), `test` or `production` |
| `PORT` | no | HTTP port (default `3000`) |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `TEST_DATABASE_URL` | for tests | Separate database used by `npm test` |
| `DATABASE_SSL` | no | `true` for hosted databases that require SSL (Neon, Supabase, Render external URL) |
| `JWT_SECRET` | yes | At least 16 characters. Generate with `openssl rand -hex 32` |
| `JWT_EXPIRES_IN` | no | Token lifetime, default `7d` |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | no | Access / refresh token lifetimes, default `15m` / `7d` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | for Google sign-in | From Google Cloud Console. Without them, Google sign-in does not work |
| `CORS_ORIGIN` | no | Comma-separated origins allowed to call the API from another domain |
| `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` | no | First admin account created by `npm run seed` |

`.env` is git-ignored. Never commit real secrets.

## Project structure

```
src/
  app.js                 Express app: security headers, JSON parsing, routes, error handling
  server.js              Starts the HTTP server, graceful shutdown
  config/env.js          Loads and validates environment variables
  db/
    pool.js              PostgreSQL pool, query(), withTransaction()
    migrate.js           Applies db/migrations/*.sql in order (tracked in schema_migrations)
    migrations/          One .sql file per change - never edit an applied file, add a new one
    seed.js, create.js, reset.js   Demo data, create databases, rebuild local databases
  middleware/
    auth.js              authenticate (JWT) and authorize(...roles)
    validate.js          zod validation for body / query / params
    errorHandler.js      404 + central error -> JSON (maps PostgreSQL errors to 400/409)
    rateLimit.js         Login/register brute-force protection
  modules/<feature>/     One folder per feature:
    *.routes.js          URL + HTTP method -> middleware -> controller
    *.controller.js      Request handling and business rules
    *.model.js           SQL queries (parameterised, never string-concatenated)
    *.schemas.js         zod input validation
  utils/                 ApiError, shared validators, pagination, SQL helpers
public/                  Web frontend (hash router, one file per page in js/pages)
tests/                   Jest + Supertest API tests
```

How a request flows, e.g. `GET /api/alumni?city=Pune`:
`alumni.routes.js` → `authenticate` (JWT check, loads user) → `validate` (zod parses the query) →
`alumni.controller.search` (role rules) → `alumni.model.search` (parameterised SQL) → JSON response.
If anything throws, `errorHandler` turns it into `{ "error": { "message", "details" } }` with the right status code.

## API

All responses are JSON: `{ "data": ... }` on success and `{ "error": { "message", "details?" } }` on failure.
Send `Authorization: Bearer <token>` for protected routes.

| Method | Path | Access | Description |
|---|---|---|---|
| GET | `/api/health` | public | Server and database status |
| POST | `/api/auth/register` | public | Register as `ALUMNI` or `STUDENT` (returns token) |
| POST | `/api/auth/login` | public | Log in (returns token). 5 wrong passwords lock the account |
| PATCH | `/api/auth/password` | logged in | Change password |
| GET | `/api/profile/me` | logged in | My full profile |
| PATCH | `/api/profile/me` | logged in | Update my profile, skills and interests |
| GET | `/api/skills?q=`, `/api/interests?q=` | logged in | Tag suggestions with usage counts |
| GET | `/api/alumni` | logged in | Directory. Filters: `q, graduationYear, yearFrom, yearTo, deptId, industry, city, country, company, skill, interest, sort, page, limit` (`status` for admins) |
| GET | `/api/alumni/filters` | logged in | Values for the filter dropdowns |
| GET | `/api/alumni/:id` | logged in | Public alumni profile (contact details only for self/admin) |
| GET | `/api/departments` | public | List departments |
| POST / PATCH / DELETE | `/api/departments[/:id]` | admin | Manage departments |
| GET | `/api/notifications?unreadOnly=` | logged in | My notifications + unread count |
| PATCH | `/api/notifications/:id/read` | logged in | Mark one as read |
| POST | `/api/notifications/read-all` | logged in | Mark all as read |
| GET | `/api/admin/stats` | admin | Users by role/status, verification counts, alumni per department |
| PATCH | `/api/admin/alumni/:id/verification` | admin | `VERIFIED` or `REJECTED` (notifies the alumni) |
| PATCH | `/api/admin/users/:id/status` | admin | `ACTIVE` or `SUSPENDED` |
| GET | `/api/admin/audit-logs` | admin | Security/audit trail (logins, verifications, ...) |
| POST | `/api/connections` | logged in | Send connection/mentorship request (`receiverId, connectionType, requestNote`) |
| GET | `/api/connections` | logged in | List connections and requests (`status, type, page, limit`) |
| GET | `/api/connections/:id` | logged in | Get single connection details (participants or admin) |
| PATCH | `/api/connections/:id/accept` | logged in | Accept connection request (receiver only) |
| PATCH | `/api/connections/:id/reject` | logged in | Reject connection request (receiver only) |
| POST | `/api/messages` | logged in | Send message to accepted connection (`connectionId, content`) |
| GET | `/api/messages?connectionId=` | logged in | List messages chronologically and mark incoming as read |
| POST | `/api/jobs` | alumni / admin | Create job posting (`title, companyName, location, jobType, description, applyBy`) |
| GET | `/api/jobs` | public | List and search active job postings (`q, jobType, location, company, page, limit`) |
| GET | `/api/jobs/:id` | public | View detailed job post |
| PATCH | `/api/jobs/:id` | poster / admin | Update job posting |
| PATCH | `/api/jobs/:id/close` | poster / admin | Close job post (logs to audit trail) |
| POST | `/api/jobs/:id/apply` | logged in | Apply to job with optional `resumeUrl` and `coverNote` |
| GET | `/api/applications/me` | logged in | List my submitted job applications |
| GET | `/api/jobs/:id/applications` | poster / admin | List candidate applications for a job |
| PATCH | `/api/applications/:id/status` | poster / admin | Update candidate application status (`SHORTLISTED, REJECTED, HIRED`) |
| GET | `/api/events` | public | List events with filters (`q, type, mode, status, page, limit`) |
| GET | `/api/events/:id` | public | View event details and current attendee/capacity status |
| POST | `/api/events` | admin | Create event (`title, eventType, mode, venueOrLink, startAt, endAt, capacity, registrationDeadline`) |
| PATCH | `/api/events/:id` | admin | Update event details |
| PATCH | `/api/events/:id/cancel` | admin | Cancel event and notify confirmed/waitlisted attendees |
| DELETE | `/api/events/:id` | admin | Delete event |
| POST | `/api/events/:id/register` | logged in | RSVP for event (`REGISTERED` or placed on `WAITLISTED` if full) |
| DELETE | `/api/events/:id/register` | logged in | Cancel registration (automatically promotes next waitlisted attendee) |
| GET | `/api/events/registrations/me` | logged in | List my registered and waitlisted events |
| GET | `/api/events/:id/registrations` | admin | View attendee roster and waitlist for an event |
| POST | `/api/auth/refresh` | refresh token | New access token; the refresh token (cookie or body) is rotated, and reuse of an old one revokes the session |
| POST | `/api/auth/logout` | public | Revoke the refresh token |
| POST | `/api/auth/oauth/google` | public | Sign in with a Google ID token or auth code |
| GET | `/api/auth/oauth/google`, `/callback` | public | Google OAuth redirect flow |
| GET | `/api/campaigns` | public | List campaigns with amount raised vs goal |
| GET | `/api/campaigns/:id` | public | Campaign detail |
| POST | `/api/campaigns` | admin | Create campaign |
| PATCH | `/api/campaigns/:id`, `/:id/close` | admin | Update or close campaign |
| POST | `/api/donations` | logged in | Start a donation: creates a test-mode gateway order |
| POST | `/api/donations/verify` | logged in | Verify payment signature; marks the donation SUCCESS and issues a receipt |
| POST | `/api/donations/fail` | logged in | Record a failed payment |
| POST | `/api/donations/webhook` | gateway | Payment gateway webhook (signature-checked, idempotent) |
| GET | `/api/donations/my` | logged in | My donation history |
| GET | `/api/donations/campaign/:id` | public | Donations to a campaign |
| GET | `/api/donations/:id`, `/:id/receipt` | logged in | Donation detail and receipt |
| GET | `/api/stories` | public | Approved success stories |
| GET | `/api/stories/my`, `/api/stories/:id` | logged in / public | My stories; one story |
| POST | `/api/stories` | alumni, admin | Submit a story for review |
| PATCH / DELETE | `/api/stories/:id` | author | Edit or delete my story |
| PATCH | `/api/stories/:id/review` | admin | Approve or reject (notifies the author) |
| GET | `/api/surveys`, `/api/surveys/:id` | public | List surveys; survey with questions |
| POST | `/api/surveys` | admin | Create survey with questions and options |
| PATCH | `/api/surveys/:id/status` | admin | Open or close a survey |
| POST | `/api/surveys/:id/responses` | logged in | Respond (once per user; required questions enforced) |
| GET | `/api/surveys/:id/my-response` | logged in | My response |
| GET | `/api/surveys/:id/results` | admin | Aggregated results per question |
| POST | `/api/feedback` | logged in | Submit feedback |
| GET | `/api/feedback/my`, `/api/feedback/:id` | logged in | My feedback; one item |
| GET | `/api/feedback` | admin | All feedback |
| PATCH | `/api/feedback/:id` | admin | Reply and set status (OPEN → IN_REVIEW → CLOSED) |

Status codes used: `200` OK, `201` created, `204` deleted, `400` validation failed, `401` not logged in or bad token,
`403` wrong role or account locked/suspended, `404` not found, `409` duplicate or still referenced, `413` body too large, `429` rate limited.

Quick try with curl:

```bash
curl -s localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"aarav@alumni.test","password":"Alumni@123"}'
curl -s 'localhost:3000/api/alumni?city=Bengaluru' -H "Authorization: Bearer <token>"
```

## Security controls

- Passwords hashed with bcrypt (12 rounds); hashes are never returned by the API
- JWT authentication; the user is re-checked on each request, so suspensions apply immediately
- Role-based authorisation (`ADMIN`, `ALUMNI`, `STUDENT`); admins cannot self-register
- Account lockout after 5 failed logins, plus rate limiting on login/register
- Same error for unknown email and wrong password (no account enumeration)
- All input validated with zod; all SQL parameterised; `LIKE` wildcards escaped
- Only `http(s)` URLs accepted for links and photos (no `javascript:` links)
- Helmet security headers and a Content-Security-Policy; frontend escapes all user text
- Audit log of logins, failures, lockouts and admin actions

## Deployment (Render + PostgreSQL)

1. Push the repository to GitHub.
2. In the Render dashboard choose **New → Blueprint** and select the repository. `render.yaml` creates
   the web service and a PostgreSQL database, and generates `JWT_SECRET`.
3. The start command runs `npm run migrate && npm start`, so the tables are created on first boot.
4. Seed the hosted database once from your machine, using the database's **External** connection string from Render:

   ```bash
   DATABASE_URL='<external connection string>' DATABASE_SSL=true JWT_SECRET=dummy-value-for-seeding \
   SEED_ADMIN_PASSWORD='<a strong password>' npm run seed
   ```

5. Open `https://<your-service>.onrender.com/api/health`. It should report `"database": "connected"`.

Notes: the free web service sleeps when idle (the first request takes about a minute). Free Render databases
are time-limited, so check Render's current free-tier terms before the final evaluation. A [Neon](https://neon.tech) database
works too: set `DATABASE_URL` to its connection string and `DATABASE_SSL=true`.

**Deployment verification record:** fill in after deploying:

| Item | Evidence |
|---|---|
| Hosted URL | https://alumni-ep6w.onrender.com (Render web service + Render PostgreSQL) |
| Evaluated commit | `main`, auto-deployed by Render. Verified on 25 Nov 2026 with `main` at `e4d8221` |
| `/api/health` reachable | Yes, 25 Nov 2026: `{"status":"ok","database":"connected"}` |
| Core flow (register → admin verifies → appears in directory) | Yes, 25 Nov 2026: `npm run demo -- https://alumni-ep6w.onrender.com` → 59 passed, 0 failed (includes L2, L7 and L6) |
| Persistence (data survives a redeploy/restart) | Yes: seed data (departments, admin) created 16 Nov 2026 is still present on 25 Nov after several redeploys |
