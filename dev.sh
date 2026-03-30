#!/usr/bin/env bash
set -euo pipefail

SEED_DATA=false

for arg in "$@"; do
	case "$arg" in
		--data)
			SEED_DATA=true
			;;
		*)
			echo "Unknown option: $arg"
			echo "Usage: ./dev.sh [--data]"
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

echo "==> Starting dev environment with hot reload..."

docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v --remove-orphans
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

if [ "$SEED_DATA" = true ]; then
	echo "waiting for containers before seeding data..."
	sleep 10
 

	echo "seeding database with sample data..."
	docker compose -f docker-compose.yml -f docker-compose.dev.yml exec backend python manage.py seed_data
fi

echo "attaching to logs....."
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f