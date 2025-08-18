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

# switch/create branch if needed
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout -b "$BRANCH"
else
  git switch "$BRANCH"
fi

# Check if there are uncommitted changes
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

echo "→ Pulling & deploying on server"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST" bash -s <<'REMOTE_EOF'
set -euo pipefail
REMOTE_ROOT="/home/django/lmanagement"
BRANCH="feature/ReactJs"
cd "$REMOTE_ROOT"

echo "[server] Fetch & checkout branch"
git fetch --all --prune
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout -b "$BRANCH" "origin/$BRANCH"
else
  git checkout "$BRANCH"
fi
git pull origin "$BRANCH"

# Prefer your deploy script if present
if [[ -x "$REMOTE_ROOT/scripts/server_deploy.sh" ]]; then
  echo "[server] Running server_deploy.sh"
  bash "$REMOTE_ROOT/scripts/server_deploy.sh"
else
  echo "[server] No server_deploy.sh found, running fallback..."
  VENV="$REMOTE_ROOT/venv"
  PY="$VENV/bin/python"
  PIP="$VENV/bin/pip"
  FRONTEND="$REMOTE_ROOT/frontend"

  "$PIP" install -r "$REMOTE_ROOT/requirements.txt"

  if [[ -d "$FRONTEND" ]]; then
    cd "$FRONTEND"
    if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
    npm run build
  fi

  cd "$REMOTE_ROOT"
  "$PY" manage.py migrate
  "$PY" manage.py collectstatic --noinput

  sudo systemctl restart gunicorn || sudo systemctl restart gunicorn_lmanagement
  sudo systemctl reload nginx || true
fi
echo "[server] Deploy done."
REMOTE_EOF

echo "✅ Push + pull + deploy complete."
