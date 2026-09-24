#!/usr/bin/env bash
# Cloud image build via AWS CodeBuild — no local Docker required.
#
#   ./scripts/aws-codebuild.sh <image-uri>
#
# Zips the backend, uploads to an S3 build-source bucket, and runs a transient
# CodeBuild project (privileged, so it can run docker build) that builds the
# linux/amd64 image and pushes it to ECR. Idempotent: reuses the project/bucket
# if they already exist. Called by aws-deploy.sh when BUILD=codebuild.
set -euo pipefail
cd "$(dirname "$0")/.."

IMAGE_URI="${1:?usage: aws-codebuild.sh <image-uri>}"
REGION="${AWS_REGION:-us-east-1}"
PROJECT="${CODEBUILD_PROJECT:-cobbli-backend-build}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
BUCKET="${BUILD_BUCKET:-cobbli-backend-build-${ACCOUNT}-${REGION}}"
ECR_HOST="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"

# 1) S3 source bucket (idempotent).
aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null || {
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" >/dev/null
  else
    aws s3api create-bucket --bucket "$BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION" >/dev/null
  fi
}

# 2) buildspec: login to ECR, docker build/push linux/amd64.
cat > /tmp/buildspec.yml <<YAML
version: 0.2
phases:
  pre_build:
    commands:
      - aws ecr get-login-password --region ${REGION} | docker login --username AWS --password-stdin ${ECR_HOST}
  build:
    commands:
      - docker build --platform linux/amd64 -t ${IMAGE_URI} .
  post_build:
    commands:
      - docker push ${IMAGE_URI}
YAML

# 3) Bundle source (respects .dockerignore-ish exclusions).
ZIP="/tmp/cobbli-backend-src.zip"
rm -f "$ZIP"
cp /tmp/buildspec.yml ./buildspec.yml
zip -qr "$ZIP" app requirements.txt Dockerfile buildspec.yml
rm -f ./buildspec.yml
aws s3 cp "$ZIP" "s3://${BUCKET}/source.zip" >/dev/null

# 4) CodeBuild service role (idempotent) — needs ECR push + S3 read + logs.
CB_ROLE_ARN="$(./scripts/aws-roles.sh codebuild "$REGION" "$ACCOUNT" "$BUCKET" 2>/dev/null || true)"
if [ -z "$CB_ROLE_ARN" ] || [ "$CB_ROLE_ARN" = "None" ]; then
  echo "CodeBuild role not provisioned by aws-roles.sh; add a 'codebuild' case or create it manually." >&2
  exit 1
fi

# 5) Create/update project.
ENV_JSON="{\"type\":\"LINUX_CONTAINER\",\"image\":\"aws/codebuild/standard:7.0\",\"computeType\":\"BUILD_GENERAL1_SMALL\",\"privilegedMode\":true}"
SRC_JSON="{\"type\":\"S3\",\"location\":\"${BUCKET}/source.zip\"}"
if aws codebuild batch-get-projects --names "$PROJECT" --region "$REGION" \
     --query 'projects[0].name' --output text 2>/dev/null | grep -q "$PROJECT"; then
  aws codebuild update-project --name "$PROJECT" --region "$REGION" \
    --source "$SRC_JSON" --environment "$ENV_JSON" \
    --service-role "$CB_ROLE_ARN" --artifacts '{"type":"NO_ARTIFACTS"}' >/dev/null
else
  aws codebuild create-project --name "$PROJECT" --region "$REGION" \
    --source "$SRC_JSON" --environment "$ENV_JSON" \
    --service-role "$CB_ROLE_ARN" --artifacts '{"type":"NO_ARTIFACTS"}' >/dev/null
fi

# 6) Run the build and wait.
BUILD_ID="$(aws codebuild start-build --project-name "$PROJECT" --region "$REGION" \
  --query 'build.id' --output text)"
echo "CodeBuild started: ${BUILD_ID} — waiting…"
while true; do
  STATUS="$(aws codebuild batch-get-builds --ids "$BUILD_ID" --region "$REGION" \
    --query 'builds[0].buildStatus' --output text)"
  case "$STATUS" in
    SUCCEEDED) echo "Build succeeded."; break;;
    FAILED|FAULT|STOPPED|TIMED_OUT) echo "Build $STATUS — see CodeBuild logs." >&2; exit 1;;
    *) sleep 10;;
  esac
done
