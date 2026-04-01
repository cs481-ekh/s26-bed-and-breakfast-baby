#!/usr/bin/env bash
set -euo pipefail

SEED_DATA=false
SEED_SIZE="small"

for arg in "$@"; do
	case "$arg" in
		--data)
			SEED_DATA=true
			;;
		--data-large)
			SEED_DATA=true
			SEED_SIZE="large"
			;;
		*)
			echo "Unknown option: $arg"
			echo "Usage: ./dev.sh [--data] [--data-large]"
			exit 1
			;;
	esac
done

if ! command -v docker >/dev/null 2>&1; then
	echo "Error: Docker CLI ('docker') is not installed or not on PATH."
	echo "Install Docker Desktop/Engine and re-run this script from a host shell with Docker access."
	exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
	echo "Error: Docker Compose plugin is not available ('docker compose')."
	echo "Install/enable Docker Compose V2 and try again."
	exit 1
fi

wait_for_backend_ready() {
	echo "waiting for backend API health endpoint..."
	for i in $(seq 1 60); do
		if command -v curl >/dev/null 2>&1; then
			if curl -fsS "http://localhost:8000/api/health/" >/dev/null 2>&1; then
				echo "backend is ready"
				return 0
			fi
		else
			if docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=1)" >/dev/null 2>&1; then
				echo "backend is ready"
				return 0
			fi
		fi
		sleep 1
	done

	echo "Error: backend did not become ready in time"
	echo "Last backend logs:"
	docker compose -f docker-compose.yml -f docker-compose.dev.yml logs --no-color backend | tail -n 120 || true
	return 1
}

echo "==> Starting dev environment with hot reload..."

docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d db backend

wait_for_backend_ready

if [ "$SEED_DATA" = true ]; then
	echo "seeding database with sample data (size=$SEED_SIZE)..."
	SEED_ARGS=""
	if [ "$SEED_SIZE" = "large" ]; then
		SEED_ARGS="--size large"
	fi
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec -T backend python manage.py seed_data $SEED_ARGS
fi

docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d frontend

echo "attaching to logs....."
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f