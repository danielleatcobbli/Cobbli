#!/usr/bin/env bash
# Post-deploy smoke test against a running backend URL.
#
#   ./scripts/aws-smoke-test.sh https://xxxx.us-east-1.awsapprunner.com
#
# Verifies the service is up and that auth gates behave (no valid token =>
# 401 on protected routes, public routes reachable). Does NOT need real creds:
# it checks the *gate*, not the happy path. A gated route returning 200 here
# would be the alarm.
set -euo pipefail

BASE="${1:-}"
[ -n "$BASE" ] || { echo "usage: $0 <base-url>" >&2; exit 1; }
BASE="${BASE%/}"

PASS=0; FAIL=0
check() { # name  expected  method  path  [extra curl args...]
  local name="$1" expect="$2" method="$3" path="$4"; shift 4
  local code
  code="$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "$@" "${BASE}${path}")"
  if [ "$code" = "$expect" ]; then
    printf '  ok   %-6s %-32s -> %s\n' "$method" "$path" "$code"; PASS=$((PASS+1))
  else
    printf '  FAIL %-6s %-32s -> %s (expected %s)\n' "$method" "$path" "$code" "$expect"; FAIL=$((FAIL+1))
  fi
}

echo "Smoke-testing ${BASE}"

echo "[health — public, 200 + status:ok]"
body="$(curl -s "${BASE}/health")"
echo "  /health body: ${body}"
echo "$body" | grep -q '"status"[[:space:]]*:[[:space:]]*"ok"' \
  && { echo "  ok   status:ok present"; PASS=$((PASS+1)); } \
  || { echo "  FAIL status:ok missing"; FAIL=$((FAIL+1)); }
check "root" 200 GET /

echo "[protected — no token => 401]"
check "checkout"        401 POST /checkout/            -H 'Content-Type: application/json' -d '{}'
check "analyze-photos"  401 POST /analyze-shoe-photos/ -H 'Content-Type: application/json' -d '{}'
check "password-updated" 401 POST /email/password-updated -H 'Content-Type: application/json' -d '{}'

echo "[ops staff/admin — no token => 401]"
check "ops-assessments" 401 GET  /ops/assessments/
check "ops-profiles"    401 GET  '/ops/profiles?ids=00000000-0000-0000-0000-000000000000'
check "ops-blog-list"   401 GET  /ops/blog/posts

echo "[public blog reads — 200]"
check "blog-list"       200 GET  /blog/posts

echo "[stripe webhook — no signature => 400]"
check "stripe-webhook"  400 POST /stripe/webhook -H 'Content-Type: application/json' -d '{}'

echo
echo "Result: ${PASS} passed, ${FAIL} failed"
[ "$FAIL" -eq 0 ]
