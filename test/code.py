# paste this into code.py (replace your existing extraction loop)
import os
import json
import time
from tavily import TavilyClient
import tavily.errors as tav_err

API_KEY = os.getenv("TAVILY_API_KEY", "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")
client = TavilyClient(api_key=API_KEY)

# optional: if you need to use a proxy, uncomment & set it
# client.proxies = {"http": "http://user:pass@proxy:port", "https": "http://user:pass@proxy:port"}

category_queries = {
    "POL": "latest India politics government elections parliament policy site:(thehindu.com OR timesofindia.indiatimes.com OR indianexpress.com OR ndtv.com OR hindustantimes.com)",
    "ECO": "India economy business RBI stock market trade finance companies site:(economictimes.indiatimes.com OR livemint.com OR business-standard.com OR financialexpress.com)",
    "SOC": "India society culture education lifestyle caste gender social issues site:(thehindu.com OR timesofindia.indiatimes.com OR indianexpress.com OR hindustantimes.com OR scroll.in)",
    "TEC": "India technology startups research ISRO AI IT digital policy site:(yourstory.com OR inc42.com OR economictimes.indiatimes.com OR indianexpress.com OR thehindu.com)",
    "ENV": "India environment climate monsoon pollution wildlife renewable energy site:(downtoearth.org.in OR mongabay.co.in OR thehindu.com OR timesofindia.indiatimes.com OR hindustantimes.com)",
    "HEA": "India health medicine public health hospitals vaccines disease research site:(timesofindia.indiatimes.com OR thehindu.com OR indianexpress.com OR hindustantimes.com OR pib.gov.in)",
    "SPO": "India sports entertainment cricket IPL Bollywood movies streaming celebrities site:(espncricinfo.com OR indianexpress.com OR timesofindia.indiatimes.com OR filmfare.com OR bollywoodhungama.com)",
    "SEC": "India security conflict border incidents cybercrime law enforcement site:(thehindu.com OR indianexpress.com OR timesofindia.indiatimes.com OR hindustantimes.com OR pib.gov.in)"
}
def chunk_list(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i+n]

def extract_with_retries(urls, attempts=3, timeout=120, batch_size=2):
    """
    Try extracting `urls` in batches. Retries with exponential backoff.
    Returns dict mapping url -> extracted result (or error snippet).
    """
    results = {}
    for batch in chunk_list(urls, batch_size):
        success = False
        for attempt in range(1, attempts + 1):
            try:
                resp = client.extract(
                    urls=batch,
                    extract_depth="basic",
                    format="text",
                    include_images=False,
                    timeout=timeout
                )
                # `resp` should contain 'results' list corresponding to `batch`
                for item in resp.get("results", []):
                    results[item.get("url")] = item
                success = True
                break
            except (tav_err.TimeoutError, Exception) as e:
                wait = 2 ** attempt
                print(f"Batch error (attempt {attempt}/{attempts}) for {batch}: {e} — retrying in {wait}s")
                time.sleep(wait)
        if not success:
            # fallback: try single URL extraction so one bad URL doesn't wreck the batch
            for url in batch:
                for attempt in range(1, attempts + 1):
                    try:
                        resp = client.extract(
                            urls=[url],
                            extract_depth="basic",
                            format="text",
                            include_images=False,
                            timeout=timeout
                        )
                        item = (resp.get("results") or [{}])[0]
                        results[url] = item
                        break
                    except (tav_err.TimeoutError, Exception) as e:
                        wait = 2 ** attempt
                        print(f"Single-url fallback error (attempt {attempt}/{attempts}) for {url}: {e} — retrying in {wait}s")
                        time.sleep(wait)
                else:
                    results[url] = {"url": url, "error": "failed-after-retries"}
    return results

final_output = {}

for code, qry in category_queries.items():
    # search: you may get up to 3 results per category
    try:
        search_res = client.search(
            query=qry,
            topic="news",
            search_depth="basic",
            days=1,
            include_raw_content=False,
            max_results=3
        )
    except Exception as e:
        print(f"Search failed for {code}: {e}")
        final_output[code] = {"query": qry, "error": "search-failed", "details": str(e)}
        continue

    hits = search_res.get("results", [])[:3]
    urls = [r.get("url") for r in hits if r.get("url")]
    headlines = [r.get("title") for r in hits]

    if not urls:
        final_output[code] = {"query": qry, "headlines": headlines, "articles": []}
        continue

    # robust extract
    extracted = extract_with_retries(urls, attempts=3, timeout=120, batch_size=2)

    articles = []
    for u in urls:
        item = extracted.get(u, {})
        articles.append({
            "url": u,
            "title": item.get("title") or "",
            "content_snippet": (item.get("raw_content") or "")[:300],  # small preview
            "full_item": item   # full object from Tavily (may be large)
        })

    final_output[code] = {"query": qry, "headlines": headlines, "articles": articles}

# write result
with open("output.json", "w", encoding="utf-8") as f:
    json.dump(final_output, f, ensure_ascii=False, indent=2)

print("Done. Output written to output.json")
