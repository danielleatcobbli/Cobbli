#!/usr/bin/env bash
#
# Deploy the Cobbli website to AWS Amplify (manual deploy).
#
#   ./scripts/deploy-amplify.sh staging      # the real site, for testing
#   ./scripts/deploy-amplify.sh production    # the public site (coming-soon gate stays ON)
#
# It always ships whatever is on the `main` branch. Environment settings
# (like the coming-soon gate) are pulled live from Amplify, so this stays in
# sync with whatever is configured in the Amplify console.
#
set -euo pipefail

APP_ID="d3b5kvxx3hwujt"
ENVIRONMENT="${1:-production}"

case "$ENVIRONMENT" in
  production|staging) ;;
  *) echo "Usage: $0 [production|staging]"; exit 1 ;;
esac

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "▶ Deploying '$ENVIRONMENT' for Cobbli…"

# 1. Get the latest approved code.
git checkout main
git pull --ff-only

# 2. Mirror this environment's settings from Amplify into the build.
echo "▶ Loading $ENVIRONMENT settings from Amplify…"
aws amplify get-branch --app-id "$APP_ID" --branch-name "$ENVIRONMENT" \
  --query 'branch.environmentVariables' --output json \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print('\n'.join(f'{k}={v}' for k,v in d.items()))" \
  > .env.production.local
echo "   $(grep -c . .env.production.local) settings loaded"

# 3. Build the site.
echo "▶ Building…"
npm ci
npm run build

# 4. Package and upload the built site.
echo "▶ Uploading to Amplify…"
ZIP="$(mktemp -t cobbli-deploy).zip"
( cd dist && zip -qr "$ZIP" . )
DEP_JSON="$(aws amplify create-deployment --app-id "$APP_ID" --branch-name "$ENVIRONMENT")"
JOB_ID="$(echo "$DEP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['jobId'])")"
UPLOAD_URL="$(echo "$DEP_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['zipUploadUrl'])")"
curl -s -T "$ZIP" "$UPLOAD_URL"
aws amplify start-deployment --app-id "$APP_ID" --branch-name "$ENVIRONMENT" --job-id "$JOB_ID" >/dev/null

# 5. Wait for it to go live.
echo "▶ Publishing…"
for _ in $(seq 1 40); do
  STATUS="$(aws amplify get-job --app-id "$APP_ID" --branch-name "$ENVIRONMENT" --job-id "$JOB_ID" --query 'job.summary.status' --output text)"
  case "$STATUS" in
    SUCCEED)
      rm -f "$ZIP" .env.production.local
      echo "✅ Live: https://$ENVIRONMENT.$APP_ID.amplifyapp.com"
      exit 0 ;;
    FAILED|CANCELLED)
      rm -f "$ZIP" .env.production.local
      echo "❌ Deploy $STATUS — check the Amplify console."
      exit 1 ;;
    *) sleep 6 ;;
  esac
done
rm -f "$ZIP" .env.production.local
echo "⏳ Still publishing — check the Amplify console in a minute."
