#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting dev environment with hot reload..."

docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build