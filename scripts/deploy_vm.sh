#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/news_categorize}"
BRANCH="${BRANCH:-f2p}"
SERVICE_NAME="${SERVICE_NAME:-curio-backend}"

echo "[deploy] App dir: ${APP_DIR}"
echo "[deploy] Branch: ${BRANCH}"

cd "${APP_DIR}"

echo "[deploy] Syncing git branch..."
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "[deploy] Installing backend dependencies..."
cd backend
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

echo "[deploy] Building frontend..."
cd "${APP_DIR}/frontend"
npm ci
npm run build

echo "[deploy] Restarting services..."
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl reload nginx

echo "[deploy] Health check..."
curl -fsS http://127.0.0.1:8000/health >/dev/null

echo "[deploy] Deployment completed successfully."
