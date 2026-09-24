#!/usr/bin/env bash
# Create (idempotently) the two IAM roles App Runner needs and print the ARN.
#
#   aws-roles.sh access   <region> <account> <secret_name>   # ECR pull role
#   aws-roles.sh instance <region> <account> <secret_name>   # runtime secrets-read role
#
# Least privilege: the access role only pulls images; the instance role only
# reads the one Secrets Manager secret this service uses.
set -euo pipefail

KIND="$1"; REGION="$2"; ACCOUNT="$3"; SECRET_NAME="$4"

ensure_role() {
  local name="$1" trust="$2"
  if ! aws iam get-role --role-name "$name" >/dev/null 2>&1; then
    aws iam create-role --role-name "$name" \
      --assume-role-policy-document "$trust" >/dev/null
    # New role needs a moment to propagate before it can be attached to a service.
    sleep 8
  fi
  aws iam get-role --role-name "$name" --query 'Role.Arn' --output text
}

BUILD_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"build.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
TASKS_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"tasks.apprunner.amazonaws.com"},"Action":"sts:AssumeRole"}]}'

case "$KIND" in
  access)
    ARN="$(ensure_role cobbli-apprunner-access "$BUILD_TRUST")"
    # AWS-managed policy scoped to ECR pull for App Runner.
    aws iam attach-role-policy --role-name cobbli-apprunner-access \
      --policy-arn arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess >/dev/null 2>&1 || true
    echo "$ARN"
    ;;
  instance)
    ARN="$(ensure_role cobbli-apprunner-instance "$TASKS_TRUST")"
    SECRET_ARN_GLOB="arn:aws:secretsmanager:${REGION}:${ACCOUNT}:secret:${SECRET_NAME}-*"
    aws iam put-role-policy --role-name cobbli-apprunner-instance \
      --policy-name read-backend-secret \
      --policy-document "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "${SECRET_ARN_GLOB}"
    }
  ]
}
JSON
)" >/dev/null
    echo "$ARN"
    ;;
  codebuild)
    # $4 is the S3 build-source bucket here (not a secret name).
    BUCKET="$SECRET_NAME"
    CB_TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"codebuild.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
    ARN="$(ensure_role cobbli-codebuild "$CB_TRUST")"
    aws iam put-role-policy --role-name cobbli-codebuild \
      --policy-name codebuild-build-push \
      --policy-document "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Effect":"Allow","Action":["logs:CreateLogGroup","logs:CreateLogStream","logs:PutLogEvents"],"Resource":"arn:aws:logs:${REGION}:${ACCOUNT}:log-group:/aws/codebuild/*"},
    {"Effect":"Allow","Action":["s3:GetObject","s3:GetObjectVersion"],"Resource":"arn:aws:s3:::${BUCKET}/*"},
    {"Effect":"Allow","Action":["ecr:GetAuthorizationToken"],"Resource":"*"},
    {"Effect":"Allow","Action":["ecr:BatchCheckLayerAvailability","ecr:InitiateLayerUpload","ecr:UploadLayerPart","ecr:CompleteLayerUpload","ecr:PutImage","ecr:BatchGetImage"],"Resource":"arn:aws:ecr:${REGION}:${ACCOUNT}:repository/*"}
  ]
}
JSON
)" >/dev/null
    echo "$ARN"
    ;;
  *)
    echo "unknown role kind: $KIND" >&2; exit 1;;
esac
