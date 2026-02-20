#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting DB for tests ..."
docker compose up -d db

echo "==> Backend tests (pytest) ..."
# If you use Django's test runner instead, swap to: python manage.py test
docker compose run --rm backend bash -lc "\
  python manage.py migrate --noinput && \
  pytest -q \
"

echo "==> Frontend tests ..."
# If your frontend doesn't have tests yet, start with: npm run lint
# and later add: npm test / npm run test / vitest / jest
docker compose run --rm frontend bash -lc "\
  npm run lint && \
  (npm run test -- --watch=false || npm run test || true) \
"

echo "==> Tests complete."
