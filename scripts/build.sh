#!/bin/bash
set -e

REGISTRY="${REGISTRY:-ghcr.io/yourorg/oneproduct}"
VERSION="${VERSION:-latest}"
DOCKERFILE_API="${DOCKERFILE_API:-Dockerfile.api}"
DOCKERFILE_WEB="${DOCKERFILE_WEB:-Dockerfile.web}"

echo "Building OneProduct images..."
echo "Registry: $REGISTRY"
echo "Version: $VERSION"

docker build -f "$DOCKERFILE_API" -t "$REGISTRY/api:$VERSION" .
echo "✓ API image built: $REGISTRY/api:$VERSION"

docker build -f "$DOCKERFILE_WEB" -t "$REGISTRY/web:$VERSION" .
echo "✓ Web image built: $REGISTRY/web:$VERSION"

if [ "$1" = "--push" ]; then
    echo "Pushing images to registry..."
    docker push "$REGISTRY/api:$VERSION"
    docker push "$REGISTRY/web:$VERSION"
    echo "✓ Images pushed successfully"
fi

echo "Done!"
