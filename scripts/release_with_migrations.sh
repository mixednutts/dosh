#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

compose_args=(-f docker-compose.yml)
if [[ "${INCLUDE_OVERRIDE:-false}" == "true" ]]; then
  compose_args+=(-f docker-compose.override.yml)
fi

timestamp="$(date +%Y%m%d-%H%M%S)"
backup_cmd='if [ -f /app/data/dosh.db ]; then mkdir -p /app/data/backups && cp /app/data/dosh.db "/app/data/backups/dosh-'"$timestamp"'.db"; fi'
migration_cmd='if [ -f /app/data/dosh.db ] && ! python - <<'"'"'PY'"'"'
import os
import sqlite3

db_path = "/app/data/dosh.db"
conn = sqlite3.connect(db_path)
try:
    row = conn.execute("SELECT name FROM sqlite_master WHERE type = '\''table'\'' AND name = '\''alembic_version'\''").fetchone()
    print("present" if row else "missing")
finally:
    conn.close()
PY
then
  exit 1
fi'

bootstrap_or_upgrade_cmd='
if [ -f /app/data/dosh.db ]; then
  if python - <<'"'"'PY'"'"'
import sqlite3

conn = sqlite3.connect("/app/data/dosh.db")
try:
    row = conn.execute("SELECT name FROM sqlite_master WHERE type = '\''table'\'' AND name = '\''alembic_version'\''").fetchone()
    raise SystemExit(0 if row else 1)
finally:
    conn.close()
PY
  then
    alembic upgrade head
  else
    alembic stamp head
  fi
else
  alembic upgrade head
fi'

docker compose "${compose_args[@]}" build dosh
docker compose "${compose_args[@]}" run --rm dosh sh -lc "$backup_cmd && $bootstrap_or_upgrade_cmd"
docker compose "${compose_args[@]}" up -d

echo "Release updated with migrations. Run curl -sS http://127.0.0.1:3080/api/health to verify."
