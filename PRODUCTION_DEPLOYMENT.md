# Production Deployment Guide — OneProduct Agent OS

## Quick Start

### 1. Registry Setup

Choose a Docker registry (Docker Hub, GitHub Container Registry, or private registry):

```bash
# GitHub Container Registry (ghcr.io)
docker login ghcr.io -u <username> -p <token>

# Docker Hub
docker login

# Private Registry
docker login <registry-url>
```

### 2. Build & Push Images

```bash
# Set environment variables
export REGISTRY=ghcr.io/yourorg/oneproduct
export VERSION=v1.0.0

# Build and push both images
bash scripts/build.sh --push

# Or manually
docker build -f Dockerfile.api -t $REGISTRY/api:$VERSION .
docker push $REGISTRY/api:$VERSION

docker build -f Dockerfile.web -t $REGISTRY/web:$VERSION .
docker push $REGISTRY/web:$VERSION
```

### 3. Deploy to Production

#### Option A: Kubernetes (Recommended for Multi-Node)

```bash
# Configure kubeconfig
export KUBECONFIG=$HOME/.kube/config

# Set environment
export REGISTRY=ghcr.io/yourorg/oneproduct
export IMAGE_TAG=v1.0.0
export NAMESPACE=oneproduct

# Deploy
bash scripts/deploy-k8s.sh
```

Kubernetes deployment includes:
- **3 API replicas** with auto-scaling (3-10)
- **2 Web replicas** with auto-scaling (2-5)
- Health checks & liveness probes
- Pod Disruption Budgets
- Network policies
- Resource limits
- Horizontal Pod Autoscaler

#### Option B: Docker Compose (Single-Host)

```bash
# Prepare environment file
cp .env.prod.example .env.prod
# Edit .env.prod with actual values

# Deploy
bash scripts/deploy-compose.sh
```

Docker Compose deployment includes:
- Nginx reverse proxy
- API service
- Web service
- Persistent volumes
- Health checks
- JSON logging

### 4. GitHub Actions CI/CD

Push to GitHub and configure secrets:

```bash
# In GitHub repository settings, add secrets:
- KUBE_CONFIG_STAGING: base64-encoded kubeconfig
- KUBE_CONFIG_PRODUCTION: base64-encoded kubeconfig
- REGISTRY_USERNAME: registry username
- REGISTRY_PASSWORD: registry token/password
```

Workflow triggers:
- **Push to `develop`** → Build & deploy to staging
- **Push tag `v*`** → Build & deploy to production
- **Pull requests** → Run tests & scan security

## Configuration

### Environment Variables

**Backend (FastAPI):**
- `GEMINI_API_KEY` — Gemini API key (required)
- `GEMINI_MODEL` — Model name (default: gemini-2.5-flash-lite)
- `LOG_LEVEL` — Logging level (default: info)

**Frontend (React):**
- `VITE_API_BASE_URL` — Backend API URL
- `VITE_GEMINI_API_KEY` — Gemini API key (optional, uses backend if not set)
- `VITE_GEMINI_MODEL` — Model name
- `NODE_ENV` — Environment (production/development)

**Registry & Deployment:**
- `REGISTRY` — Docker registry URL
- `IMAGE_TAG` — Image version tag
- `NAMESPACE` — Kubernetes namespace
- `DOMAIN` — Domain name for ingress

### Secrets Management

**Local Development:**
```bash
cp .env.example .env.local
# Edit with actual API keys
```

**Production (Kubernetes):**
```bash
kubectl create secret generic oneproduct-secrets \
  --from-literal=GEMINI_API_KEY=<key> \
  --from-literal=VITE_GEMINI_API_KEY=<key> \
  -n oneproduct
```

**Production (Docker Compose):**
```bash
cp .env.prod.example .env.prod
# Edit with actual secrets
```

## Monitoring & Troubleshooting

### Kubernetes

```bash
# Check deployments
kubectl get deployments -n oneproduct
kubectl describe deployment oneproduct-api -n oneproduct

# View logs
kubectl logs -f deployment/oneproduct-api -n oneproduct
kubectl logs -f deployment/oneproduct-web -n oneproduct

# Check pod health
kubectl get pods -n oneproduct
kubectl describe pod <pod-name> -n oneproduct

# Check resource usage
kubectl top pods -n oneproduct
kubectl top nodes

# Port forward to access services
kubectl port-forward svc/api 8000:8000 -n oneproduct
kubectl port-forward svc/web 5173:5173 -n oneproduct
```

### Docker Compose

```bash
# Check services
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f api
docker-compose -f docker-compose.prod.yml logs -f web

# Access services
curl http://localhost:8000/health
curl http://localhost/
```

## Scaling

### Kubernetes Auto-Scaling

Auto-scaling is configured via HorizontalPodAutoscaler:

```bash
# Check HPA status
kubectl get hpa -n oneproduct

# Manual scaling
kubectl scale deployment/oneproduct-api --replicas=5 -n oneproduct
```

### Manual Scaling

```bash
# Update deployment replicas
kubectl patch deployment oneproduct-api -p '{"spec":{"replicas":5}}' -n oneproduct
```

## Backup & Disaster Recovery

### Kubernetes

```bash
# Backup manifests
kubectl get all -n oneproduct -o yaml > oneproduct-backup.yaml

# Restore from backup
kubectl apply -f oneproduct-backup.yaml
```

### Persistent Data

```bash
# Check volumes
kubectl get pvc -n oneproduct

# Backup volume data
kubectl exec -it pod/<name> -c api -- tar czf /tmp/backup.tar.gz /app/apps/api/_images
kubectl cp oneproduct/<pod>:/tmp/backup.tar.gz ./backup.tar.gz
```

## Security Best Practices

- Run containers as non-root (UID 1000, 1001)
- Use read-only root filesystems
- Enable network policies
- Use Pod Security Policies
- Scan images for vulnerabilities (Trivy via GitHub Actions)
- Use private registries for sensitive images
- Rotate API keys regularly
- Enable HTTPS with cert-manager

## Production Checklist

- [ ] Registry configured and authenticated
- [ ] Environment variables set (.env.prod)
- [ ] Secrets securely stored (Kubernetes Secrets or HashiCorp Vault)
- [ ] Health checks verified
- [ ] Monitoring & logging configured
- [ ] Backups tested
- [ ] Security scan passed
- [ ] Load testing completed
- [ ] Incident runbooks prepared
- [ ] SSL/TLS certificates configured
