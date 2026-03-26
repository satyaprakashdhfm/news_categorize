#!/usr/bin/env bash
set -euo pipefail

# First-time VM bootstrap for Curio (single Ubuntu VM).
# This script is intended for initial server provisioning.
# Repeat deployments should use scripts/deploy_vm.sh.

APP_DIR="${APP_DIR:-/home/ubuntu/news_categorize}"
REPO_URL="${REPO_URL:-https://github.com/satyaprakashdhfm/news_categorize.git}"
BRANCH="${BRANCH:-f2p}"
APP_USER="${APP_USER:-ubuntu}"
APP_GROUP="${APP_GROUP:-ubuntu}"

DB_NAME="${DB_NAME:-living_world_stories}"
DB_USER="${DB_USER:-satya3479}"
DB_PASSWORD="${DB_PASSWORD:-1234}"

SERVICE_NAME="${SERVICE_NAME:-curio-backend}"
WEB_ROOT="${WEB_ROOT:-/var/www/curio}"
SERVER_NAME="${SERVER_NAME:-_}"

echo "[bootstrap] Starting first-time VM bootstrap"
echo "[bootstrap] App dir: ${APP_DIR}"
echo "[bootstrap] Branch: ${BRANCH}"

export DEBIAN_FRONTEND=noninteractive

echo "[bootstrap] Installing OS packages"
sudo apt update
sudo apt install -y \
  git nginx postgresql postgresql-contrib \
  python3-venv python3-pip \
  curl gnupg ca-certificates rsync

echo "[bootstrap] Installing Node.js 20"
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | sudo tee /etc/apt/sources.list.d/nodesource.list >/dev/null
sudo apt update
sudo apt install -y nodejs

echo "[bootstrap] Ensuring PostgreSQL is running"
sudo systemctl enable postgresql
sudo systemctl restart postgresql

echo "[bootstrap] Cloning or updating repository"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  sudo mkdir -p "$(dirname "${APP_DIR}")"
  sudo chown -R "${APP_USER}:${APP_GROUP}" "$(dirname "${APP_DIR}")"
  git clone --branch "${BRANCH}" --single-branch "${REPO_URL}" "${APP_DIR}"
else
  cd "${APP_DIR}"
  git fetch origin "${BRANCH}"
  git checkout "${BRANCH}"
  git pull --ff-only origin "${BRANCH}"
fi

cd "${APP_DIR}"

echo "[bootstrap] Creating PostgreSQL role/database if missing"
sudo -u postgres psql <<SQL
DO $$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
      CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASSWORD}';
   ELSE
      ALTER ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}';
   END IF;
END
$$;
SQL

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

sudo -u postgres psql -d "${DB_NAME}" -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};"

echo "[bootstrap] Applying DB bootstrap schema"
sudo -u postgres psql -v db_name="'${DB_NAME}'" -f db/bootstrap.sql

echo "[bootstrap] Preparing backend virtual environment"
cd "${APP_DIR}/backend"
if [[ ! -d .venv ]]; then
  python3 -m venv .venv
fi
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

if [[ ! -f "${APP_DIR}/backend/.env" ]]; then
  echo "[bootstrap] Creating backend .env template"
  cat > "${APP_DIR}/backend/.env" <<EOF
# Database
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"

# Google Gemini AI API for LangChain
GOOGLE_API_KEY="replace_with_real_key"

LANGFUSE_SECRET_KEY=""
LANGFUSE_PUBLIC_KEY=""
LANGFUSE_BASE_URL="https://cloud.langfuse.com"

# Tavily API
TVLY_API_KEY=""

# Optional: set to "true" to enable verbose database logs
SHOW_DB_LOGS=false

# FastAPI
API_HOST=127.0.0.1
API_PORT=8000
EOF
fi

echo "[bootstrap] Creating systemd service: ${SERVICE_NAME}"
sudo tee "/etc/systemd/system/${SERVICE_NAME}.service" > /dev/null <<EOF
[Unit]
Description=Curio FastAPI Backend
After=network.target

[Service]
User=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
Environment=PATH=${APP_DIR}/backend/.venv/bin
ExecStart=${APP_DIR}/backend/.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"

echo "[bootstrap] Building frontend"
cd "${APP_DIR}/frontend"
npm ci
npm run build

echo "[bootstrap] Publishing frontend files to ${WEB_ROOT}"
sudo mkdir -p "${WEB_ROOT}"
sudo rsync -a --delete "${APP_DIR}/frontend/dist/" "${WEB_ROOT}/"
sudo chown -R www-data:www-data "${WEB_ROOT}"
sudo chmod -R 755 "${WEB_ROOT}"

echo "[bootstrap] Configuring Nginx"
sudo tee /etc/nginx/sites-available/curio > /dev/null <<EOF
server {
    listen 80;
    server_name ${SERVER_NAME};

    root ${WEB_ROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/curio /etc/nginx/sites-enabled/curio
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "[bootstrap] Running smoke tests"
curl -fsS http://127.0.0.1/health >/dev/null
curl -fsS http://127.0.0.1/api/articles >/dev/null

echo "[bootstrap] Completed successfully"
echo "[bootstrap] Next steps:"
echo "  1) Update ${APP_DIR}/backend/.env with real API keys if placeholders are present"
echo "  2) Restart backend: sudo systemctl restart ${SERVICE_NAME}"
echo "  3) Configure HTTPS with certbot when domain is ready"
