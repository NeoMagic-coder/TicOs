#!/bin/bash
set -e

REGISTRY="${REGISTRY:-ghcr.io/yourorg/oneproduct}"
VERSION="${VERSION:-latest}"
echo "Building OneProduct images..."
echo "Registry: $REGISTRY"
echo "Version: $VERSION"

docker build -f docker/backend.Dockerfile -t "$REGISTRY/api:$VERSION" ./backend
echo "✓ API image built: $REGISTRY/api:$VERSION"

docker build -f docker/frontend.Dockerfile -t "$REGISTRY/web:$VERSION" ./frontend
echo "✓ Web image built: $REGISTRY/web:$VERSION"

if [ "$1" = "--push" ]; then
    echo "Pushing images to registry..."
    docker push "$REGISTRY/api:$VERSION"
    docker push "$REGISTRY/web:$VERSION"
    echo "✓ Images pushed successfully"
fi

echo "Done!"
