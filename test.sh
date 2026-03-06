#!/usr/bin/env bash
set -eu
set -o pipefail 2>/dev/null || true

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker command not found in this shell."
  echo "Use PowerShell/CMD with Docker Desktop, or run this script from a shell where docker is on PATH."
  exit 1
fi

compose_cmd=(docker compose)
if ! docker compose version >/dev/null 2>&1; then
  if command -v docker-compose >/dev/null 2>&1; then
    compose_cmd=(docker-compose)
  else
    echo "Error: neither 'docker compose' nor 'docker-compose' is available."
    exit 1
  fi
fi

echo "==> Starting DB for tests ..."
"${compose_cmd[@]}" up -d db

echo "==> Backend tests (pytest) ..."
"${compose_cmd[@]}" run --rm backend bash -lc "\
  python manage.py migrate --noinput && \
  pytest -q \
"

echo "==> Frontend tests ..."
<<<<<<< HEAD
"${compose_cmd[@]}" run --rm frontend bash -lc "\
=======
# If your frontend doesn't have tests yet, start with: npm run lint
# and later add: npm test / npm run test / vitest / jest

#docker compose run --rm frontend bash -lc "\
#  npm run lint && \
#  (npm run test -- --watch=false || npm run test || true) \
#"

docker compose run --rm frontend bash -lc "\
>>>>>>> f0f32d66962b75194dabb20063062788644f3bdd
  npm run lint && \
  npm test \
"

echo "==> Tests complete."
