# Curio Browser Runtime

Integrated browser runtime module for main backend scraping and extraction.

## What is included

- Browser mode: Playwright-based rendering for JS-heavy sites (Reddit, YouTube pages, modern news sites).
- HTTP mode: lightweight fetch for static pages.
- Readability pipeline: sanitized HTML + readable markdown/text extraction.
- Interaction actions: click, type, press, select, hover, wait, goto.

## Setup

```bash
cd backend/browser_runtime
npm install
npx playwright install chromium
```

## Run

```bash
npm run scrape -- --url https://www.reddit.com/r/programming --mode browser --format text --out reddit.json
```

You can also scrape YouTube/news pages:

```bash
npm run scrape -- --url https://www.youtube.com/@OpenAI --mode browser --format markdown --out youtube.json
npm run scrape -- --url https://www.bbc.com/news --mode browser --format text --out news.json
```

HTTP mode with retries:

```bash
npm run scrape -- --url https://news.ycombinator.com --mode http --httpRetries 3 --httpRetryDelayMs 1000 --out hn-http.json
```

## Use actions (optional)

```bash
npm run scrape -- --url https://www.google.com --actions-file actions.example.json --out result.json
```

## Output shape

```json
{
  "mode": "browser",
  "format": "text",
  "requestedUrl": "https://example.com",
  "finalUrl": "https://example.com",
  "title": "Example",
  "text": "...",
  "html": "...",
  "truncated": {
    "text": false,
    "html": false
  },
  "scrapedAt": "2026-03-31T00:00:00.000Z"
}
```

## Notes

- For strongest extraction on dynamic websites, use `--mode browser`.
- If your environment already has Chrome installed, pass `--browserPath`.
- If a site blocks traffic, rotate user-agent/proxy with `--userAgent` and `--proxyUrl`.
- For unstable networks in HTTP mode, tune `--httpRetries` and `--httpRetryDelayMs`.
