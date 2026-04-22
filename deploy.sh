#!/bin/bash
set -e

echo "=== Logistics System Deploy ==="

# Pull latest code
git pull origin main

# Run DB migrations
echo "--- Running migrations..."
docker compose exec backend alembic upgrade head 2>/dev/null || \
  docker compose run --rm backend alembic upgrade head

# Rebuild and restart all services
echo "--- Building and restarting services..."
docker compose up -d --build

echo "=== Done. Services running at http://$(hostname -I | awk '{print $1}'):5173 ==="
docker compose ps
