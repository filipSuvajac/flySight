#!/usr/bin/env bash

set -euo pipefail

APP_DIR="/home/flysight/flySight"
COMPOSE_FILE="docker-compose.prod.yml"

echo "Starting FlySight backend deployment..."
cd "$APP_DIR"

echo "Pulling latest backend image..."
docker compose -f "$COMPOSE_FILE" pull backend

echo "Stopping current backend container..."
docker compose -f "$COMPOSE_FILE" stop backend || true

echo "Removing old backend container..."
docker compose -f "$COMPOSE_FILE" rm -f backend || true

echo "Starting new backend container..."
docker compose -f "$COMPOSE_FILE" up -d --no-deps backend

echo "Cleaning unused Docker images..."
docker image prune -f

echo "Checking backend health through proxy..."
sleep 5
curl -fsS http://localhost/health || true

echo "Deployment finished."
