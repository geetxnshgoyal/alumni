#!/usr/bin/env bash
# Live demo of the lead's checklist items (L1-L9) and Member C items (C1-C6) for checkpoint evaluations.
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

section "C1  Campaigns (create, list with progress)"
CAMP_TITLE="Demo Campaign $RUN"
req POST /api/campaigns "$ADMIN_TOKEN" "{\"title\":\"$CAMP_TITLE\",\"description\":\"Renovating computer labs for robotics and AI research.\",\"goalAmount\":50000,\"startDate\":\"2026-11-01\",\"endDate\":\"2026-12-31\"}"
check "admin creates campaign -> 201" 201 "$STATUS"
CAMP_ID=$(jq -r '.data.campaignId' <<<"$BODY")
req GET "/api/campaigns/$CAMP_ID"
check "campaign details -> 200 with raised 0" "200 0" "$STATUS $(jq '.data.amountRaised' <<<"$BODY")"

section "C2  Donations (test mode gateway & transaction settlement)"
req POST /api/donations "$ALUM_TOKEN" "{\"campaignId\":$CAMP_ID,\"amount\":5000,\"currency\":\"INR\",\"isAnonymous\":false}"
check "initiate donation order -> 201" 201 "$STATUS"
DONATION_ID=$(jq -r '.data.donation.donationId' <<<"$BODY")
ORDER_ID=$(jq -r '.data.gatewayOrder.orderId' <<<"$BODY")
PAYMENT_ID="pay_test_${RUN}"
SIGNATURE=$(node -e '
  const crypto = require("crypto");
  const secret = process.env.PAYMENT_GATEWAY_KEY_SECRET || "test_secret_key_alumni_platform_2026";
  process.stdout.write(crypto.createHmac("sha256", secret).update(process.argv[1] + "|" + process.argv[2]).digest("hex"));
' "$ORDER_ID" "$PAYMENT_ID")

req POST /api/donations/verify "$ALUM_TOKEN" "{\"donationId\":$DONATION_ID,\"gatewayOrderId\":\"$ORDER_ID\",\"gatewayPaymentId\":\"$PAYMENT_ID\",\"signature\":\"$SIGNATURE\"}"
check "verify donation -> 200 (SUCCESS)" "200 SUCCESS" "$STATUS $(jq -r '.data.donationStatus' <<<"$BODY")"

req GET "/api/campaigns/$CAMP_ID"
check "campaign raised amount reflects donation" 5000 "$(jq '.data.amountRaised' <<<"$BODY")"

section "C3  Donation receipts + donor history"
req GET "/api/donations/$DONATION_ID/receipt" "$ALUM_TOKEN"
check "fetch receipt -> 200" 200 "$STATUS"
check "receipt number generated" true "$(jq -r '.data.receiptNo | test("^REC-")' <<<"$BODY")"
req GET /api/donations/my "$ALUM_TOKEN"
check "donor history lists donation" 1 "$(jq '[.data[] | select(.donationId == '$DONATION_ID')] | length' <<<"$BODY")"

section "C4  Success stories (submit, admin review, publish)"
req POST /api/stories "$ALUM_TOKEN" "{\"title\":\"From College Lab to Principal Engineer $RUN\",\"body\":\"My comprehensive journey learning systems architecture at our university and scaling distributed databases.\",\"category\":\"CAREER\"}"
check "alumni submits story -> 201 (SUBMITTED)" "201 SUBMITTED" "$STATUS $(jq -r '.data.status' <<<"$BODY")"
STORY_ID=$(jq -r '.data.storyId' <<<"$BODY")

# Pending story must be hidden from public feed
req GET /api/stories
check "pending story hidden from public feed" 0 "$(jq '[.data[] | select(.storyId == '$STORY_ID')] | length' <<<"$BODY")"

# Admin reviews and approves story
req PATCH "/api/stories/$STORY_ID/review" "$ADMIN_TOKEN" '{"status":"APPROVED","reviewNote":"Inspiring journey for our current students."}'
check "admin approves story -> 200" 200 "$STATUS"

# Approved story is now public
req GET /api/stories
check "approved story is now public" 1 "$(jq '[.data[] | select(.storyId == '$STORY_ID')] | length' <<<"$BODY")"

# Author received review notification
req GET /api/notifications "$ALUM_TOKEN"
check "author notified of story review" true "$(jq '[.data[] | select(.type == "STORY_REVIEW")] | length > 0' <<<"$BODY")"

section "C5  Surveys (create with questions, respond, 1-response rule)"
SURVEY_JSON="{\"title\":\"Campus Innovation Survey $RUN\",\"description\":\"Inputs on campus innovation and research labs.\",\"status\":\"ACTIVE\",\"questions\":[{\"questionText\":\"Rate research facilities (1-5)\",\"questionType\":\"RATING\",\"isRequired\":true,\"position\":1},{\"questionText\":\"Preferred tech track\",\"questionType\":\"SINGLE_CHOICE\",\"isRequired\":true,\"position\":2,\"options\":[\"AI/ML\",\"Web/Cloud\",\"Systems\"]},{\"questionText\":\"Feedback comments\",\"questionType\":\"TEXT\",\"isRequired\":false,\"position\":3}]}"
req POST /api/surveys "$ADMIN_TOKEN" "$SURVEY_JSON"
check "admin creates survey with questions -> 201" 201 "$STATUS"
SURVEY_ID=$(jq -r '.data.surveyId' <<<"$BODY")
Q1_ID=$(jq -r '.data.questions[0].questionId' <<<"$BODY")
Q2_ID=$(jq -r '.data.questions[1].questionId' <<<"$BODY")
OPT_ID=$(jq -r '.data.questions[1].options[0].optionId' <<<"$BODY")
Q3_ID=$(jq -r '.data.questions[2].questionId' <<<"$BODY")

# Alumni responds
RESP_JSON="{\"answers\":[{\"questionId\":$Q1_ID,\"ratingValue\":5},{\"questionId\":$Q2_ID,\"optionIds\":[$OPT_ID]},{\"questionId\":$Q3_ID,\"answerText\":\"Excellent initiatives across labs.\"}]}"
req POST "/api/surveys/$SURVEY_ID/responses" "$ALUM_TOKEN" "$RESP_JSON"
check "submit survey response -> 201" 201 "$STATUS"

# Duplicate response should be rejected with 409
req POST "/api/surveys/$SURVEY_ID/responses" "$ALUM_TOKEN" "$RESP_JSON"
check "duplicate survey response -> 409" 409 "$STATUS"

section "C6  Survey results & Feedback portal (OPEN -> IN_REVIEW -> CLOSED)"
# Aggregated survey results
req GET "/api/surveys/$SURVEY_ID/results" "$ADMIN_TOKEN"
check "survey results aggregated -> 200" 200 "$STATUS"
check "survey response count is 1" 1 "$(jq '.data.totalResponses' <<<"$BODY")"

# Feedback lifecycle
req POST /api/feedback "$ALUM_TOKEN" '{"category":"ACADEMIC","message":"Could we organize weekend open-source hackathons on campus?"}'
check "submit feedback -> 201 (OPEN)" "201 OPEN" "$STATUS $(jq -r '.data.status' <<<"$BODY")"
FB_ID=$(jq -r '.data.feedbackId' <<<"$BODY")

# Admin moves to IN_REVIEW with reply
req PATCH "/api/feedback/$FB_ID" "$ADMIN_TOKEN" '{"status":"IN_REVIEW","adminResponse":"Great idea! Coordinating with academic affairs."}'
check "admin updates feedback to IN_REVIEW -> 200" "200 IN_REVIEW" "$STATUS $(jq -r '.data.status' <<<"$BODY")"

# Alumni received notification
req GET /api/notifications "$ALUM_TOKEN"
check "user notified on feedback update" true "$(jq '[.data[] | select(.type == "FEEDBACK_REPLY")] | length > 0' <<<"$BODY")"

# Admin moves to CLOSED with resolution
req PATCH "/api/feedback/$FB_ID" "$ADMIN_TOKEN" '{"status":"CLOSED","adminResponse":"Approved and scheduled for next semester."}'
check "admin updates feedback to CLOSED -> 200" "200 CLOSED" "$STATUS $(jq -r '.data.status' <<<"$BODY")"

section "L16 Modern Authentication: Dual Tokens, Rotation, Replay Attack Detection & Google OAuth2"
# 1. Dual Token issuance on login
login "$ADMIN_EMAIL" "$ADMIN_PASSWORD"
CHECK_REFRESH_TOKEN=$(jq -r '.data.refreshToken' <<<"$BODY")
check "dual tokens: refresh token returned" true "$(jq '.data.refreshToken | type == "string"' <<<"$BODY")"

# 2. Token refresh & rotation (Slide 14)
req POST /api/auth/refresh "" "{\"refreshToken\":\"$CHECK_REFRESH_TOKEN\"}"
check "POST /api/auth/refresh -> 200 (rotated)" 200 "$STATUS"
ROTATED_TOKEN=$(jq -r '.data.refreshToken' <<<"$BODY")
check "new rotated refresh token issued" true "$([ "$CHECK_REFRESH_TOKEN" != "$ROTATED_TOKEN" ] && echo true || echo false)"

# 3. Replay attack detection (Slide 15)
req POST /api/auth/refresh "" "{\"refreshToken\":\"$CHECK_REFRESH_TOKEN\"}"
check "replay attack with old rotated token -> 403" 403 "$STATUS"

# 4. Safe Logout (Slide 16)
req POST /api/auth/logout "" "{\"refreshToken\":\"$ROTATED_TOKEN\"}"
check "safe logout revokes token -> 200" 200 "$STATUS"

# 5. Google OAuth 2.0 / OIDC Identity Proof & Sign-in (Slide 17-21)
OAUTH_SUB="g_eval_${RUN}"
OAUTH_EMAIL="google.eval.${RUN}@gec.edu"
req POST /api/auth/oauth/google "" "{\"idToken\":\"mock_google_token_email=${OAUTH_EMAIL}&name=Google%20Evaluator&sub=${OAUTH_SUB}\",\"role\":\"ALUMNI\"}"
check "Google OAuth sign-in -> 201" 201 "$STATUS"
OAUTH_TOKEN=$(jq -r '.data.token' <<<"$BODY")

# 6. Role Authorization on OAuth user (Slide 21: Google proves identity; app decides role & access)
req GET /api/admin/stats "$OAUTH_TOKEN"
check "OAuth user cannot access admin route -> 403" 403 "$STATUS"

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
