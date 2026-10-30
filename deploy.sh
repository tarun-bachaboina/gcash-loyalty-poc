#!/usr/bin/env bash
# Build the image, push it to ECR, and deploy/update the Fargate stack.
# Usage: ./deploy.sh            (HTTP only)
#        CERT_ARN=arn:aws:acm:... ./deploy.sh   (adds HTTPS; needed for the POS camera)
set -euo pipefail

STACK="${STACK:-gcash-loyalty-poc}"
REGION="${AWS_REGION:-$(aws configure get region || true)}"
REGION="${REGION:-ap-south-1}"
REPO="${REPO:-gcash-loyalty-poc}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d%H%M%S)}"
CERT_ARN="${CERT_ARN:-}"

ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
IMAGE="$REGISTRY/$REPO:$TAG"

echo "==> Account $ACCOUNT, region $REGION, image $IMAGE"

aws ecr describe-repositories --repository-names "$REPO" --region "$REGION" >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name "$REPO" --region "$REGION" \
       --image-scanning-configuration scanOnPush=true >/dev/null

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REGISTRY"

# Fargate runs x86_64 here; --platform matters if you build on an Apple Silicon Mac.
docker build --platform linux/amd64 -t "$IMAGE" .
docker push "$IMAGE"

aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file infra/fargate.yml \
  --capabilities CAPABILITY_IAM \
  --no-fail-on-empty-changeset \
  --parameter-overrides ImageUri="$IMAGE" CertificateArn="$CERT_ARN"

URL=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='AppUrl'].OutputValue" --output text)
echo
echo "==> Deployed: $URL"
echo "    Customer: $URL/customer/   Merchant: $URL/merchant/"
echo "    Admin:    $URL/admin/      POS:      $URL/pos/"
