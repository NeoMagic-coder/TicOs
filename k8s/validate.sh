#!/bin/bash
set -e

# Kubernetes manifest validation script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K8S_DIR="$SCRIPT_DIR"

echo "🔍 Validating Kubernetes manifests..."
echo ""

validate_manifest() {
  local file="$1"
  echo "Checking: $file"
  
  if ! kubectl apply -f "$file" --dry-run=client -o yaml > /dev/null 2>&1; then
    echo "❌ Invalid: $file"
    kubectl apply -f "$file" --dry-run=client -o yaml
    return 1
  else
    echo "✓ Valid: $file"
  fi
}

validate_kustomize() {
  local dir="$1"
  local name="$2"
  echo ""
  echo "Checking kustomize: $dir ($name)"
  
  if ! kubectl kustomize "$dir" > /dev/null 2>&1; then
    echo "❌ Invalid kustomize: $dir"
    kubectl kustomize "$dir"
    return 1
  else
    echo "✓ Valid kustomize: $dir"
    echo "  Resources:"
    kubectl kustomize "$dir" | grep -E "^  (name|app):" | sed 's/^/    /'
  fi
}

# Validate base manifests
validate_manifest "$K8S_DIR/deployment.yaml"
validate_manifest "$K8S_DIR/service.yaml"
validate_manifest "$K8S_DIR/ingress.yaml"

# Validate kustomize builds
validate_kustomize "$K8S_DIR" "base"
validate_kustomize "$K8S_DIR/overlays/dev" "dev"
validate_kustomize "$K8S_DIR/overlays/staging" "staging"
validate_kustomize "$K8S_DIR/overlays/prod" "prod"

echo ""
echo "✅ All manifests are valid!"
echo ""
echo "To apply to cluster:"
echo "  kubectl apply -k k8s/overlays/dev      # Development"
echo "  kubectl apply -k k8s/overlays/staging  # Staging"
echo "  kubectl apply -k k8s/overlays/prod     # Production"
