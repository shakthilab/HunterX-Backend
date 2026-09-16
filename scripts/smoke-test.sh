#!/usr/bin/env bash
# End-to-end smoke test for the Arise Backend.
#
# Logs in as the seeded admin (admin@arise.com / admin123), then hits every
# endpoint in the spec in sequence, printing PASS/FAIL per step. Run it
# against a live `npm run dev` server:
#
#   bash scripts/smoke-test.sh
#   BASE_URL=http://localhost:4000/api/v1 bash scripts/smoke-test.sh
#
# Requires: bash, curl. No jq dependency — response fields are pulled out
# with grep so this runs on a bare-bones CI image too.

set -uo pipefail

BASE_URL="${BASE_URL:-http://localhost:4000/api/v1}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASS=0
FAIL=0

# check DESCRIPTION EXPECTED_STATUS ACTUAL_STATUS
check() {
  local desc="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    printf 'PASS  [%s] %s\n' "$actual" "$desc"
    PASS=$((PASS + 1))
  else
    printf 'FAIL  [expected %s, got %s] %s\n' "$expected" "$actual" "$desc"
    FAIL=$((FAIL + 1))
  fi
}

# json_str FILE KEY -> value of the first top-level "key":"string value" match
json_str() {
  grep -o "\"$2\":\"[^\"]*\"" "$1" | head -1 | cut -d'"' -f4
}

req() {
  # req METHOD PATH OUT_FILE [curl-args...] -> prints http status code
  local method="$1" path="$2" out="$3"
  shift 3
  curl -s -o "$out" -w '%{http_code}' -X "$method" "$BASE_URL$path" "$@"
}

echo "== Arise Backend smoke test =="
echo "Base URL: $BASE_URL"
echo

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

code=$(req GET /admin/users "$TMP/out.json")
check "GET /admin/users with no Authorization header -> 401" 401 "$code"

code=$(req POST /auth/login "$TMP/out.json" -H 'Content-Type: application/json' \
  -d '{"email":"admin@arise.com","password":"wrong-password"}')
check "POST /auth/login wrong password -> 401" 401 "$code"

code=$(req POST /auth/login "$TMP/login.json" -H 'Content-Type: application/json' \
  -d '{"email":"admin@arise.com","password":"admin123"}')
check "POST /auth/login admin@arise.com/admin123 -> 200" 200 "$code"

ACCESS_TOKEN="$(json_str "$TMP/login.json" accessToken)"
REFRESH_TOKEN="$(json_str "$TMP/login.json" refreshToken)"
AUTH=(-H "Authorization: Bearer $ACCESS_TOKEN")

if [ -z "$ACCESS_TOKEN" ]; then
  echo "FATAL: could not extract accessToken from login response, aborting."
  cat "$TMP/login.json"
  exit 1
fi

code=$(req GET /admin/users "$TMP/out.json" -H 'Authorization: Bearer garbage-token')
check "GET /admin/users with invalid token -> 401" 401 "$code"

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

for path in \
  "/admin/dashboard/kpis" \
  "/admin/dashboard/subscriptions" \
  "/admin/dashboard/mrr-trend?days=90" \
  "/admin/dashboard/dau-trend?days=30" \
  "/admin/dashboard/streak-dropoff" \
  "/admin/dashboard/rank-distribution" \
  "/admin/dashboard/transactions?limit=10" \
  "/admin/dashboard/referrals" \
  "/admin/dashboard/top-referrers" \
  "/admin/dashboard/referral-activity" \
  "/admin/dashboard/coupons" \
  "/admin/dashboard/coupon-activity" \
  "/admin/dashboard/needs-attention"; do
  code=$(req GET "$path" "$TMP/out.json" "${AUTH[@]}")
  check "GET $path -> 200" 200 "$code"
done

# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------

code=$(req GET /admin/users "$TMP/users.json" "${AUTH[@]}")
check "GET /admin/users -> 200" 200 "$code"
USER_ID="$(grep -o '"id":"usr_[0-9]*"' "$TMP/users.json" | head -1 | cut -d'"' -f4)"

code=$(req GET /admin/users/stats "$TMP/out.json" "${AUTH[@]}")
check "GET /admin/users/stats -> 200" 200 "$code"

code=$(req GET "/admin/users/$USER_ID" "$TMP/out.json" "${AUTH[@]}")
check "GET /admin/users/:id -> 200" 200 "$code"

code=$(req GET /admin/users/usr_does_not_exist "$TMP/out.json" "${AUTH[@]}")
check "GET /admin/users/:id (unknown id) -> 404" 404 "$code"

code=$(req PATCH "/admin/users/$USER_ID/ban" "$TMP/out.json" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d '{"reason":"Smoke test ban"}')
check "PATCH /admin/users/:id/ban -> 200" 200 "$code"

code=$(req PATCH "/admin/users/$USER_ID/unban" "$TMP/out.json" "${AUTH[@]}")
check "PATCH /admin/users/:id/unban -> 200" 200 "$code"

code=$(req POST "/admin/users/$USER_ID/xp-adjustment" "$TMP/out.json" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d '{"delta":50,"reason":"Smoke test adjustment"}')
check "POST /admin/users/:id/xp-adjustment -> 200" 200 "$code"

code=$(req POST "/admin/users/$USER_ID/xp-adjustment" "$TMP/out.json" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d '{"delta":0,"reason":"invalid"}')
check "POST /admin/users/:id/xp-adjustment delta=0 -> 400" 400 "$code"

code=$(req POST "/admin/users/$USER_ID/reset-streak" "$TMP/out.json" "${AUTH[@]}")
check "POST /admin/users/:id/reset-streak -> 200" 200 "$code"

# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

code=$(req GET /admin/tasks "$TMP/tasks.json" "${AUTH[@]}")
check "GET /admin/tasks -> 200" 200 "$code"
TASK_ID="$(grep -o '"id":"tsk_[0-9]*"' "$TMP/tasks.json" | head -1 | cut -d'"' -f4)"

code=$(req GET /admin/tasks/stats "$TMP/out.json" "${AUTH[@]}")
check "GET /admin/tasks/stats -> 200" 200 "$code"

code=$(req GET "/admin/tasks/$TASK_ID" "$TMP/out.json" "${AUTH[@]}")
check "GET /admin/tasks/:id -> 200" 200 "$code"

code=$(req GET /admin/tasks/tsk_does_not_exist "$TMP/out.json" "${AUTH[@]}")
check "GET /admin/tasks/:id (unknown id) -> 404" 404 "$code"

code=$(req GET "/admin/tasks/$TASK_ID/completions" "$TMP/out.json" "${AUTH[@]}")
check "GET /admin/tasks/:id/completions -> 200" 200 "$code"

code=$(req GET "/admin/tasks/$TASK_ID/assignment-stats" "$TMP/out.json" "${AUTH[@]}")
check "GET /admin/tasks/:id/assignment-stats -> 200" 200 "$code"

code=$(req GET /admin/tasks/review-queue "$TMP/reviews.json" "${AUTH[@]}")
check "GET /admin/tasks/review-queue -> 200" 200 "$code"
REVIEW_ID="$(grep -o '"id":"rev_[A-Za-z0-9_]*"' "$TMP/reviews.json" | head -1 | cut -d'"' -f4)"

code=$(req POST "/admin/tasks/review-queue/$REVIEW_ID/decision" "$TMP/out.json" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d '{"status":"approved"}')
check "POST /admin/tasks/review-queue/:id/decision -> 200" 200 "$code"

code=$(req POST /admin/tasks/review-queue/rev_does_not_exist/decision "$TMP/out.json" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d '{"status":"approved"}')
check "POST /admin/tasks/review-queue/:id/decision (unknown id) -> 404" 404 "$code"

NEW_TASK_BODY='{
  "title": "Smoke Test Task",
  "description": "Created by scripts/smoke-test.sh.",
  "tag": "Testing",
  "imageUrl": null,
  "type": "daily",
  "isDefaultDaily": false,
  "recurrenceDays": null,
  "startDate": null,
  "endDate": null,
  "levelTarget": null,
  "targetValue": 10,
  "targetUnit": "minutes",
  "allowsPartial": true,
  "xpPartial": 20,
  "xpReward": 100,
  "verificationMethod": "manual",
  "verificationConfig": { "requiresNote": true },
  "status": "active"
}'

code=$(req POST /admin/tasks "$TMP/created_task.json" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d "$NEW_TASK_BODY")
check "POST /admin/tasks -> 201" 201 "$code"
NEW_TASK_ID="$(grep -o '"id":"tsk_[A-Za-z0-9_]*"' "$TMP/created_task.json" | head -1 | cut -d'"' -f4)"

UPDATED_TASK_BODY='{
  "title": "Smoke Test Task (GPS variant)",
  "description": "Updated by scripts/smoke-test.sh.",
  "tag": "Testing",
  "imageUrl": null,
  "type": "daily",
  "isDefaultDaily": false,
  "recurrenceDays": null,
  "startDate": null,
  "endDate": null,
  "levelTarget": null,
  "targetValue": 2,
  "targetUnit": "km",
  "allowsPartial": true,
  "xpPartial": 50,
  "xpReward": 250,
  "verificationMethod": "gps_tracked",
  "verificationConfig": { "gpsMinDistanceKm": 2, "gpsMaxDurationMin": 60 },
  "status": "active"
}'

code=$(req PUT "/admin/tasks/$NEW_TASK_ID" "$TMP/out.json" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d "$UPDATED_TASK_BODY")
check "PUT /admin/tasks/:id -> 200" 200 "$code"

code=$(req PUT /admin/tasks/tsk_does_not_exist "$TMP/out.json" "${AUTH[@]}" \
  -H 'Content-Type: application/json' -d "$UPDATED_TASK_BODY")
check "PUT /admin/tasks/:id (unknown id) -> 404" 404 "$code"

# ---------------------------------------------------------------------------
# Refresh / logout
# ---------------------------------------------------------------------------

code=$(req POST /auth/refresh "$TMP/refresh.json" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
check "POST /auth/refresh -> 200" 200 "$code"
ROTATED_REFRESH_TOKEN="$(json_str "$TMP/refresh.json" refreshToken)"

code=$(req POST /auth/refresh "$TMP/out.json" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH_TOKEN\"}")
check "POST /auth/refresh reusing a rotated-out token -> 401" 401 "$code"

code=$(req POST /auth/logout "$TMP/out.json" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$ROTATED_REFRESH_TOKEN\"}")
check "POST /auth/logout -> 200" 200 "$code"

code=$(req POST /auth/refresh "$TMP/out.json" -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$ROTATED_REFRESH_TOKEN\"}")
check "POST /auth/refresh with a revoked (logged out) token -> 401" 401 "$code"

# ---------------------------------------------------------------------------

echo
echo "Passed: $PASS   Failed: $FAIL"
if [ "$FAIL" -ne 0 ]; then
  exit 1
fi
