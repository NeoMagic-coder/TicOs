#!/bin/bash
set -e

# OneProduct Kubernetes Deployment Script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
K8S_DIR="$PROJECT_ROOT/k8s"

# Configuration
REGISTRY="${REGISTRY:-ghcr.io/yourorg/oneproduct}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
NAMESPACE="${NAMESPACE:-oneproduct}"
CONTEXT="${CONTEXT:-}"
ENVIRONMENT="${ENVIRONMENT:-prod}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  if ! command -v kubectl &> /dev/null; then
    log_error "kubectl not found. Please install kubectl."
    exit 1
  fi
  
  if ! command -v kustomize &> /dev/null; then
    log_warn "kustomize not found. Using kubectl kustomize."
    KUSTOMIZE_CMD="kubectl kustomize"
  else
    KUSTOMIZE_CMD="kustomize build"
  fi
  
  if ! kubectl cluster-info &> /dev/null; then
    log_error "Not connected to a Kubernetes cluster. Run 'kubectl config use-context <context>'."
    exit 1
  fi
  
  CURRENT_CONTEXT=$(kubectl config current-context)
  log_info "Connected to cluster context: $CURRENT_CONTEXT"
}

# Build Docker images
build_images() {
  log_info "Building Docker images..."
  
  docker build \
    -f "$PROJECT_ROOT/docker/backend.Dockerfile" \
    -t "$REGISTRY/api:$IMAGE_TAG" \
    "$PROJECT_ROOT/backend"
  
  docker build \
    -f "$PROJECT_ROOT/docker/frontend.Dockerfile" \
    -t "$REGISTRY/web:$IMAGE_TAG" \
    "$PROJECT_ROOT"
  
  log_info "Docker images built successfully"
}

# Push Docker images
push_images() {
  log_info "Pushing Docker images to registry..."
  
  docker push "$REGISTRY/api:$IMAGE_TAG"
  docker push "$REGISTRY/web:$IMAGE_TAG"
  
  log_info "Docker images pushed successfully"
}

# Create namespace
create_namespace() {
  log_info "Creating namespace: $NAMESPACE"
  
  kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
}

# Apply secrets
apply_secrets() {
  log_info "Applying secrets..."
  
  if [ -f "$K8S/overlays/$ENVIRONMENT/.env.secret" ]; then
    kubectl create secret generic oneproduct-secrets \
      -n "$NAMESPACE" \
      --from-env-file="$K8S/overlays/$ENVIRONMENT/.env.secret" \
      --dry-run=client -o yaml | kubectl apply -f -
    log_info "Secrets applied from environment file"
  else
    log_warn "Secret file not found at $K8S/overlays/$ENVIRONMENT/.env.secret. Using empty secrets."
    kubectl create secret generic oneproduct-secrets \
      -n "$NAMESPACE" \
      --from-literal=GEMINI_API_KEY="" \
      --from-literal=VITE_GEMINI_API_KEY="" \
      --dry-run=client -o yaml | kubectl apply -f -
  fi
}

# Deploy with kustomize
deploy() {
  log_info "Deploying to Kubernetes..."
  
  $KUSTOMIZE_CMD "$K8S_DIR" | \
    sed "s|REGISTRY|$REGISTRY|g; s|IMAGE_TAG|$IMAGE_TAG|g" | \
    kubectl apply -f -
  
  log_info "Deployment applied"
}

# Verify deployment
verify_deployment() {
  log_info "Verifying deployment..."
  
  log_info "Waiting for API deployment to be ready..."
  kubectl rollout status deployment/oneproduct-api -n "$NAMESPACE" --timeout=5m
  
  log_info "Waiting for Web deployment to be ready..."
  kubectl rollout status deployment/oneproduct-web -n "$NAMESPACE" --timeout=5m
  
  log_info "Checking pod status..."
  kubectl get pods -n "$NAMESPACE" -l app.kubernetes.io/name=oneproduct
  
  log_info "Checking service status..."
  kubectl get services -n "$NAMESPACE"
}

# Port forward for testing
port_forward() {
  log_info "Setting up port forwards for testing..."
  log_info "API available at: http://localhost:8000"
  log_info "Web available at: http://localhost:5173"
  log_info "Press Ctrl+C to stop"
  
  kubectl port-forward -n "$NAMESPACE" svc/api 8000:8000 &
  API_PID=$!
  
  kubectl port-forward -n "$NAMESPACE" svc/web 5173:5173 &
  WEB_PID=$!
  
  trap "kill $API_PID $WEB_PID" EXIT
  wait
}

# Show deployment info
show_info() {
  log_info "Deployment Information:"
  echo "  Namespace: $NAMESPACE"
  echo "  Registry: $REGISTRY"
  echo "  Image Tag: $IMAGE_TAG"
  echo "  Environment: $ENVIRONMENT"
  echo ""
  echo "Useful commands:"
  echo "  View logs:     kubectl logs -n $NAMESPACE -l app=oneproduct-api -f"
  echo "  Shell access:  kubectl exec -it -n $NAMESPACE pod/<pod-name> -- /bin/sh"
  echo "  Port forward:  kubectl port-forward -n $NAMESPACE svc/api 8000:8000"
  echo "  Watch pods:    kubectl get pods -n $NAMESPACE -w"
}

# Main
main() {
  case "${1:-deploy}" in
    build)
      check_prerequisites
      build_images
      ;;
    push)
      push_images
      ;;
    build-push)
      check_prerequisites
      build_images
      push_images
      ;;
    deploy)
      check_prerequisites
      create_namespace
      apply_secrets
      deploy
      verify_deployment
      show_info
      ;;
    verify)
      check_prerequisites
      verify_deployment
      ;;
    port-forward)
      check_prerequisites
      port_forward
      ;;
    *)
      echo "Usage: $0 {build|push|build-push|deploy|verify|port-forward}"
      echo ""
      echo "Commands:"
      echo "  build        Build Docker images locally"
      echo "  push         Push Docker images to registry"
      echo "  build-push   Build and push Docker images"
      echo "  deploy       Full deployment (build, push, deploy, verify)"
      echo "  verify       Verify deployment status"
      echo "  port-forward Setup port forwards for testing"
      exit 1
      ;;
  esac
}

main "$@"
