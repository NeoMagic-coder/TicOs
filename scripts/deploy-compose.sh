#!/bin/bash
set -e

REGISTRY="${REGISTRY:-ghcr.io/yourorg/oneproduct}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "Deploying with Docker Compose (production)..."

if [ ! -f "env/.env.prod" ]; then
    echo "Error: env/.env.prod not found"
    echo "Copy env/.env.example to env/.env.prod and configure it:"
    exit 1
fi

export REGISTRY
export IMAGE_TAG

docker-compose -f docker/compose.prod.yml up -d

echo "Checking service health..."
sleep 5

if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ API is healthy"
else
    echo "✗ API health check failed"
    docker-compose -f docker/compose.prod.yml logs api
    exit 1
fi

if curl -f http://localhost/api/v1/agents > /dev/null 2>&1; then
    echo "✓ Web frontend is accessible"
else
    echo "✗ Web frontend health check failed"
    docker-compose -f docker/compose.prod.yml logs web
    exit 1
fi

echo "✓ Deployment complete!"
echo "API: http://localhost:8000"
echo "Web: http://localhost"
