# Adding a Feature Module

Every feature follows the same pattern as `src/modules/alumni`. Example for a jobs module (Member B).

## 1. Migration

Create a new file. Never edit a migration that has already been applied; add another one instead.
Use your number range so files never collide: **Lead 001–099, Member B 100–199, Member C 200–299**.

```sql
-- src/db/migrations/100_jobs.sql
CREATE TABLE job_post (
  job_id       SERIAL PRIMARY KEY,
  posted_by    INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  title        VARCHAR(150) NOT NULL,
  -- ...columns from docs/er-diagram.svg...
  status       VARCHAR(10) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'REMOVED')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Run `npm run migrate`.

## 2. Files

```
src/modules/jobs/
  jobs.schemas.js      zod schemas for body / query / params
  jobs.model.js        SQL queries only, with $1, $2 parameters
  jobs.controller.js   business rules, throws ApiError, sends JSON
  jobs.routes.js       router.METHOD(path, authenticate, authorize?, validate(...), controller.fn)
tests/jobs.test.js
public/js/pages/jobs.js
```

## 3. Building blocks you can reuse

| Need | Use |
|---|---|
| Logged-in user | `authenticate` from `middleware/auth.js` → `req.user = { id, email, fullName, role }` |
| Role check | `authorize('ADMIN')` or `authorize('ADMIN', 'ALUMNI')` |
| Validate input | `validate({ body, query, params })` → parsed values in `req.valid.body` etc. |
| Common fields | `utils/validators.js`: `text(max)`, `id`, `idParam`, `optionalText`, `nullableUrl`, `pagination`, ... |
| Errors | `throw ApiError.notFound('Job not found')`, `.forbidden()`, `.conflict()`, `.badRequest(msg, details)` |
| Pagination | `toLimitOffset(query)` and `paginationMeta(query, total)` from `utils/pagination.js` |
| Transactions | `withTransaction(async (client) => { ... })` from `db/pool.js` |
| Notify a user | `notifications.notify(userId, { type, title, body, linkUrl })` |
| Audit an action | `audit.log({ actorId: req.user.id, action: 'JOB_CLOSE', entityName: 'job_post', entityId, ip: req.ip })` |
| Test helpers | `tests/helpers.js`: `api()`, `resetDb()`, `createDepartment()`, `createUser({ role })`, `auth(token)` |

Express 5 passes errors from `async` handlers to the error handler automatically, so no try/catch is needed
in controllers unless you want to handle a specific error.

## 4. Register the module

- API: uncomment or add your line in `src/routes/index.js`
- Frontend: add your page to `routes` and `navLinks` in `public/js/app.js`, and set `ready: true` on its card in `public/js/pages/home.js`

## 5. Before opening a pull request

- [ ] `npm test` passes, including tests for 400 / 401 / 403 / 404 / 409 cases
- [ ] Only your module's files and the one-line registrations changed
- [ ] Checklist item number in the PR title, e.g. "B3: job posts API"
