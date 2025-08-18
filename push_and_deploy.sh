#!/usr/bin/env bash
set -euo pipefail

# ====== CONFIG YOU GAVE ME ======
LOCAL_CORE="/Users/hardiksottany/Developer/lmanagement"
BRANCH="feature/ReactJs"

SSH_USER="django"
SSH_HOST="143.110.186.184"
REMOTE_ROOT="/home/django/lmanagement"
REMOTE_DEPLOY="$REMOTE_ROOT/scripts/server_deploy.sh"
# =================================

# Ask for commit message
read -rp "Commit message: " COMMIT_MSG
if [[ -z "${COMMIT_MSG:-}" ]]; then
  echo "Commit message cannot be empty."
  exit 1
fi

echo "→ Ensuring we’re on branch: $BRANCH"
cd "$LOCAL_CORE"
# switch/create branch if needed
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout -b "$BRANCH"
else
  git switch "$BRANCH"
fi

echo "→ Adding changes"
git add -A

# Commit only if there are staged changes; allow empty commit if nothing changed but you still want a deploy
if git diff --cached --quiet; then
  echo "No staged changes. Creating an empty commit to tag this deploy…"
  git commit --allow-empty -m "$COMMIT_MSG"
else
  git commit -m "$COMMIT_MSG"
fi

echo "→ Pushing to origin/$BRANCH"
git push -u origin "$BRANCH"

echo "→ Pulling on server and deploying"
ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST" bash -s <<'REMOTE_EOF'
set -euo pipefail
REMOTE_ROOT="/home/django/lmanagement"
BRANCH="feature/ReactJs"
cd "$REMOTE_ROOT"

echo "[server] Fetch & checkout branch"
git fetch --all --prune
# create local tracking branch if it doesn't exist
if ! git rev-parse --verify "$BRANCH" >/dev/null 2>&1; then
  git checkout -b "$BRANCH" "origin/$BRANCH"
else
  git checkout "$BRANCH"
fi
git pull origin "$BRANCH"

# Prefer your deploy script if present
if [[ -x "$REMOTE_ROOT/scripts/server_deploy.sh" ]]; then
  echo "[server] Running scripts/server_deploy.sh"
  bash "$REMOTE_ROOT/scripts/server_deploy.sh"
else
  echo "[server] No server_deploy.sh found. Running fallback deploy…"
  VENV="$REMOTE_ROOT/venv"
  PY="$VENV/bin/python"
  PIP="$VENV/bin/pip"
  FRONTEND="$REMOTE_ROOT/frontend"

  # 1) Backup DB (optional placeholder—edit DB creds if you want an automatic backup here)
  # pg_dump -U <DB_USER> -h <DB_HOST> <DB_NAME> > "$HOME/db_backup_$(date +%F_%H-%M-%S).sql" || true

  # 2) Python deps
  "$PIP" install --upgrade pip wheel setuptools
  "$PIP" install -r "$REMOTE_ROOT/requirements.txt"

  # 3) Node build
  if [[ -d "$FRONTEND" ]]; then
    cd "$FRONTEND"
    if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
    npm run build
  fi

  # 4) Django migrate + collectstatic
  cd "$REMOTE_ROOT"
  "$PY" manage.py migrate
  "$PY" manage.py collectstatic --noinput

  # 5) Restart services
  sudo systemctl restart gunicorn || sudo systemctl restart gunicorn_lmanagement
  sudo systemctl reload nginx || true
fi
echo "[server] Done."
REMOTE_EOF

echo "✅ Push + pull + deploy complete."
