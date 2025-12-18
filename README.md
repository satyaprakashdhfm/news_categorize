# Living World Stories

AI-powered news categorization platform with DNA-based article tracking and story threading.

## Stack

- **Backend**: FastAPI + SQLAlchemy + LangGraph + PostgreSQL
- **Frontend**: React + Vite + TailwindCSS
- **AI**: Google Gemini (via LangGraph)
- **News API**: Tavily

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
# TVLY_API_KEY=your_key

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
TVLY_API_KEY=your_tavily_api_key
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

## License

MIT
