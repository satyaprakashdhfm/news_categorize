# Browser Replica App

This is a fully separate replica of the main app with isolated backend, frontend, database target, and Satya browser scraping flow.

## Isolation

- Backend runs on port `8001`.
- Frontend runs on port `3001`.
- Default database is local SQLite file `backend/browser_replica.db`.
- Browser scrape records are stored in a dedicated table: `browser_scrape_records`.
- Browser-source marker is fixed to `browser_satya`.

## Structure

- `backend/` - FastAPI app replica with added `/api/browser-scrape/*` endpoints
- `frontend/` - React app replica with new route `/browser-scrape`
- `db/` - SQL bootstrap script with browser table included
- `satya/` - standalone JS browser scraper used by backend service

## Setup

1. Database setup (default SQLite):

No manual DB bootstrap is required. The backend auto-creates tables at startup.

Optional Postgres mode:

```bash
cd browser_replica_app
psql -U postgres -v db_name='living_world_stories_browser' -f db/bootstrap.sql
```

Then set `DATABASE_URL` in `backend/.env` to your Postgres URL.

2. Backend dependencies:

```bash
cd browser_replica_app/backend
/home/satya/Desktop/news_categorize/.venv/bin/pip install -r requirements.txt
```

3. Frontend dependencies:

```bash
cd browser_replica_app/frontend
npm install
```

4. Satya dependencies:

```bash
cd browser_replica_app/satya
npm install
npx playwright install chromium
```

## Run

1. Start backend:

```bash
cd browser_replica_app/backend
/home/satya/Desktop/news_categorize/.venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

2. Start frontend:

```bash
cd browser_replica_app/frontend
npm run dev
```

Open `http://localhost:3001`.

## New Browser Endpoints

- `POST /api/browser-scrape/scrape`
- `GET /api/browser-scrape/history`

Sample payload:

```json
{
  "url": "https://example.com",
  "format": "text",
  "max_chars": 20000
}
```
