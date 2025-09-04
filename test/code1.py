import json
from tavily import TavilyClient

# Initialize Tavily client with your API key
client = TavilyClient(api_key="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")

# Define categories and tuned prompts
category_prompts = {
    "POL": "latest India politics government elections parliament policy site:(thehindu.com OR timesofindia.indiatimes.com OR indianexpress.com OR ndtv.com OR hindustantimes.com)",
    "ECO": "India economy business RBI stock market trade finance companies site:(economictimes.indiatimes.com OR livemint.com OR business-standard.com OR financialexpress.com)",
    "SOC": "India society culture education lifestyle caste gender social issues site:(thehindu.com OR timesofindia.indiatimes.com OR indianexpress.com OR hindustantimes.com OR scroll.in)",
    "TEC": "India technology startups research ISRO AI IT digital policy site:(yourstory.com OR inc42.com OR economictimes.indiatimes.com OR indianexpress.com OR thehindu.com)",
    "ENV": "India environment climate monsoon pollution wildlife renewable energy site:(downtoearth.org.in OR mongabay.co.in OR thehindu.com OR timesofindia.indiatimes.com OR hindustantimes.com)",
    "HEA": "India health medicine public health hospitals vaccines disease research site:(timesofindia.indiatimes.com OR thehindu.com OR indianexpress.com OR hindustantimes.com OR pib.gov.in)",
    "SPO": "India sports entertainment cricket IPL Bollywood movies streaming celebrities site:(espncricinfo.com OR indianexpress.com OR timesofindia.indiatimes.com OR filmfare.com OR bollywoodhungama.com)",
    "SEC": "India security conflict border incidents cybercrime law enforcement site:(thehindu.com OR indianexpress.com OR timesofindia.indiatimes.com OR hindustantimes.com OR pib.gov.in)"
}

results = {}

# Loop through each category and fetch top headlines
for code, query in category_prompts.items():
    print(f"\nFetching news for {code}...")
    try:
        search_res = client.search(
            query=query,
            search_depth="advanced",
            max_results=3,
            include_domains=None,
            exclude_domains=None,
            include_answer=True
        )
        # Collect headlines + URLs
        results[code] = [
            {"title": r.get("title"), "url": r.get("url")}
            for r in search_res.get("results", [])
        ]
    except Exception as e:
        print(f"Error fetching {code}: {e}")

# Save results as JSON
with open("india_news.json", "w", encoding="utf-8") as f:
    json.dump(results, f, indent=2, ensure_ascii=False)

print("\nTrending news JSON saved as india_news.json")
