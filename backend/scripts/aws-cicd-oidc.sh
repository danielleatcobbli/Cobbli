#!/usr/bin/env bash
# One-time setup of GitHub Actions OIDC → AWS for the backend deploy pipeline.
#
# Creates:
#   1. An IAM OIDC identity provider for token.actions.githubusercontent.com
#      (skipped if it already exists).
#   2. An IAM role `cobbli-github-deploy` that ONLY the given GitHub repo can
#      assume via OIDC (no long-lived keys), with permissions to push to ECR
#      and trigger an App Runner deployment.
#
# Idempotent. Run once with an admin identity:
#   ./scripts/aws-cicd-oidc.sh                       # defaults to danielleatcobbli/Cobbli
#   GITHUB_REPO=owner/repo ./scripts/aws-cicd-oidc.sh
set -euo pipefail

REGION="${AWS_REGION:-us-east-1}"
GITHUB_REPO="${GITHUB_REPO:-danielleatcobbli/Cobbli}"
ROLE_NAME="${CICD_ROLE:-cobbli-github-deploy}"
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)"
PROVIDER_URL="token.actions.githubusercontent.com"
PROVIDER_ARN="arn:aws:iam::${ACCOUNT}:oidc-provider/${PROVIDER_URL}"

# 1) OIDC provider (idempotent). GitHub's thumbprint is no longer verified by
#    AWS for this provider, but the API still requires the field.
if ! aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$PROVIDER_ARN" >/dev/null 2>&1; then
  echo "Creating GitHub OIDC provider…"
  aws iam create-open-id-connect-provider \
    --url "https://${PROVIDER_URL}" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" >/dev/null
else
  echo "OIDC provider already exists."
fi

# 2) Trust policy — only this repo (any branch) may assume the role.
TRUST="$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "${PROVIDER_ARN}" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": { "${PROVIDER_URL}:aud": "sts.amazonaws.com" },
        "StringLike": { "${PROVIDER_URL}:sub": "repo:${GITHUB_REPO}:*" }
      }
    }
  ]
}
JSON
)"

if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" \
    --policy-document "$TRUST" >/dev/null
  echo "Updated trust on ${ROLE_NAME}."
else
  aws iam create-role --role-name "$ROLE_NAME" \
    --assume-role-policy-document "$TRUST" \
    --description "GitHub Actions deploy for ${GITHUB_REPO}" >/dev/null
  echo "Created role ${ROLE_NAME}."
fi

# 3) Permissions: ECR push + App Runner deploy + pass the App Runner roles.
aws iam put-role-policy --role-name "$ROLE_NAME" \
  --policy-name deploy-backend \
  --policy-document "$(cat <<JSON
{
  "Version": "2012-10-17",
  "Statement": [
    {"Sid":"EcrAuth","Effect":"Allow","Action":["ecr:GetAuthorizationToken"],"Resource":"*"},
    {"Sid":"EcrPush","Effect":"Allow","Action":[
      "ecr:BatchCheckLayerAvailability","ecr:InitiateLayerUpload","ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload","ecr:PutImage","ecr:BatchGetImage","ecr:DescribeRepositories"
    ],"Resource":"arn:aws:ecr:${REGION}:${ACCOUNT}:repository/cobbli-backend"},
    {"Sid":"AppRunnerDeploy","Effect":"Allow","Action":[
      "apprunner:StartDeployment","apprunner:UpdateService","apprunner:DescribeService",
      "apprunner:ListServices","apprunner:ListOperations"
    ],"Resource":"*"},
    {"Sid":"PassAppRunnerRoles","Effect":"Allow","Action":["iam:PassRole"],
      "Resource":[
        "arn:aws:iam::${ACCOUNT}:role/cobbli-apprunner-access",
        "arn:aws:iam::${ACCOUNT}:role/cobbli-apprunner-instance"
      ]}
  ]
}
JSON
)" >/dev/null
echo "Attached deploy policy."

echo
echo "Role ARN (add as GitHub secret AWS_DEPLOY_ROLE_ARN):"
aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text
