#!/usr/bin/env bash
set -euo pipefail

echo "==> Building containers (no cache) ..."
docker compose build --no-cache

echo "==> Backend: check migrations generate cleanly (optional) ..."
# If you want a strict migration check, uncomment:
# docker compose run --rm backend bash -lc "python manage.py makemigrations --check --dry-run"

echo "==> Backend: apply migrations (build verification) ..."
docker compose up -d db
docker compose run --rm backend bash -lc "python manage.py migrate --noinput"

echo "==> Frontend: production build ..."
# For Vite/CRA/etc: ensure `npm run build` exists.
docker compose run --rm frontend bash -lc "npm run build"

echo "==> Build successful."
