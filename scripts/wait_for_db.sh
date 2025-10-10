#!/usr/bin/env bash
set -euo pipefail

HOST="${DB_HOST:-127.0.0.1}"
PORT="${DB_PORT:-5432}"
TRIES="${DB_WAIT_TRIES:-60}"

echo "→ Waiting for PostgreSQL at $HOST:$PORT ..."
for i in $(seq 1 "$TRIES"); do
  if pg_isready -h "$HOST" -p "$PORT" >/dev/null 2>&1; then
    echo "✓ PostgreSQL is ready"
    exec "$@"
  fi
  sleep 1
done

echo "✗ Gave up waiting for PostgreSQL after ${TRIES}s" >&2
exit 1
