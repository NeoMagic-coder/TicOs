#!/bin/bash

cat << 'EOF'

╔══════════════════════════════════════════════════════════════╗
║           OneProduct Kubernetes Deployment Setup             ║
╚══════════════════════════════════════════════════════════════╝

📦 Files Created:
   
   Base Manifests:
   • k8s/deployment.yaml       - API & Web Deployments
   • k8s/service.yaml          - Services, HPA, PDB, NetworkPolicy
   • k8s/ingress.yaml          - Ingress with TLS
   • k8s/kustomization.yaml    - Base kustomize config
   
   Deployment Scripts:
   • k8s/deploy.sh             - Full production deployment
   • k8s/dev-setup.sh          - Local development setup
   • k8s/validate.sh           - Manifest validation
   
   Environment Overlays:
   • k8s/overlays/dev/         - Development (1 replica)
   • k8s/overlays/staging/     - Staging (2 replicas)
   • k8s/overlays/prod/        - Production (3 replicas)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Quick Start:

   1. LOCAL DEVELOPMENT (with Docker Desktop or minikube):
   
      chmod +x k8s/dev-setup.sh
      k8s/dev-setup.sh
      
      Then port-forward (in another terminal):
      kubectl port-forward -n oneproduct svc/api 8000:8000 &
      kubectl port-forward -n oneproduct svc/web 5173:5173 &
      
      Access:
      - Frontend: http://localhost:5173
      - API: http://localhost:8000

   2. PRODUCTION DEPLOYMENT:
   
      # Configure your registry and secrets
      export REGISTRY=ghcr.io/yourorg/oneproduct
      export IMAGE_TAG=v1.0.0
      
      cp k8s/overlays/prod/.env.secret.example k8s/overlays/prod/.env.secret
      # Edit k8s/overlays/prod/.env.secret with your API keys
      
      # Build and deploy
      chmod +x k8s/deploy.sh
      k8s/deploy.sh deploy
      
      # Or step-by-step:
      k8s/deploy.sh build
      k8s/deploy.sh push
      k8s/deploy.sh deploy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Key Features:

   ✓ Multi-replica deployments with rolling updates
   ✓ Horizontal Pod Autoscaling (HPA)
   ✓ Pod Disruption Budgets for availability
   ✓ NetworkPolicy for security
   ✓ NGINX Ingress with TLS/Let's Encrypt
   ✓ Non-root users, read-only filesystems
   ✓ Health checks (liveness & readiness probes)
   ✓ Resource requests/limits
   ✓ Pod anti-affinity for spread across nodes
   ✓ Environment-specific overlays (dev/staging/prod)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 Common Commands:

   # Validate manifests
   k8s/validate.sh
   
   # View deployment status
   kubectl get pods -n oneproduct
   kubectl get svc -n oneproduct
   kubectl describe pod <pod-name> -n oneproduct
   
   # View logs
   kubectl logs -n oneproduct -l app=oneproduct-api -f
   kubectl logs -n oneproduct -l app=oneproduct-web -f
   
   # Port forward
   kubectl port-forward -n oneproduct svc/api 8000:8000
   kubectl port-forward -n oneproduct svc/web 5173:5173
   
   # Exec into pod
   kubectl exec -it <pod-name> -n oneproduct -- /bin/sh
   
   # Rollback deployment
   kubectl rollout undo deployment/oneproduct-api -n oneproduct
   
   # Scale deployment
   kubectl scale deployment oneproduct-api --replicas=5 -n oneproduct

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📚 Full Documentation:

   See k8s/README.md for complete deployment guide

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF
