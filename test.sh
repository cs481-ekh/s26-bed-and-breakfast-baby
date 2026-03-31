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
if [[ "${1:-}" == "--errors-only" ]]; then
  "${compose_cmd[@]}" run --build --rm backend bash -lc "\
    python manage.py migrate --noinput && \
    pytest -q 2>&1 \
  " | grep -E "(FAILED|ERROR|Error|assert|AssertionError)" || true
else
  "${compose_cmd[@]}" run --build --rm backend bash -lc "\
    python manage.py migrate --noinput && \
    pytest -q \
  "
fi

echo "==> Frontend tests ..."
if [[ "${1:-}" == "--errors-only" ]]; then
  "${compose_cmd[@]}" run --build --rm frontend bash -lc "\
    npm run lint && \
    npm test -- --reporter=verbose 2>&1 \
  " | grep -E "(FAIL |FAILED|×| × | ✗|Error:|TestingLibraryElementError|AssertionError)" || true
else
  "${compose_cmd[@]}" run --build --rm frontend bash -lc "\
    npm run lint && \
    npm test \
  "
fi

echo "==> Tests complete."
