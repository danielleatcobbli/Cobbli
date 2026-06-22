#!/usr/bin/env bash
# Cobbli backend — Vercel deploy helper.
#
# Designed to be transferable: nothing in this repo pins the deploy to a specific
# Vercel team / personal account. Account ownership lives in `.vercel/` (gitignored)
# and is set up the first time you run `vercel link` here.
#
# To hand the deploy off to Danielle (or any other account) later:
#   1. rm -rf backend/.vercel
#   2. cd backend && vercel link        # she picks her team
#   3. vercel env pull / add  for each secret listed in .env.example
#   4. vercel deploy --prod
#
# Usage:
#   ./scripts/vercel-deploy.sh              # preview deploy
#   ./scripts/vercel-deploy.sh --prod       # production deploy

set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v vercel >/dev/null 2>&1; then
  echo "vercel CLI not installed. Install with: npm i -g vercel" >&2
  exit 1
fi

if [ ! -d ".vercel" ]; then
  echo "Project not linked. Running 'vercel link' — pick the team to deploy under."
  vercel link
fi

REQUIRED_VARS=(
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  BREVO_API_KEY
  AI_API_KEY
  CORS_ALLOW_ORIGINS
)

echo "Verifying Vercel env vars are set (preview + production)…"
MISSING=()
EXISTING=$(vercel env ls 2>/dev/null || true)
for v in "${REQUIRED_VARS[@]}"; do
  if ! grep -q "\b$v\b" <<< "$EXISTING"; then
    MISSING+=("$v")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  echo
  echo "Missing env vars in Vercel:" >&2
  for v in "${MISSING[@]}"; do
    echo "  - $v" >&2
  done
  echo
  echo "Add each with: vercel env add <NAME>" >&2
  echo "Or run interactively:" >&2
  for v in "${MISSING[@]}"; do
    echo "    vercel env add $v" >&2
  done
  echo
  echo "Aborting. Re-run after secrets are configured." >&2
  exit 2
fi

if [ "${1:-}" = "--prod" ]; then
  echo "Deploying to PRODUCTION…"
  vercel deploy --prod
else
  echo "Deploying preview…"
  vercel deploy
fi
