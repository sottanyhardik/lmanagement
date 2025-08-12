#!/usr/bin/env bash
set -euo pipefail
ROOT="/Users/hardiksottany/Developer/lmanagement"

cd "$ROOT"

echo "🧹 Cleaning old builds…"
rm -rf frontend/dist
# comment out the next line if you don't use WhiteNoise/prod
rm -rf static_cdn/*

echo "📦 Installing & building frontend…"
cd frontend
npm ci
npm run build
cd ..

if [[ -d ".venv" ]]; then
  echo "🗂️  Collecting static (prod/WhiteNoise)…"
  source .venv/bin/activate
  python manage.py collectstatic --noinput || true
fi

echo "✅ Done. Start your server:"