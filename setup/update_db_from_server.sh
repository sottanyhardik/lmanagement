#!/usr/bin/env bash
set -Eeuo pipefail

# ─── Configuration ─────────────────────────────────────────────────────────────
REMOTE_USER="django"
<<<<<<< HEAD
REMOTE_HOST="143.110.186.184"
=======
REMOTE_HOST="143.244.139.121"
>>>>>>> origin/master
REMOTE_DB_NAME="lmanagement"
REMOTE_DB_USER="lmanagement"
REMOTE_DB_PASSWORD="lmanagement"
REMOTE_BACKUP_PATH="/home/django/lmanagement.backup"

LOCAL_DB_NAME="lmanagement"
LOCAL_DB_USER="lmanagement"            # local role you want to own the DB
LOCAL_DB_PASSWORD="lmanagement"        # set/update this password locally
LOCAL_PORT="5432"
LOCAL_HOST="localhost"

# Optional: prefer a newer pg_restore (fixes “unsupported version (1.15)”)
PG_RESTORE_BIN_DEFAULT="$(command -v pg_restore || true)"
PG_RESTORE_BIN_CANDIDATE="/opt/homebrew/opt/postgresql@15/bin/pg_restore"  # adjust if Linux or Intel mac
if [[ -x "$PG_RESTORE_BIN_CANDIDATE" ]]; then
  PG_RESTORE_BIN="$PG_RESTORE_BIN_CANDIDATE"
else
  PG_RESTORE_BIN="${PG_RESTORE_BIN_DEFAULT}"
fi
if [[ -z "${PG_RESTORE_BIN}" ]]; then
  echo "❌ No pg_restore found. Install postgresql client tools (e.g. 'brew install postgresql@15')."
  exit 1
fi

BACKUP_FILE="lmanagement.backup"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOGFILE="db_update_$TIMESTAMP.log"

# ─── Helpers ──────────────────────────────────────────────────────────────────
require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "❌ Missing command: $1"; exit 1; }; }
log() { echo -e "$*" | tee -a "$LOGFILE"; }

require_cmd ssh
require_cmd scp
require_cmd psql
require_cmd createdb
require_cmd dropdb

cleanup() {
  rm -f "$BACKUP_FILE" 2>/dev/null || true
}
trap cleanup EXIT

# ─── Step 0: Show tool versions (useful for debugging) ────────────────────────
log "🧰 Using pg_restore: $PG_RESTORE_BIN ($("$PG_RESTORE_BIN" --version))"
log "🧰 psql version: $(psql --version)"
log "🧰 pg_dump (remote) will run on the server via ssh"

# ─── Step 1: Trigger pg_dump on remote ────────────────────────────────────────
log "🔄 Starting remote dump..."
ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new "${REMOTE_USER}@${REMOTE_HOST}" \
  "PGPASSWORD='${REMOTE_DB_PASSWORD}' pg_dump \
      -U '${REMOTE_DB_USER}' -h localhost -p '${LOCAL_PORT}' \
      -F c -b -v -f '${REMOTE_BACKUP_PATH}' '${REMOTE_DB_NAME}'" \
  2>&1 | tee -a "$LOGFILE"

# ─── Step 2: Copy backup file to local ────────────────────────────────────────
log "📥 Copying backup to local..."
scp -q "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_BACKUP_PATH}" "./${BACKUP_FILE}" \
  2>&1 | tee -a "$LOGFILE"

# ─── Step 3: Ensure local role exists & set password ──────────────────────────
log "👤 Ensuring local role '${LOCAL_DB_USER}' exists..."
ROLE_EXISTS=$(psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "${USER}" -d postgres -At \
  -c "SELECT 1 FROM pg_roles WHERE rolname='${LOCAL_DB_USER}'" || true)

if [[ "$ROLE_EXISTS" != "1" ]]; then
  log "➕ Creating role '${LOCAL_DB_USER}'..."
  # Create a login role (not superuser) with createdb so restore can create objects if needed
  psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "${USER}" -d postgres -v ON_ERROR_STOP=1 -c \
    "CREATE ROLE ${LOCAL_DB_USER} LOGIN PASSWORD '${LOCAL_DB_PASSWORD}' CREATEDB;"
else
  log "🔑 Role exists; updating password for '${LOCAL_DB_USER}'..."
  psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "${USER}" -d postgres -v ON_ERROR_STOP=1 -c \
    "ALTER ROLE ${LOCAL_DB_USER} WITH PASSWORD '${LOCAL_DB_PASSWORD}';"
fi

# ─── Step 4: Drop connections, drop & recreate DB ─────────────────────────────
log "💣 Dropping and recreating local database '${LOCAL_DB_NAME}'..."
# Terminate active connections to the database if it exists
psql -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "${USER}" -d postgres -v ON_ERROR_STOP=1 -c \
  "SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE datname='${LOCAL_DB_NAME}' AND pid <> pg_backend_pid();" || true

dropdb  -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "${USER}" --if-exists "${LOCAL_DB_NAME}" 2>&1 | tee -a "$LOGFILE"
createdb -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "${USER}" -O "${LOCAL_DB_USER}" "${LOCAL_DB_NAME}" 2>&1 | tee -a "$LOGFILE"

# ─── Step 5: Restore backup (remap ownership to LOCAL_DB_USER) ────────────────
log "♻️ Restoring database locally (owner → ${LOCAL_DB_USER})..."
PGPASSWORD="${LOCAL_DB_PASSWORD}" \
"${PG_RESTORE_BIN}" \
  -h "$LOCAL_HOST" -p "$LOCAL_PORT" -U "${LOCAL_DB_USER}" \
  -d "${LOCAL_DB_NAME}" \
  --no-owner \
  --role="${LOCAL_DB_USER}" \
  --verbose \
  "${BACKUP_FILE}" 2>&1 | tee -a "$LOGFILE"

# ─── Step 6: Cleanup ──────────────────────────────────────────────────────────
log "🗑 Deleting backup file..."
rm -f "${BACKUP_FILE}"

log "✅ Database update complete. Log saved to $LOGFILE"
