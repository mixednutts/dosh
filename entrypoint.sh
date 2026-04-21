#!/bin/sh
set -e

# Run Alembic migrations before starting the app
# This ensures fresh databases are initialized and existing ones are up to date
cd /app
alembic upgrade head

# Start the application
exec uvicorn app.main:app --host 0.0.0.0 --port 3080
