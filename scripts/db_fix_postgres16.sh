#!/usr/bin/env bash
set -euo pipefail

BREW_PREFIX="$(brew --prefix)"
DATA_DIR="$BREW_PREFIX/var/postgresql@16"
LOG_DIR="$HOME/Library/Logs/homebrew/postgresql@16"
PLIST="$HOME/Library/LaunchAgents/homebrew.mxcl.postgresql@16.plist"
PG_PORT="${PG_PORT:-5432}"

info(){ printf "\033[1;34m→ %s\033[0m\n" "$*"; }
ok(){   printf "\033[1;32m✓ %s\033[0m\n" "$*"; }
die(){  printf "\033[1;31m✗ %s\033[0m\n" "$*"; exit 1; }

brew list postgresql@16 >/dev/null 2>&1 || brew install postgresql@16

info "Stopping other PG services…"
brew services stop postgresql@16 || true
brew services stop postgresql@15 postgresql@14 postgresql 2>/dev/null || true

info "Cleaning LaunchAgent…"
launchctl bootout "gui/$(id -u)" "$PLIST" 2>/dev/null || true
rm -f "$PLIST"
mkdir -p "$LOG_DIR" "$DATA_DIR"

if [ ! -d "$DATA_DIR" ] || [ -z "$(ls -A "$DATA_DIR" 2>/dev/null || true)" ]; then
  info "Initializing cluster…"
  initdb -D "$DATA_DIR"
fi

rm -f "$DATA_DIR/postmaster.pid" 2>/dev/null || true
find /tmp -maxdepth 1 -name ".s.PGSQL.*" -delete 2>/dev/null || true

if lsof -i :"$PG_PORT" >/dev/null 2>&1; then PG_PORT=5433; fi
if ! grep -qE '^port\s*=' "$DATA_DIR/postgresql.conf" 2>/dev/null; then
  echo "port = $PG_PORT" >> "$DATA_DIR/postgresql.conf"
else
  sed -i '' -E "s|^#?\s*port\s*=.*$|port = $PG_PORT|" "$DATA_DIR/postgresql.conf"
fi

info "Validating with manual start…"
pg_ctl -D "$DATA_DIR" -l "$LOG_DIR/server.log" start
sleep 1
pg_isready -h 127.0.0.1 -p "$PG_PORT" >/dev/null 2>&1 || (tail -n 200 "$LOG_DIR/server.log" && die "PG failed to start")
pg_ctl -D "$DATA_DIR" stop -m fast

info "Registering brew service…"
brew services cleanup
brew services start postgresql@16

sleep 1
pg_isready -h 127.0.0.1 -p "$PG_PORT" >/dev/null 2>&1 || (tail -n 200 "$LOG_DIR"/postgresql@16*.log 2>/dev/null || tail -n 200 "$LOG_DIR/server.log"; die "Service not healthy")

ok "PostgreSQL@16 is set to auto-start. Port=$PG_PORT"
