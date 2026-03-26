Recommended approach:

Keep package-based by default (what you have now).
Pin exact versions (already done).
Only fork/local-vendor if you hit a blocker that cannot be solved with config or version pinning.

# Curio




AI-powered global news intelligence platform with advanced categorization and story threading.

## Stack

- **Backend**: FastAPI + SQLAlchemy + LangGraph + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS
- **AI**: Google Gemini (via LangGraph)
- **News Crawling**: newspaper4k + Google News (gnews)

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL

### 1. Database Setup

```bash
# Database is already set up
# User: satya3479
# Database: living_world_stories
```

### 2. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Update .env with your API keys
# GOOGLE_API_KEY=your_key

uvicorn main:app --reload
```

Backend: http://localhost:8000  
API Docs: http://localhost:8000/docs

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:3000

## Quick Start Scripts

```bash
./start.sh  # Start both backend and frontend
./stop.sh   # Stop all servers
```

## Features

- **DNA Coding**: Each article gets unique ID: `COUNTRY-CATEGORY-YEAR-SEQUENCE`
- **AI Categorization**: 8 categories (POL, ECO, SOC, TEC, ENV, HEA, SPO, SEC)
- **Story Threading**: Automatic article linking via LangGraph
- **Multi-Country**: USA, Russia, India, China, Japan

## Environment Variables

**backend/.env**:
```env
DATABASE_URL=postgresql://satya3479:satya3479@localhost:5432/living_world_stories
GOOGLE_API_KEY=your_gemini_api_key
LANGFUSE_SECRET_KEY=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_BASE_URL=https://cloud.langfuse.com
API_HOST=0.0.0.0
API_PORT=8000
SHOW_DB_LOGS=false
```

## Project Structure

```
backend/          # FastAPI backend
  ├── app/
  │   ├── api/           # API routes
  │   ├── models/        # SQLAlchemy models
  │   ├── schemas/       # Pydantic schemas
  │   └── services/      # LangGraph & scraping
  ├── main.py
  └── requirements.txt

frontend/         # React frontend
  ├── src/
  │   ├── components/    # React components
  │   ├── pages/         # Pages
  │   └── services/      # API client
  └── package.json

start.sh          # Start both servers
stop.sh           # Stop servers
```

## CI/CD (f2p branch to single VM)

This repository includes:

- `.github/workflows/deploy-f2p.yml` for GitHub Actions deployment
- `scripts/deploy_vm.sh` reusable VM deploy script

Workflow trigger:

- Push to `f2p`
- Manual trigger from Actions tab (`workflow_dispatch`)

Required GitHub repository secrets:

- `VM_HOST` (example: `3.88.249.110`)
- `VM_USER` (example: `ubuntu`)
- `VM_SSH_KEY` (private key contents for the VM)
- `VM_PORT` (optional, defaults to `22`)

The deployment script performs:

1. `git fetch/checkout/pull` on `f2p`
2. Backend dependency install in `backend/.venv`
3. Frontend production build in `frontend/dist`
4. `systemctl restart curio-backend`
5. `systemctl reload nginx`
6. Backend health check at `http://127.0.0.1:8000/health`

Prerequisite on VM:

- `curio-backend` systemd service must already exist
- `nginx` must already be installed and configured
- `ubuntu` user must be allowed to run `sudo systemctl` and `sudo nginx` commands

## License

MIT
