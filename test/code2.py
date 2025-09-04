# To install: pip install tavily-python
from tavily import TavilyClient
import json

client = TavilyClient("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")

# Step 1: Search for economics trending topics
search_res = client.search(
    query="indian economics trending topics on 03-09-2025",
    search_depth="advanced",
    max_results=5,
    include_answer=False
)

# Collect URLs
urls = [r["url"] for r in search_res.get("results", [])]

print("Found URLs:", urls)

# Step 2: Extract clean summaries (no raw HTML noise)
articles = []
if urls:
    extract_res = client.extract(
        urls=urls,
        include_raw_content=False,   # cleaner body text only
        include_images=False,
        summary=True                 # Tavily will return a neat summary
    )

    # Build clean article list
    for item in extract_res.get("results", []):
        articles.append({
            "url": item.get("url"),
            "title": item.get("title"),
            "summary": item.get("content")[:500]  # take first 500 chars for brevity
        })

    # Save to JSON
    with open("india_economics_clean.json", "w", encoding="utf-8") as f:
        json.dump(articles, f, indent=2, ensure_ascii=False)

    print("\n✅ Clean summaries saved in india_economics_clean.json")
else:
    print("⚠️ No URLs found in search results.")
