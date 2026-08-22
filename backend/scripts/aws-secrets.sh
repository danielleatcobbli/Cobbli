#!/usr/bin/env bash
# Push backend secrets into AWS Secrets Manager as ONE JSON secret.
#
# Reads values from backend/.env.local (gitignored) so nothing secret is ever
# typed on the command line or committed. Missing keys are reported, not guessed.
#
#   ./scripts/aws-secrets.sh          # create/update cobbli/backend from .env.local
#
# The App Runner service reads individual keys out of this secret at runtime
# (see aws-runtime-env.sh), so rotating a value = update here + redeploy.
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-us-east-1}"
SECRET_NAME="${SECRET_NAME:-cobbli/backend}"
ENV_FILE="${ENV_FILE:-.env.local}"

[ -f "$ENV_FILE" ] || { echo "Missing $ENV_FILE — create it from .env.example first." >&2; exit 1; }

# Keys the running service expects. CORS + SITE_URL default in code but we set
# them explicitly for prod correctness.
KEYS=(
  SUPABASE_URL
  SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  BREVO_API_KEY
  AI_API_KEY
  CORS_ALLOW_ORIGINS
  SITE_URL
)

# Build JSON from env file, flag anything missing/empty.
JSON="{"; SEP=""; MISSING=()
for k in "${KEYS[@]}"; do
  v="$(grep -E "^${k}=" "$ENV_FILE" | head -1 | cut -d= -f2- || true)"
  # strip surrounding quotes if present
  v="${v%\"}"; v="${v#\"}"
  if [ -z "$v" ]; then MISSING+=("$k"); continue; fi
  esc="$(printf '%s' "$v" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')"
  JSON="${JSON}${SEP}\"${k}\":${esc}"
  SEP=","
done
JSON="${JSON}}"

if [ ${#MISSING[@]} -gt 0 ]; then
  echo "WARNING — these keys are missing/empty in ${ENV_FILE}:" >&2
  for m in "${MISSING[@]}"; do echo "  - $m" >&2; done
  echo "They will NOT be stored. SUPABASE_ANON_KEY missing => ops gateway bypasses RLS." >&2
  echo
fi

if aws secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws secretsmanager put-secret-value --secret-id "$SECRET_NAME" --region "$REGION" \
    --secret-string "$JSON" >/dev/null
  echo "Updated secret ${SECRET_NAME}."
else
  aws secretsmanager create-secret --name "$SECRET_NAME" --region "$REGION" \
    --description "Cobbli FastAPI backend runtime secrets" \
    --secret-string "$JSON" >/dev/null
  echo "Created secret ${SECRET_NAME}."
fi
