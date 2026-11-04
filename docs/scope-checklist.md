# Approved AP Scope Checklist

The rubric's completion marks are `3 × verified completion % ÷ 100`. An item counts only when its
acceptance test passes **in the live demonstration**. Get this checklist approved by the evaluator at
checkpoint 1, before implementation of the remaining items. Weights total **100%**.

Status key: ☐ not started · ◐ in progress · ☑ demonstrated (fill in date + evidence)

Lead items L1–L9 can be shown live with `npm run demo` (see README → Checkpoint demo).

## Lead: Geetansh Goyal (33.4%) - core identity, directory, shared infrastructure, deployment

| # | Item | Weight | Acceptance test (what the evaluator sees) | Status |
|---|---|---|---|---|
| L1 | Project structure, config, central error handling, validation | 5 | Invalid JSON → 400; unknown route → 404 JSON; missing env var → server refuses to start with a clear message | ☐ |
| L2 | Registration (alumni & student) | 5 | `POST /api/auth/register` → 201 + token; duplicate email/enrollment → 409; bad input → 400 with field errors; user + profile saved in one transaction | ☐ |
| L3 | Login with JWT, password hashing, lockout | 5 | Correct login → 200 + token; wrong password → 401; 5 failures → account locked (403); hash never in responses | ☐ |
| L4 | Role-based authorisation (ADMIN / ALUMNI / STUDENT) | 3 | No token → 401; alumni calling admin route → 403; admin → 200 | ☐ |
| L5 | Profile view/update with skills & interests | 3 | `PATCH /api/profile/me` updates DB; role-specific fields enforced; skills de-duplicated | ☐ |
| L6 | Alumni directory search & filters | 5 | Filter by year, department, industry, city, skill, text search; pagination; only verified alumni visible | ☐ |
| L7 | Admin verification, account status, departments | 3 | Admin verifies pending alumni → appears in directory and receives a notification; suspend blocks login | ☐ |
| L8 | Notifications + audit log (used by all modules) | 2 | Notification list/mark read; failed logins and admin actions appear in audit log | ☐ |
| L9 | Deployment + README | 2.4 | Hosted URL `/api/health` shows database connected; data persists after restart | ☐ |
| | **Subtotal** | **33.4** | | |

## Member B: Bhavesh Sharma (33.3%) - networking hub, job portal, events

| # | Item | Weight | Acceptance test | Status |
|---|---|---|---|---|
| B1 | Connections: send / accept / reject (NETWORK or MENTORSHIP) | 6.3 | Cannot connect to self; duplicate request → 409; only receiver can accept | ☐ |
| B2 | Messages between connected users | 5 | Only accepted connections can message; read_at set when read | ☐ |
| B3 | Job posts: create, list with search/filters, update/close | 6 | Only the poster (or admin) can edit/close; filters by type & location | ☐ |
| B4 | Job applications + status changes | 5 | Apply once per job (409 on repeat); poster changes status → applicant notified | ☐ |
| B5 | Events: create (admin), list, update, cancel | 5 | Validation of dates; only admin manages; status flow DRAFT → OPEN → COMPLETED/CANCELLED | ☐ |
| B6 | Event registration with capacity and waitlist | 6 | Full event → WAITLISTED; cancellation promotes next waitlisted; after deadline → 400 | ☐ |
| | **Subtotal** | **33.3** | | |

## Member C: Ravi Sharma (33.3%) - donations, success stories, feedback & surveys

| # | Item | Weight | Acceptance test | Status |
|---|---|---|---|---|
| C1 | Campaigns: create (admin), list with progress (raised vs goal) | 5.3 | Amount raised = sum of SUCCESS donations only | ☐ |
| C2 | Donations with payment gateway in **test mode** + transactions | 7 | Order created → payment verified (signature check) → donation SUCCESS; failed payment recorded | ☐ |
| C3 | Donation receipts + donor history | 4 | Unique receipt number generated once per successful donation | ☐ |
| C4 | Success stories: submit, admin review, publish | 5 | Only APPROVED stories are public; author notified on review | ☐ |
| C5 | Surveys: create with questions/options (admin), respond | 6 | One response per user; required questions enforced; answer types validated | ☐ |
| C6 | Survey results + feedback (submit, admin reply/status) | 6 | Aggregated results per question; feedback status OPEN → IN_REVIEW → CLOSED | ☐ |
| | **Subtotal** | **33.3** | | |

**Total: 100%**

## Common requirements for every module

- Routes → controller → model structure (see [CONTRIBUTING.md](CONTRIBUTING.md))
- zod validation on every body, query and params
- Correct status codes (201 create, 204 delete, 400/401/403/404/409)
- Parameterised SQL only
- Jest + Supertest tests for success **and** error cases
- Frontend page(s) for the module in `public/js/pages/`
