#!/bin/bash
set -e

# Quick local development setup with Kubernetes (using minikube or Docker Desktop)

NAMESPACE="oneproduct"
REGISTRY="localhost:5000/oneproduct"

echo "🐳 OneProduct Local Kubernetes Development Setup"
echo ""

# Check if running on Docker Desktop or minikube
if kubectl config current-context | grep -q "docker-desktop"; then
  echo "✓ Running on Docker Desktop"
  REGISTRY="docker.io/yourusername/oneproduct"
elif kubectl config current-context | grep -q "minikube"; then
  echo "✓ Running on minikube"
  echo "ℹ️  Using local registry. Ensure minikube registry addon is enabled:"
  echo "   minikube addons enable registry"
  echo ""
elif kubectl config current-context | grep -q "kind"; then
  echo "✓ Running on kind (Kubernetes in Docker)"
  echo "ℹ️  Building images inside kind cluster..."
else
  echo "⚠️  Unsure about your cluster. Proceeding anyway..."
fi

echo "📦 Building images..."
docker build -f ./docker/backend.Dockerfile -t "$REGISTRY/api:latest" ./backend
docker build -f ./docker/frontend.Dockerfile -t "$REGISTRY/web:latest" .

echo "🏗️  Creating namespace..."
kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

echo "🔐 Creating secrets (empty for now)..."
kubectl create secret generic oneproduct-secrets \
  -n "$NAMESPACE" \
  --from-literal=GEMINI_API_KEY="" \
  --from-literal=VITE_GEMINI_API_KEY="" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "🚀 Deploying to Kubernetes..."
kubectl kustomize k8s | \
  sed "s|REGISTRY/api|$REGISTRY/api|g; s|REGISTRY/web|$REGISTRY/web|g" | \
  kubectl apply -f -

echo ""
echo "⏳ Waiting for deployments to be ready..."
kubectl rollout status deployment/oneproduct-api -n "$NAMESPACE" --timeout=3m || true
kubectl rollout status deployment/oneproduct-web -n "$NAMESPACE" --timeout=3m || true

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Pod status:"
kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=oneproduct

echo ""
echo "🔗 Port forwarding (run in another terminal):"
echo "   kubectl port-forward -n $NAMESPACE svc/api 8000:8000 &"
echo "   kubectl port-forward -n $NAMESPACE svc/web 5173:5173 &"
echo ""
echo "📝 View logs:"
echo "   kubectl logs -n $NAMESPACE -l app=oneproduct-api -f"
echo "   kubectl logs -n $NAMESPACE -l app=oneproduct-web -f"
