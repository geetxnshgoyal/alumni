#!/usr/bin/env bash
# Live demo of the lead's checklist items (L1-L9) for checkpoint evaluations.
# Usage: npm run dev (in another terminal), then: bash scripts/demo-checkpoint.sh [base-url]
# Needs curl and jq. Creates fresh demo users each run. Login/register are rate limited to
# 20 attempts per 15 minutes, so wait between runs (or restart the server).
set -u
BASE="${1:-http://localhost:3000}"
ADMIN_EMAIL="${SEED_ADMIN_EMAIL:-admin@alumni.test}"
ADMIN_PASSWORD="${SEED_ADMIN_PASSWORD:-Admin@12345}"
RUN=$(date +%s)
PASS=0
FAIL=0

section() { printf '\n== %s\n' "$1"; }
check() { # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then PASS=$((PASS + 1)); printf '  PASS  %s\n' "$1"
  else FAIL=$((FAIL + 1)); printf '  FAIL  %s (expected %s, got %s)\n' "$1" "$2" "$3"; fi
}
# req <method> <path> [token] [json-body] -> prints "<status> <body>"
req() {
  local args=(-s -w '\n%{http_code}' -X "$1" "$BASE$2" -H 'Content-Type: application/json')
  [ -n "${3:-}" ] && args+=(-H "Authorization: Bearer $3")
  [ -n "${4:-}" ] && args+=(--data "$4")
  local out; out=$(curl "${args[@]}")
  BODY=$(printf '%s' "$out" | sed '$d')
  STATUS=$(printf '%s' "$out" | tail -n1)
}
login() { req POST /api/auth/login "" "{\"email\":\"$1\",\"password\":\"$2\"}"; }

section "L9  Deployment: health check"
req GET /api/health
check "GET /api/health -> 200" 200 "$STATUS"
check "database connected" connected "$(jq -r '.data.database' <<<"$BODY")"

section "L1  Structure, errors, validation"
req POST /api/auth/login "" '{"email":'
check "invalid JSON -> 400" 400 "$STATUS"
req GET /api/does-not-exist
check "unknown route -> 404 JSON" "404 true" "$STATUS $(jq 'has("error")' <<<"$BODY")"
if [ "$BASE" = "http://localhost:3000" ]; then
  out=$(JWT_SECRET= node src/server.js 2>&1); code=$?
  check "missing JWT_SECRET -> server refuses to start" "1 yes" "$code $(grep -q JWT_SECRET <<<"$out" && echo yes || echo no)"
fi

section "L2  Registration"
req GET /api/departments
DEPT=$(jq '.data[0].deptId' <<<"$BODY")
ALUM_EMAIL="demo.alumni.$RUN@example.com"
ALUM_BODY="{\"role\":\"ALUMNI\",\"email\":\"$ALUM_EMAIL\",\"password\":\"Demo@12345\",\"fullName\":\"Demo Alumni $RUN\",
  \"deptId\":$DEPT,\"enrollmentNo\":\"DEMO-A-$RUN\",\"degree\":\"B.E.\",\"graduationYear\":2020,\"city\":\"Pune\",
  \"skills\":[\"Node.js\",\"SQL\"]}"
req POST /api/auth/register "" "$ALUM_BODY"
check "register alumni -> 201" 201 "$STATUS"
ALUM_TOKEN=$(jq -r '.data.token' <<<"$BODY")
ALUM_ID=$(jq -r '.data.user.userId' <<<"$BODY")
check "token returned" true "$(jq '.data.token | type == "string"' <<<"$BODY")"
check "password hash never returned" false "$(grep -qi 'hash' <<<"$BODY" && echo true || echo false)"
req POST /api/auth/register "" "$ALUM_BODY"
check "duplicate email -> 409" 409 "$STATUS"
req POST /api/auth/register "" '{"role":"ALUMNI","email":"not-an-email","password":"short"}'
check "bad input -> 400 with field details" "400 true" "$STATUS $(jq '.error.details | length > 0' <<<"$BODY")"
STU_EMAIL="demo.student.$RUN@example.com"
req POST /api/auth/register "" "{\"role\":\"STUDENT\",\"email\":\"$STU_EMAIL\",\"password\":\"Demo@12345\",
  \"fullName\":\"Demo Student $RUN\",\"deptId\":$DEPT,\"enrollmentNo\":\"DEMO-S-$RUN\",\"currentSemester\":5,\"expectedGradYear\":$(( $(date +%Y) + 1 ))}"
check "register student -> 201" 201 "$STATUS"
STU_ID=$(jq -r '.data.user.userId' <<<"$BODY")

section "L3  Login and lockout"
login "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
check "admin login -> 200" 200 "$STATUS"
ADMIN_TOKEN=$(jq -r '.data.token' <<<"$BODY")
login "$STU_EMAIL" "Wrong@12345"
check "wrong password -> 401" 401 "$STATUS"
for _ in 1 2 3 4; do login "$STU_EMAIL" "Wrong@12345"; done
login "$STU_EMAIL" "Demo@12345"
check "after 5 failures, even the right password -> 403 (locked)" 403 "$STATUS"

section "L4  Role-based authorisation"
req GET /api/admin/stats
check "no token -> 401" 401 "$STATUS"
req GET /api/admin/stats "$ALUM_TOKEN"
check "alumni on admin route -> 403" 403 "$STATUS"
req GET /api/admin/stats "$ADMIN_TOKEN"
check "admin on admin route -> 200" 200 "$STATUS"

section "L5  Profile with skills"
req PATCH /api/profile/me "$ALUM_TOKEN" '{"currentCompany":"Demo Corp","skills":["Node.js","node.js","PostgreSQL"]}'
check "PATCH /api/profile/me -> 200" 200 "$STATUS"
check "skills de-duplicated (case-insensitive)" 2 "$(jq '.data.skills | length' <<<"$BODY")"
req PATCH /api/profile/me "$ALUM_TOKEN" '{"currentSemester":3}'
check "student-only field rejected for alumni -> 400" 400 "$STATUS"

section "L6  Directory search"
req GET "/api/alumni?q=Demo%20Alumni%20$RUN" "$ALUM_TOKEN"
check "pending alumni hidden from directory" 0 "$(jq '.data | length' <<<"$BODY")"
req GET "/api/alumni?city=Bengaluru&industry=Technology&limit=2&page=1" "$ALUM_TOKEN"
check "filters + pagination -> 200" "200 1" "$STATUS $(jq '.pagination.page' <<<"$BODY")"
req GET "/api/alumni?graduationYear=abc" "$ALUM_TOKEN"
check "invalid filter -> 400" 400 "$STATUS"

section "L7  Admin verification and account status"
req PATCH "/api/admin/alumni/$ALUM_ID/verification" "$ADMIN_TOKEN" '{"status":"VERIFIED"}'
check "admin verifies alumni -> 200" 200 "$STATUS"
req GET "/api/alumni?q=Demo%20Alumni%20$RUN" "$ALUM_TOKEN"
check "verified alumni now in directory" 1 "$(jq '.data | length' <<<"$BODY")"
req PATCH "/api/admin/users/$STU_ID/status" "$ADMIN_TOKEN" '{"accountStatus":"ACTIVE"}'
check "admin reactivates locked student -> 200" 200 "$STATUS"
login "$STU_EMAIL" "Demo@12345"
check "student can log in again -> 200" 200 "$STATUS"
req PATCH "/api/admin/users/$STU_ID/status" "$ADMIN_TOKEN" '{"accountStatus":"SUSPENDED"}'
login "$STU_EMAIL" "Demo@12345"
check "suspended user cannot log in -> 403" 403 "$STATUS"

section "L8  Notifications and audit log"
req GET /api/notifications "$ALUM_TOKEN"
check "alumni received a notification" true "$(jq '.data | length > 0' <<<"$BODY")"
NOTE_ID=$(jq '.data[0].notificationId' <<<"$BODY")
req PATCH "/api/notifications/$NOTE_ID/read" "$ALUM_TOKEN"
check "mark notification read -> 200" 200 "$STATUS"
req GET "/api/admin/audit-logs?limit=50" "$ADMIN_TOKEN"
check "audit log has failed logins" true "$(jq '[.data[] | select(.outcome == "FAILURE")] | length > 0' <<<"$BODY")"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
