#!/usr/bin/env bash
set -euo pipefail

# ===== Paths (Apple Silicon-safe) =====
BREW_PREFIX="$(brew --prefix)"
PLIST="$HOME/Library/LaunchAgents/homebrew.mxcl.postgresql@16.plist"
DATA_DIR="$BREW_PREFIX/var/postgresql@16"
LOG_DIR="$HOME/Library/Logs/homebrew/postgresql@16"
BIN_DIR="$BREW_PREFIX/opt/postgresql@16/bin"
PG_BIN="$BIN_DIR/postgres"
PG_CTL="$BIN_DIR/pg_ctl"
PG_ISREADY="$BIN_DIR/pg_isready"
PG_PORT="${PG_PORT:-5432}"

info(){ printf "\033[1;34m→ %s\033[0m\n" "$*"; }
ok(){   printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
warn(){ printf "\033[1;33m! %s\033[0m\n" "$*"; }
die(){  printf "\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }

export PATH="$BIN_DIR:$PATH"

info "Ensuring Homebrew + postgresql@16 are installed…"
command -v brew >/dev/null || die "Homebrew not found. Install from https://brew.sh"
brew list postgresql@16 >/dev/null 2>&1 || brew install postgresql@16

info "Stopping any existing service and removing stale LaunchAgent…"
brew services stop postgresql@16 || true
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
rm -f "$PLIST"

info "Preparing directories & permissions…"
mkdir -p "$DATA_DIR" "$LOG_DIR" "$HOME/Library/LaunchAgents"
chmod 700 "$DATA_DIR"
chown -R "$USER":staff "$DATA_DIR" "$LOG_DIR" "$HOME/Library/LaunchAgents"

if [ -z "$(ls -A "$DATA_DIR" 2>/dev/null || true)" ]; then
  info "Initializing new cluster at $DATA_DIR …"
  initdb -D "$DATA_DIR"
  ok "Cluster initialized."
else
  ok "Cluster already present."
fi

info "Clearing stale pid/socket & selecting port…"
rm -f "$DATA_DIR/postmaster.pid" 2>/dev/null || true
find /tmp -maxdepth 1 -name ".s.PGSQL.*" -delete 2>/dev/null || true
if lsof -i :"$PG_PORT" >/dev/null 2>&1; then
  warn "Port $PG_PORT busy. Switching to 5433."
  PG_PORT=5433
fi
if ! grep -qE '^port\s*=' "$DATA_DIR/postgresql.conf" 2>/dev/null; then
  echo "port = $PG_PORT" >> "$DATA_DIR/postgresql.conf"
else
  sed -i '' -E "s|^#?\s*port\s*=.*$|port = $PG_PORT|" "$DATA_DIR/postgresql.conf"
fi
ok "Configured port = $PG_PORT"

info "Manual start via pg_ctl (to capture real logs)…"
$PG_CTL -D "$DATA_DIR" -l "$LOG_DIR/server.log" start
sleep 1
if ! $PG_ISREADY -h 127.0.0.1 -p "$PG_PORT" >/dev/null 2>&1; then
  tail -n 200 "$LOG_DIR/server.log" || true
  die "Manual start failed. Fix errors above and rerun."
fi
ok "Postgres started. Stopping again…"
$PG_CTL -D "$DATA_DIR" stop -m fast

info "Cleaning brew services and starting LaunchAgent…"
brew services cleanup
brew services start postgresql@16 || true

sleep 1
if ! $PG_ISREADY -h 127.0.0.1 -p "$PG_PORT" >/dev/null 2>&1; then
  warn "Service started but not healthy. Diagnostics:"
  [ -f "$PLIST" ] && plutil -lint "$PLIST" || echo "No plist created."
  launchctl print "gui/$(id -u)" 2>/dev/null | sed -n '1,120p' || true
  tail -n 200 "$LOG_DIR"/postgresql@16*.log 2>/dev/null || tail -n 200 "$LOG_DIR/server.log" || true
  die "launchd service not healthy."
fi

ok "postgresql@16 running under launchd on port $PG_PORT"
echo "Update .env → DB_HOST=127.0.0.1, DB_PORT=$PG_PORT"
