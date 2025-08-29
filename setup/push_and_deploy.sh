#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG ======
LOCAL_CORE="/Users/hardiksottany/Developer/lmanagement"
BRANCH="feature/ReactJs"

SSH_USER="django"
SSH_HOST="143.110.186.184"
REMOTE_ROOT="/home/django/lmanagement"
REMOTE_DEPLOY="$REMOTE_ROOT/scripts/server_deploy.sh"
# ====================

echo "→ Ensuring we’re on branch: $BRANCH"
cd "$LOCAL_CORE"

# Switch/create branch if needed
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout -b "$BRANCH"
else
  git switch "$BRANCH"
fi

# Commit local changes if any
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "→ You have changes. Asking for commit message..."
  read -rp "Commit message: " COMMIT_MSG
  if [[ -z "${COMMIT_MSG:-}" ]]; then
    echo "Commit message cannot be empty."
    exit 1
  fi
  git add -A
  git commit -m "$COMMIT_MSG"
else
  echo "→ No local changes to commit."
fi

echo "→ Pushing to origin/$BRANCH"
git push -u origin "$BRANCH"

# Ask for sudo password once (used on the server for service restarts and Node upgrade)
read -rsp "Enter sudo password for $SSH_USER@$SSH_HOST: " SUDO_PASS
echo

echo "→ Pulling & deploying on server"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST" bash -s <<REMOTE_EOF
set -euo pipefail

REMOTE_ROOT="$REMOTE_ROOT"
BRANCH="$BRANCH"
SUDO_PASS="$SUDO_PASS"

cd "\$REMOTE_ROOT"

echo "[server] Fetch & checkout branch: \$BRANCH"
git fetch --all --prune
if ! git rev-parse --verify "\$BRANCH" >/dev/null 2>&1; then
  git checkout -b "\$BRANCH" "origin/\$BRANCH"
else
  git checkout "\$BRANCH"
fi
git pull origin "\$BRANCH"

# If you have a custom deploy script, prefer it
if [[ -x "\$REMOTE_ROOT/scripts/server_deploy.sh" ]]; then
  echo "[server] Running server_deploy.sh"
  bash "\$REMOTE_ROOT/scripts/server_deploy.sh"
  echo "[server] Deploy done (custom script)."
  exit 0
fi

echo "[server] No custom server_deploy.sh found, running fallback pipeline..."

# --- Ensure Python venv paths ---
VENV="\$REMOTE_ROOT/venv"
PY="\$VENV/bin/python"
PIP="\$VENV/bin/pip"
FRONTEND="\$REMOTE_ROOT/frontend"

# --- Ensure Node.js >= 22 (fixes EBADENGINE for vite/react-router 7) ---
echo "[server] Checking Node.js version..."
if ! command -v node >/dev/null 2>&1; then
  echo "[server] Node not found. Installing n and Node 22..."
  echo "\$SUDO_PASS" | sudo -S npm i -g n
  echo "\$SUDO_PASS" | sudo -S n 22
else
  NODE_MAJOR="\$(node -p "process.versions.node.split('.')[0]")"
  if [ "\$NODE_MAJOR" -lt 20 ]; then
    echo "[server] Upgrading Node to 22..."
    echo "\$SUDO_PASS" | sudo -S npm i -g n
    echo "\$SUDO_PASS" | sudo -S n 22
  fi
fi
hash -r
echo "[server] Node version: \$(node -v)"
echo "[server] npm version:  \$(npm -v)"

# --- Backend deps ---
REQ_FILE="\$REMOTE_ROOT/requirenment.txt"
if [[ -f "\$REQ_FILE" ]]; then
  echo "[server] Installing Python requirements from requirenment.txt"
  "\$PIP" install -r "\$REQ_FILE"
else
  echo "[server][warn] requirenment.txt not found at \$REQ_FILE (skipping Python deps)"
fi

# --- Frontend build ---
if [[ -d "\$FRONTEND" ]]; then
  cd "\$FRONTEND"

  npm config set fund false >/dev/null 2>&1 || true
  npm config set audit false >/dev/null 2>&1 || true

  echo "[server] Installing frontend deps (try npm ci; fallback to npm install if lock is out of sync)..."
  if [[ -f package-lock.json ]]; then
    if ! npm ci; then
      echo "[server] npm ci failed due to lock mismatch; falling back to npm install"
      npm install
    fi
  else
    npm install
  fi

  echo "[server] Building frontend..."
  npm run build
else
  echo "[server][warn] Frontend directory not found at \$FRONTEND (skipping frontend build)"
fi

# --- Django tasks ---
cd "\$REMOTE_ROOT"
echo "[server] Running Django migrations & collectstatic"
"\$PY" manage.py makemigrations
"\$PY" manage.py migrate
"\$PY" manage.py collectstatic --noinput

# --- Restart services ---
echo "[server] Restarting services..."
echo "\$SUDO_PASS" | sudo -S systemctl restart gunicorn || echo "[server][warn] gunicorn service not found"
echo "\$SUDO_PASS" | sudo -S systemctl restart gunicorn_lmanagement || true
echo "\$SUDO_PASS" | sudo -S systemctl reload nginx || echo "[server][warn] nginx reload failed (check config/service name)"

echo "[server] Deploy done."
REMOTE_EOF

echo "✅ Push + pull + deploy complete."
