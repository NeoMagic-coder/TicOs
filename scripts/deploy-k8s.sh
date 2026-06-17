#!/bin/bash
set -e

REGISTRY="${REGISTRY:-ghcr.io/yourorg/oneproduct}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
NAMESPACE="${NAMESPACE:-oneproduct}"
ENVIRONMENT="${ENVIRONMENT:-staging}"

echo "Deploying to Kubernetes ($ENVIRONMENT)..."

if [ ! -f "$HOME/.kube/config" ]; then
    echo "Error: kubectl config not found at $HOME/.kube/config"
    exit 1
fi

echo "Creating namespace..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "Updating image references..."
sed -e "s|REGISTRY|$REGISTRY|g" \
    -e "s|IMAGE_TAG|$IMAGE_TAG|g" \
    k8s/deployment.yaml | kubectl apply -f -

echo "Applying service configuration..."
kubectl apply -f k8s/service.yaml

echo "Applying ingress configuration (if available)..."
if [ -f "k8s/ingress.yaml" ]; then
    sed -e "s|oneproduct.example.com|${DOMAIN:-oneproduct.local}|g" \
        k8s/ingress.yaml | kubectl apply -f -
fi

echo "Waiting for rollout..."
kubectl rollout status deployment/oneproduct-api -n "$NAMESPACE" --timeout=10m
kubectl rollout status deployment/oneproduct-web -n "$NAMESPACE" --timeout=10m

echo "Getting service endpoints..."
kubectl get svc -n "$NAMESPACE"
kubectl get ingress -n "$NAMESPACE"

echo "✓ Deployment complete!"
