#!/usr/bin/env bash
# Emit the App Runner RuntimeEnvironmentSecrets JSON: each env var mapped to a
# specific key inside the single Secrets Manager JSON secret via the
# "arn:...:secret:NAME:JSONKEY::" reference form. App Runner resolves these at
# container start, so no secret value ever lands in the service config.
set -euo pipefail

REGION="${REGION:-${AWS_REGION:-us-east-1}}"
SECRET_NAME="${SECRET_NAME:-cobbli/backend}"
ACCOUNT="${ACCOUNT:-$(aws sts get-caller-identity --query Account --output text)}"

# Resolve the full secret ARN (includes the random 6-char suffix).
SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "$SECRET_NAME" \
  --region "$REGION" --query 'ARN' --output text)"

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

OUT="{"; SEP=""
for k in "${KEYS[@]}"; do
  OUT="${OUT}${SEP}\"${k}\":\"${SECRET_ARN}:${k}::\""
  SEP=","
done
OUT="${OUT}}"
printf '%s' "$OUT"
