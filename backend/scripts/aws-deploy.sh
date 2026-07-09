#!/usr/bin/env bash
# Cobbli backend — AWS App Runner deploy.
#
# Portable by design: the container image we push to ECR is the artifact.
# App Runner runs it now; the same image drops onto ECS Fargate later with
# no app changes. Nothing here is pinned to a personal AWS account — it reads
# the caller's `aws` credentials and derives account/region at runtime.
#
# Prereqs:
#   - aws CLI configured (`aws configure`) with ECR + App Runner + IAM +
#     Secrets Manager permissions.
#   - A container builder: Docker/colima locally, OR pass BUILD=codebuild to
#     build in the cloud (no local Docker needed).
#   - Secrets already created in Secrets Manager (see aws-secrets.sh).
#
# Usage:
#   ./scripts/aws-deploy.sh                 # build locally, push, create/update service
#   BUILD=codebuild ./scripts/aws-deploy.sh # build in AWS CodeBuild instead
set -euo pipefail
cd "$(dirname "$0")/.."

REGION="${AWS_REGION:-us-east-1}"
REPO="${ECR_REPO:-cobbli-backend}"
SERVICE="${APPRUNNER_SERVICE:-cobbli-backend}"
SECRET_NAME="${SECRET_NAME:-cobbli/backend}"
TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%s)}"

command -v aws >/dev/null || { echo "aws CLI not found" >&2; exit 1; }

ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
ECR_HOST="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
IMAGE_URI="${ECR_HOST}/${REPO}:${TAG}"
echo "Account : ${ACCOUNT}"
echo "Region  : ${REGION}"
echo "Image   : ${IMAGE_URI}"

# 1) ECR repository (idempotent).
aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO" --region "$REGION" \
       --image-scanning-configuration scanOnPush=true >/dev/null
echo "ECR repo ready: ${REPO}"

# 2) Build + push image.
if [ "${BUILD:-local}" = "codebuild" ]; then
  echo "Cloud build path (CodeBuild) selected — see scripts/aws-codebuild.sh"
  ./scripts/aws-codebuild.sh "$IMAGE_URI"
else
  command -v docker >/dev/null || { echo "docker not found; use BUILD=codebuild" >&2; exit 1; }
  aws ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "$ECR_HOST"
  # linux/amd64 so it runs on App Runner regardless of the Mac's arch.
  docker build --platform linux/amd64 -t "$IMAGE_URI" .
  docker push "$IMAGE_URI"
fi
echo "Image pushed: ${IMAGE_URI}"

# 3) IAM roles (idempotent). Access role lets App Runner pull from ECR;
#    instance role lets the running task read secrets.
ACCESS_ROLE_ARN="$(./scripts/aws-roles.sh access "$REGION" "$ACCOUNT" "$SECRET_NAME")"
INSTANCE_ROLE_ARN="$(./scripts/aws-roles.sh instance "$REGION" "$ACCOUNT" "$SECRET_NAME")"
echo "Access role  : ${ACCESS_ROLE_ARN}"
echo "Instance role: ${INSTANCE_ROLE_ARN}"

# 4) Create or update the App Runner service.
SVC_ARN="$(aws apprunner list-services --region "$REGION" \
  --query "ServiceSummaryList[?ServiceName=='${SERVICE}'].ServiceArn | [0]" --output text)"

RUNTIME_SECRETS="$(SECRET_NAME="$SECRET_NAME" REGION="$REGION" ACCOUNT="$ACCOUNT" \
  ./scripts/aws-runtime-env.sh)"

if [ "$SVC_ARN" = "None" ] || [ -z "$SVC_ARN" ]; then
  echo "Creating App Runner service '${SERVICE}'…"
  aws apprunner create-service --region "$REGION" \
    --service-name "$SERVICE" \
    --source-configuration "$(cat <<JSON
{
  "AuthenticationConfiguration": { "AccessRoleArn": "${ACCESS_ROLE_ARN}" },
  "AutoDeploymentsEnabled": false,
  "ImageRepository": {
    "ImageIdentifier": "${IMAGE_URI}",
    "ImageRepositoryType": "ECR",
    "ImageConfiguration": {
      "Port": "8080",
      "RuntimeEnvironmentSecrets": ${RUNTIME_SECRETS}
    }
  }
}
JSON
)" \
    --instance-configuration "{\"Cpu\":\"0.25 vCPU\",\"Memory\":\"0.5 GB\",\"InstanceRoleArn\":\"${INSTANCE_ROLE_ARN}\"}" \
    --health-check-configuration '{"Protocol":"HTTP","Path":"/health","Interval":10,"Timeout":5,"HealthyThreshold":1,"UnhealthyThreshold":5}' \
    --query 'Service.ServiceArn' --output text
else
  echo "Updating existing service '${SERVICE}' → new image…"
  aws apprunner update-service --region "$REGION" --service-arn "$SVC_ARN" \
    --source-configuration "$(cat <<JSON
{
  "AuthenticationConfiguration": { "AccessRoleArn": "${ACCESS_ROLE_ARN}" },
  "AutoDeploymentsEnabled": false,
  "ImageRepository": {
    "ImageIdentifier": "${IMAGE_URI}",
    "ImageRepositoryType": "ECR",
    "ImageConfiguration": {
      "Port": "8080",
      "RuntimeEnvironmentSecrets": ${RUNTIME_SECRETS}
    }
  }
}
JSON
)" >/dev/null
  aws apprunner start-deployment --region "$REGION" --service-arn "$SVC_ARN" >/dev/null
  echo "Deployment started for ${SVC_ARN}"
fi

echo
echo "Done. Fetch the URL with:"
echo "  aws apprunner list-services --region ${REGION} --query \"ServiceSummaryList[?ServiceName=='${SERVICE}'].ServiceUrl\" --output text"
