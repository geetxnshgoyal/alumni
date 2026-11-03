# Team Plan & Git Workflow

## Ownership

| Member | Area | Tables (see [er-diagram.svg](er-diagram.svg)) | Scope weight |
|---|---|---|---|
| Lead: Geetansh Goyal (`goyalgeetansh@gmail.com`) | Core, auth, directory, admin, notifications, audit, deployment | `department`, `users`, `alumni_profile`, `student_profile`, `skill`, `user_skill`, `interest`, `user_interest`, `notification`, `audit_log` | 33.3% |
| Member B: Bhavesh Sharma (`bhavesh123sharma123@gmail.com`) | Networking hub, job portal, events & reunions | `connection`, `message`, `job_post`, `job_application`, `event`, `event_registration` | 33.3% |
| Member C: Ravi Sharma (`rravisharma817@gmail.com`) | Donations, success stories, feedback & surveys | `campaign`, `donation`, `payment_transaction`, `donation_receipt`, `success_story`, `survey`, `survey_question`, `question_option`, `survey_response`, `response_answer`, `answer_choice`, `feedback` | 33.3% |

Each person writes the migration, model, controller, routes, validation, tests **and** frontend page for their
own modules, and must be able to explain and modify them in the viva.

## Checkpoints (weekly, starting 3 Nov 2026)

Agree these dates with the evaluator. A checkpoint is met when the work is **demonstrated**, not just pushed.

| Checkpoint | Date | Lead | Member B | Member C |
|---|---|---|---|---|
| CP1 | Mon 9 Nov | Repo live, core + auth + directory merged, checklist approved | Migration for B tables, connections API on a branch | Migration for C tables, campaigns API on a branch |
| CP2 | Mon 16 Nov | Review B/C PRs, deploy staging on Render | Connections + messages + jobs merged with tests | Campaigns + donations (test-mode payments) merged with tests |
| CP3 | Mon 23 Nov | Integration fixes, notifications wired into B/C flows | Events + registrations/waitlist merged; frontend pages | Stories + surveys + feedback merged; frontend pages |
| CP4 | Mon 30 Nov | Final deployment, README, verification record | Bug fixes, error-case tests | Bug fixes, error-case tests |
| Viva prep | before final (by 30 Nov) | Everyone traces one of their own requests end-to-end and practises a small live change | | |

Log each checkpoint in [meetings.md](meetings.md).

## One-time setup

### Lead: create the repository

```bash
cd alumni
git init -b main
git add .
git commit -m "Set up Express + PostgreSQL project with auth, directory and admin modules"
gh repo create gec-alumni-platform --private --source . --push   # or create it on github.com and `git remote add origin ... && git push -u origin main`
```

Then on GitHub: **Settings → Collaborators** → add Member B and Member C, and
**Settings → Branches → Add rule** for `main`: require a pull request with 1 approval before merging.
Create one **Issue** per checklist item (L1…C6) and assign it to its owner.

### Member B and Member C: get the project running

```bash
git clone https://github.com/<lead-username>/gec-alumni-platform.git
cd gec-alumni-platform
npm install
cp .env.example .env          # edit: your own Postgres password in DATABASE_URL and TEST_DATABASE_URL
npm run db:create
npm run migrate
npm run seed
npm test                      # all tests should pass before you start
npm run dev                   # open http://localhost:3000
```

## Daily workflow (everyone)

```bash
git checkout main
git pull                                  # get teammates' merged work
git checkout -b feat/jobs-api             # one branch per issue/feature
# ... write code + tests ...
npm test
git add src/modules/jobs tests/jobs.test.js
git commit -m "Add job post create and list endpoints (#12)"   # small commits, mention the issue number
git push -u origin feat/jobs-api
gh pr create --fill                       # or open the pull request on github.com
```

- Keep commits small and focused (one endpoint, one fix, one test file). Don't upload everything at the end.
- Write messages that say **what** changed: "Add waitlist promotion when a registration is cancelled (#18)".
- Every pull request is reviewed by a teammate before merging: Lead reviews B, B reviews C, C reviews Lead.
  Leave real comments: a question, a missing test, an edge case.
- If `main` moved while you worked: `git pull --rebase origin main`, re-run `npm test`, push again.
- Never commit `.env`.

## What each person should be able to explain in the viva

- Their routes file: URL, HTTP method, which middleware runs (`authenticate`, `authorize`, `validate`) and why
- Their controller: the business rules (who may do what, what happens on duplicates or invalid states)
- Their model: each SQL query, the parameters, and the tables it touches
- One request traced end to end, including what happens on an error
- How to make a small change live: add a validation rule, a filter or a new field
