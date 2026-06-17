# Kubernetes Deployment Guide for OneProduct

## Overview

This directory contains Kubernetes manifests for deploying the OneProduct Agent OS platform. The setup includes:

- Multi-replica Deployments for API (3) and Web (2) with rolling updates
- ClusterIP Services with network policies
- NGINX Ingress with TLS/Let's Encrypt
- Horizontal Pod Autoscaling (HPA)
- Pod Disruption Budgets (PDB) for high availability
- Security context with non-root users and read-only filesystems
- Resource requests/limits and health checks
- Pod anti-affinity for spread across nodes

## Directory Structure

```
k8s/
├── deployment.yaml       # API + Web deployments, ServiceAccounts
├── service.yaml          # Services, NetworkPolicy, HPA, PDB
├── ingress.yaml          # Ingress with cert-manager
├── kustomization.yaml    # Base kustomize config
├── deploy.sh             # Production deployment script
├── dev-setup.sh          # Local development setup
└── overlays/
    ├── dev/              # Development environment (1 replica each)
    ├── staging/          # Staging environment (2 replicas)
    └── prod/             # Production environment (3 replicas)
```

## Prerequisites

- Kubernetes cluster (v1.24+)
- `kubectl` configured to access your cluster
- `kustomize` or built-in kubectl kustomize support
- Docker (for building images)
- nginx-ingress-controller installed in cluster
- cert-manager installed for TLS (optional but recommended)

### Install nginx-ingress (if not already installed):

```bash
# Using Helm
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install nginx-ingress ingress-nginx/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Or using kubectl
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.1/deploy/static/provider/cloud/deploy.yaml
```

### Install cert-manager (optional, for automatic TLS):

```bash
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml
```

## Quick Start: Local Development

For local development with Docker Desktop or minikube:

```bash
./k8s/dev-setup.sh
```

This will:
1. Build Docker images locally
2. Create the `oneproduct` namespace
3. Apply secrets
4. Deploy using kustomize
5. Print port-forward commands for testing

Then in another terminal:
```bash
kubectl port-forward -n oneproduct svc/api 8000:8000 &
kubectl port-forward -n oneproduct svc/web 5173:5173 &
```

Access at:
- Frontend: http://localhost:5173
- API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Production Deployment

### 1. Configure your environment

Update image registry and secrets:

```bash
# Update k8s/overlays/prod/kustomization.yaml with your registry
export REGISTRY=ghcr.io/yourorg/oneproduct
export IMAGE_TAG=v1.0.0

# Create secrets file
cp k8s/overlays/prod/.env.secret.example k8s/overlays/prod/.env.secret
# Edit with your actual API keys:
# vim k8s/overlays/prod/.env.secret
```

### 2. Build and push images

```bash
cd k8s
./deploy.sh build-push
```

Or manually:
```bash
docker build -f docker/backend.Dockerfile -t $REGISTRY/api:$IMAGE_TAG .
docker build -f docker/frontend.Dockerfile -t $REGISTRY/web:$IMAGE_TAG .
docker push $REGISTRY/api:$IMAGE_TAG
docker push $REGISTRY/web:$IMAGE_TAG
```

### 3. Deploy to production

```bash
cd k8s
./deploy.sh deploy
```

Or manually with kustomize:
```bash
kubectl kustomize k8s/overlays/prod | kubectl apply -f -
```

### 4. Verify deployment

```bash
# Check pod status
kubectl get pods -n oneproduct

# Check services
kubectl get svc -n oneproduct

# Check ingress
kubectl get ingress -n oneproduct

# View logs
kubectl logs -n oneproduct -l app=oneproduct-api -f
kubectl logs -n oneproduct -l app=oneproduct-web -f

# Check deployment status
kubectl rollout status deployment/oneproduct-api -n oneproduct
kubectl rollout status deployment/oneproduct-web -n oneproduct
```

## Environment-Specific Deployment

### Development (1 replica each, lower resources)

```bash
kubectl kustomize k8s/overlays/dev | kubectl apply -f -
```

### Staging (2 replicas, moderate resources)

```bash
kubectl kustomize k8s/overlays/staging | kubectl apply -f -
```

### Production (3 replicas, full resources)

```bash
kubectl kustomize k8s/overlays/prod | kubectl apply -f -
```

## Updating Deployments

### Rolling update with new image tag

```bash
kubectl set image deployment/oneproduct-api \
  api=ghcr.io/yourorg/oneproduct/api:v1.1.0 \
  -n oneproduct

kubectl set image deployment/oneproduct-web \
  web=ghcr.io/yourorg/oneproduct/web:v1.1.0 \
  -n oneproduct

# Monitor rollout
kubectl rollout status deployment/oneproduct-api -n oneproduct
```

### Rollback deployment

```bash
kubectl rollout undo deployment/oneproduct-api -n oneproduct
kubectl rollout undo deployment/oneproduct-web -n oneproduct
```

## Scaling

### Manual scaling

```bash
kubectl scale deployment oneproduct-api --replicas=5 -n oneproduct
```

### HPA is already configured:
- API: min 3, max 10 replicas (70% CPU, 80% memory threshold)
- Web: min 2, max 5 replicas (75% CPU)

View HPA status:
```bash
kubectl get hpa -n oneproduct
kubectl describe hpa oneproduct-api-hpa -n oneproduct
```

## Networking & Ingress

### Local testing without ingress:

```bash
kubectl port-forward svc/api 8000:8000 -n oneproduct
kubectl port-forward svc/web 5173:5173 -n oneproduct
```

### With ingress (update hosts in ingress.yaml first):

Edit `k8s/ingress.yaml` and replace `oneproduct.example.com` with your actual domain:

```yaml
spec:
  rules:
  - host: oneproduct.yourdomain.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: web
            port:
              number: 5173
  - host: api.oneproduct.yourdomain.com
    http:
      paths:
      - path: /
        backend:
          service:
            name: api
            port:
              number: 8000
```

Then deploy with TLS:

```bash
# Update cert-manager issuer if needed
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: your-email@example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

kubectl apply -f k8s/ingress.yaml
```

## Monitoring & Troubleshooting

### View pod logs

```bash
# API logs
kubectl logs deployment/oneproduct-api -n oneproduct --tail=100 -f

# Web logs
kubectl logs deployment/oneproduct-web -n oneproduct --tail=100 -f

# Previous container logs (if crashed)
kubectl logs deployment/oneproduct-api -n oneproduct --previous
```

### Exec into pod

```bash
kubectl exec -it deployment/oneproduct-api -n oneproduct -- /bin/sh
```

### Describe pod for events

```bash
kubectl describe pod <pod-name> -n oneproduct
```

### Check resource usage

```bash
kubectl top pods -n oneproduct
kubectl top nodes
```

### Check pod disruption budget

```bash
kubectl get pdb -n oneproduct
kubectl describe pdb oneproduct-api-pdb -n oneproduct
```

## Configuration Management

### Environment-specific configuration:

All configs are in the respective `overlays/*/kustomization.yaml`:

- **Dev**: `localhost:5000/oneproduct`, 1 replica, debug logging
- **Staging**: `ghcr.io/yourorg/oneproduct:staging`, 2 replicas, info logging
- **Prod**: `ghcr.io/yourorg/oneproduct:latest`, 3 replicas, warn logging

### Adding new environment variables:

1. Update the `configMapGenerator` section in `kustomization.yaml`
2. Or create a new `ConfigMap` resource file
3. Reference in deployment: `env:` or `envFrom:`

## Security Considerations

- **Non-root users**: API runs as UID 1000, Web as UID 1001
- **Read-only filesystem**: Except for `/tmp` and `/app/apps/api/_images` (API only)
- **No privilege escalation**: `allowPrivilegeEscalation: false`
- **Dropped capabilities**: All Linux capabilities dropped
- **Network policies**: Ingress from ingress-nginx only, egress to DNS + internal services
- **Resource limits**: Memory and CPU limits prevent resource exhaustion

## Cleanup

### Delete deployment

```bash
kubectl delete namespace oneproduct
```

Or specifically:
```bash
kubectl delete -f k8s/
```

### Cleanup images

```bash
docker image rm $REGISTRY/api:$IMAGE_TAG
docker image rm $REGISTRY/web:$IMAGE_TAG
```

## References

- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kustomize](https://kustomize.io/)
- [Ingress](https://kubernetes.io/docs/concepts/services-networking/ingress/)
- [Horizontal Pod Autoscaler](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [Pod Disruption Budgets](https://kubernetes.io/docs/tasks/run-application/configure-pdb/)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
