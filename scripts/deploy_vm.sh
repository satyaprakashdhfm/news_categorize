#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/ubuntu/news_categorize}"
BRANCH="${BRANCH:-f2p}"
SERVICE_NAME="${SERVICE_NAME:-curio-backend}"
WEB_ROOT="${WEB_ROOT:-/var/www/curio}"

echo "[deploy] App dir: ${APP_DIR}"
echo "[deploy] Branch: ${BRANCH}"

cd "${APP_DIR}"

echo "[deploy] Syncing git branch..."
git fetch origin "${BRANCH}"
git checkout "${BRANCH}"
git reset --hard "origin/${BRANCH}"

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

echo "[deploy] Publishing frontend to ${WEB_ROOT}..."
sudo mkdir -p "${WEB_ROOT}"
sudo rsync -a --delete "${APP_DIR}/frontend/dist/" "${WEB_ROOT}/"
sudo chown -R www-data:www-data "${WEB_ROOT}"
sudo chmod -R 755 "${WEB_ROOT}"

echo "[deploy] Restarting services..."
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl reload nginx

echo "[deploy] Health check with retries..."
for i in {1..20}; do
  if curl -fsS http://127.0.0.1:8000/health >/dev/null; then
    echo "[deploy] Backend health check passed."
    break
  fi
  if [[ "$i" -eq 20 ]]; then
    echo "[deploy] Backend health check failed after retries."
    sudo systemctl status "${SERVICE_NAME}" --no-pager || true
    sudo journalctl -u "${SERVICE_NAME}" -n 80 --no-pager || true
    exit 1
  fi
  sleep 3
done

echo "[deploy] Deployment completed successfully."
