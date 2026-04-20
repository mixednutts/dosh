#!/bin/bash
# Database migration helper that ensures migrations are persisted to host

set -e

echo "Generating migration inside container..."
docker compose exec dosh alembic revision -m "$1" --autogenerate

echo "Copying migration to host..."
LATEST_MIGRATION=$(docker compose exec dosh sh -c "ls -t /app/alembic/versions/*.py | head -1")
FILENAME=$(basename "$LATEST_MIGRATION")
docker compose cp "dosh:$LATEST_MIGRATION" "./backend/alembic/versions/$FILENAME"

echo "Running migration..."
docker compose exec dosh alembic upgrade head

echo "✅ Migration complete: $FILENAME"
