#!/usr/bin/env bash
set -euo pipefail

echo "==> Cleaning Docker resources for this project..."
# Stops containers and removes containers, networks, and anonymous volumes created by compose
docker compose down -v --remove-orphans || true

echo "==> Removing Python cache / test artifacts..."
find backend -type d -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null || true
find backend -type f -name "*.pyc" -delete 2>/dev/null || true
rm -rf backend/.pytest_cache backend/.mypy_cache backend/.coverage backend/htmlcov 2>/dev/null || true

echo "==> Removing Node/React build artifacts..."
rm -rf frontend/node_modules 2>/dev/null || true
rm -rf frontend/dist frontend/build frontend/.next 2>/dev/null || true
rm -rf frontend/.eslintcache 2>/dev/null || true

echo "==> Removing general temp artifacts..."
rm -rf .coverage htmlcov .pytest_cache 2>/dev/null || true

echo "==> Clean complete."
