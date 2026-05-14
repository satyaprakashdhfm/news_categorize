"""
Curio — Hierarchical Interest Configuration
Single source of truth for all domain/subdomain codes, labels, and data-source queries.
Replaces the old 5-domain flat system with a granular multi-level interest tree.
"""

# ── Full interest tree ─────────────────────────────────────────────────────
# Structure: domain_code -> { label, color, subdomains: { sub_code -> { label, queries, subreddits, hn_queries, youtube } } }

INTEREST_TREE: dict = {
    # ── Technology ──────────────────────────────────────────────────────────
    "TEC": {
        "label": "Technology",
        "color": "var(--domain-tech)",
        "icon": "🔬",
        "subdomains": {
            "SAI": {
                "label": "Software & AI",
                "queries": ["artificial intelligence software engineering breakthroughs news", "AI research models open source tooling"],
                "subreddits": ["artificial", "MachineLearning", "programming", "softwareengineering"],
                "hn_queries": ["AI", "machine learning", "software engineering"],
                "youtube": ["@TwoMinutePapers"],
            },
            "LLM": {
                "label": "LLMs & Generative AI",
                "queries": ["large language models GPT Claude Gemini generative AI news today", "LLM benchmark fine-tuning inference deployment"],
                "subreddits": ["LocalLLaMA", "ChatGPT", "ClaudeAI", "singularity", "OpenAI"],
                "hn_queries": ["LLM", "GPT", "Claude", "Gemini", "language model"],
                "youtube": ["@AndrejKarpathy", "@YannicKilcher"],
            },
            "AGT": {
                "label": "AI Agents & MCP",
                "queries": ["AI agents autonomous agentic workflows MCP protocol tool use news", "multi-agent systems LLM orchestration frameworks"],
                "subreddits": ["ClaudeCode", "antiai", "OpenAI", "learnmachinelearning"],
                "hn_queries": ["AI agent", "MCP", "agentic", "autonomous AI"],
                "youtube": [],
            },
            "WEB": {
                "label": "Web Development",
                "queries": ["React Next.js TypeScript web development frontend engineering news", "JavaScript framework releases web performance tooling"],
                "subreddits": ["reactjs", "webdev", "javascript", "nextjs"],
                "hn_queries": ["React", "Next.js", "TypeScript", "web development"],
                "youtube": ["@Fireship"],
            },
            "MOB": {
                "label": "Mobile Development",
                "queries": ["iOS Android React Native Flutter mobile development news", "mobile app framework Swift Kotlin release"],
                "subreddits": ["iOSProgramming", "androiddev", "reactnative", "FlutterDev"],
                "hn_queries": ["iOS", "Android", "React Native", "Flutter", "mobile"],
                "youtube": [],
            },
            "CLD": {
                "label": "Cloud & DevOps",
                "queries": ["Kubernetes Docker cloud infrastructure DevOps platform engineering news", "AWS GCP Azure cloud native serverless release"],
                "subreddits": ["kubernetes", "devops", "sysadmin", "aws"],
                "hn_queries": ["Kubernetes", "Docker", "cloud", "DevOps", "AWS"],
                "youtube": [],
            },
            "SEC": {
                "label": "Cybersecurity",
                "queries": ["cybersecurity vulnerability breach zero-day exploit security news", "threat intelligence ransomware security research"],
                "subreddits": ["netsec", "cybersecurity", "hacking", "AskNetsec"],
                "hn_queries": ["security", "vulnerability", "CVE", "breach", "exploit"],
                "youtube": [],
            },
            "DAT": {
                "label": "Data Science & Analytics",
                "queries": ["data science machine learning model analytics Python pandas news", "data engineering pipelines MLOps production ML"],
                "subreddits": ["datascience", "learnmachinelearning", "statistics", "dataengineering"],
                "hn_queries": ["data science", "analytics", "pandas", "MLOps"],
                "youtube": [],
            },
            "OSS": {
                "label": "Open Source",
                "queries": ["open source project GitHub trending developer tools releases news", "Rust Golang open source community contributions"],
                "subreddits": ["opensource", "programming", "rust", "golang"],
                "hn_queries": ["open source", "GitHub", "release", "Rust", "Go"],
                "youtube": [],
            },
            "ROB": {
                "label": "Robotics & Automation",
                "queries": ["robotics humanoid autonomous systems industrial automation AI news", "embodied AI robot manipulation locomotion"],
                "subreddits": ["robotics", "Automate", "singularity"],
                "hn_queries": ["robotics", "humanoid", "autonomous", "Boston Dynamics"],
                "youtube": [],
            },
            "BLK": {
                "label": "Blockchain & Crypto",
                "queries": ["blockchain cryptocurrency DeFi Web3 Bitcoin Ethereum news today", "NFT crypto market protocol launch development"],
                "subreddits": ["CryptoCurrency", "ethereum", "Bitcoin", "DeFi"],
                "hn_queries": ["blockchain", "crypto", "Bitcoin", "Ethereum", "DeFi"],
                "youtube": [],
            },
            "HRD": {
                "label": "Hardware & Chips",
                "queries": ["semiconductor chip GPU TSMC NVIDIA AI hardware innovation news", "Intel AMD processor chip shortage supply chain"],
                "subreddits": ["hardware", "chipdesign", "nvidia", "AMD_Stock"],
                "hn_queries": ["chip", "semiconductor", "GPU", "NVIDIA", "TSMC"],
                "youtube": [],
            },
            "SPC": {
                "label": "Space",
                "queries": ["space launch satellite SpaceX NASA moon Mars mission news today", "rocket commercial space constellation astronomy"],
                "subreddits": ["space", "SpaceXLounge", "nasa", "Astronomy"],
                "hn_queries": ["SpaceX", "NASA", "space", "rocket", "satellite"],
                "youtube": ["@EverydayAstronaut"],
            },
            "PHY": {
                "label": "Physics & Quantum",
                "queries": ["physics research quantum computing fusion energy breakthroughs news", "particle physics dark matter discovery nuclear"],
                "subreddits": ["Physics", "QuantumComputing", "science"],
                "hn_queries": ["physics", "quantum", "fusion energy"],
                "youtube": [],
            },
            "BIO": {
                "label": "Biotech & Genomics",
                "queries": ["biotech gene editing CRISPR genomics drug approval clinical trials news", "synthetic biology mRNA platform research"],
                "subreddits": ["biotech", "science", "genetics"],
                "hn_queries": ["CRISPR", "biotech", "genomics", "drug"],
                "youtube": [],
            },
            "DEF": {
                "label": "Defence Technology",
                "queries": ["defense technology military drones hypersonic weapons cyber warfare news", "arms procurement defense innovation AI weapons"],
                "subreddits": ["DefenseNews", "LessCredibleDefence", "geopolitics"],
                "hn_queries": ["military", "defense technology", "drone"],
                "youtube": [],
            },
            "NMI": {
                "label": "Nano & Materials",
                "queries": ["nanotechnology advanced materials graphene semiconductor research news", "material science manufacturing innovation breakthroughs"],
                "subreddits": ["Nanotechnology", "materials"],
                "hn_queries": ["nanotechnology", "materials science", "graphene"],
                "youtube": [],
            },
        },
    },

    # ── Business & Finance ──────────────────────────────────────────────────
    "BUS": {
        "label": "Business & Finance",
        "color": "var(--domain-biz)",
        "icon": "💼",
        "subdomains": {
            "SCA": {
                "label": "Startups & Venture Capital",
                "queries": ["startup funding unicorn IPO venture capital mergers acquisitions news", "Y Combinator seed Series A founder raise"],
                "subreddits": ["startups", "business", "venturecapital", "Entrepreneur"],
                "hn_queries": ["startup", "funding", "YC", "Series A", "venture capital"],
                "youtube": [],
            },
            "MID": {
                "label": "Markets & Industry",
                "queries": ["industry disruption market consolidation sector dynamics M&A news", "corporate strategy competitive landscape incumbents challengers"],
                "subreddits": ["business", "stocks", "investing"],
                "hn_queries": ["market", "industry", "acquisition"],
                "youtube": [],
            },
            "FIN": {
                "label": "FinTech & Payments",
                "queries": ["fintech payments digital banking neobank DeFi infrastructure news", "payment processing digital wallet financial innovation"],
                "subreddits": ["fintech", "personalfinance"],
                "hn_queries": ["fintech", "payments", "banking", "neobank"],
                "youtube": [],
            },
            "INV": {
                "label": "Investing & Markets",
                "queries": ["stock market IPO earnings private equity investment news today", "emerging markets capital flows equity bonds"],
                "subreddits": ["stocks", "investing", "SecurityAnalysis"],
                "hn_queries": ["stock market", "IPO", "investment", "earnings"],
                "youtube": [],
            },
            "MON": {
                "label": "Monetary Policy",
                "queries": ["central bank interest rate decision monetary policy inflation news", "Federal Reserve ECB rate cut hike quantitative easing"],
                "subreddits": ["finance", "economics", "investing"],
                "hn_queries": ["Fed", "interest rate", "inflation", "central bank"],
                "youtube": [],
            },
            "TRD": {
                "label": "Trade & Global Economy",
                "queries": ["global trade tariffs supply chain WTO bilateral deals export import news", "reshoring trade war economic diplomacy"],
                "subreddits": ["GlobalTrade", "economics"],
                "hn_queries": ["trade", "tariff", "supply chain", "WTO"],
                "youtube": [],
            },
        },
    },

    # ── Politics & World ───────────────────────────────────────────────────
    "POL": {
        "label": "Politics & World",
        "color": "var(--domain-policy)",
        "icon": "⚖️",
        "subdomains": {
            "GEO": {
                "label": "Geopolitics",
                "queries": ["geopolitical flashpoints global power shifts alliances diplomacy news", "international crisis world order great power competition"],
                "subreddits": ["geopolitics", "worldnews", "NeutralPolitics"],
                "hn_queries": ["geopolitics", "war", "diplomacy", "NATO"],
                "youtube": ["@WION"],
            },
            "EXE": {
                "label": "Government & Executive",
                "queries": ["heads of state executive government policy leadership decisions news", "president prime minister cabinet administration"],
                "subreddits": ["worldnews", "politics"],
                "hn_queries": ["government", "policy", "election"],
                "youtube": [],
            },
            "LEG": {
                "label": "Legislature & Policy",
                "queries": ["parliament legislation bills policy reforms law vote news", "congress senate regulation law passing"],
                "subreddits": ["politics", "law", "PoliticalDiscussion"],
                "hn_queries": ["legislation", "law", "regulation", "bill"],
                "youtube": [],
            },
            "JUD": {
                "label": "Judiciary & Law",
                "queries": ["court rulings legal judgments constitutional law news today", "supreme court international justice human rights verdict"],
                "subreddits": ["law", "SupremeCourt", "LegalAdvice"],
                "hn_queries": ["court", "ruling", "legal", "supreme court"],
                "youtube": [],
            },
            "DIP": {
                "label": "Diplomacy & Security",
                "queries": ["diplomacy international relations treaty sanctions foreign policy news", "NATO UN alliances security council conflict"],
                "subreddits": ["worldnews", "geopolitics"],
                "hn_queries": ["diplomacy", "sanctions", "treaty", "UN"],
                "youtube": [],
            },
        },
    },

    # ── Economy ────────────────────────────────────────────────────────────
    "ECO": {
        "label": "Economy",
        "color": "var(--domain-econ)",
        "icon": "📈",
        "subdomains": {
            "MAC": {
                "label": "Macroeconomics",
                "queries": ["global GDP growth inflation recession economic outlook news", "IMF World Bank fiscal policy macroeconomics"],
                "subreddits": ["economics", "MacroEconomics"],
                "hn_queries": ["GDP", "recession", "inflation", "macroeconomics"],
                "youtube": [],
            },
            "MIC": {
                "label": "Microeconomics",
                "queries": ["consumer trends pricing market structure competition news", "supply demand microeconomics business economics"],
                "subreddits": ["economics"],
                "hn_queries": ["microeconomics", "pricing", "market"],
                "youtube": [],
            },
            "ENE": {
                "label": "Energy & Resources",
                "queries": ["energy transition renewable solar wind nuclear oil gas electricity news", "clean energy grid battery storage EV"],
                "subreddits": ["energy", "Futurology", "solar"],
                "hn_queries": ["energy", "nuclear", "solar", "EV", "battery"],
                "youtube": [],
            },
            "CLM": {
                "label": "Climate & Environment",
                "queries": ["climate change global warming carbon emissions policy news", "environmental sustainability net zero COP"],
                "subreddits": ["climate", "environment", "ClimateActionPlan"],
                "hn_queries": ["climate", "carbon", "environment", "sustainability"],
                "youtube": [],
            },
        },
    },

    # ── Science & Society ─────────────────────────────────────────────────
    "OTH": {
        "label": "Science & Society",
        "color": "var(--domain-others)",
        "icon": "🔭",
        "subdomains": {
            "SCI": {
                "label": "General Science",
                "queries": ["science research breakthrough discovery Nature Science journal news", "scientific findings peer review study"],
                "subreddits": ["science", "EverythingScience", "Futurology"],
                "hn_queries": ["science", "research", "discovery", "study"],
                "youtube": ["@Veritasium"],
            },
            "HEA": {
                "label": "Health & Medicine",
                "queries": ["medical research FDA drug approval clinical trial health breakthrough news", "pandemic public health medicine treatment"],
                "subreddits": ["medicine", "Health", "neuroscience"],
                "hn_queries": ["health", "FDA", "medicine", "clinical trial"],
                "youtube": [],
            },
            "EDU": {
                "label": "Education & Research",
                "queries": ["education AI technology learning university research news", "online learning academic paper edtech"],
                "subreddits": ["education", "learnprogramming", "academia"],
                "hn_queries": ["education", "learning", "university", "research paper"],
                "youtube": [],
            },
            "GAM": {
                "label": "Gaming & Interactive Media",
                "queries": ["video games gaming industry release announcement esports news", "game development engine Unity Unreal launch"],
                "subreddits": ["gaming", "Games", "pcgaming"],
                "hn_queries": ["game", "gaming", "esports"],
                "youtube": [],
            },
        },
    },
}

# ── Derived flat maps (computed once at import time) ──────────────────────

# domain_code -> domain config
ALL_DOMAINS: dict[str, dict] = {
    code: {k: v for k, v in cfg.items() if k != "subdomains"}
    for code, cfg in INTEREST_TREE.items()
}

# subdomain_code -> subdomain config (with parent domain injected)
ALL_SUBDOMAINS: dict[str, dict] = {}
for _domain_code, _domain_cfg in INTEREST_TREE.items():
    for _sub_code, _sub_cfg in _domain_cfg["subdomains"].items():
        ALL_SUBDOMAINS[_sub_code] = {**_sub_cfg, "domain": _domain_code}

# domain_code -> list of subdomain codes
DOMAIN_TO_SUBDOMAINS: dict[str, list[str]] = {
    code: list(cfg["subdomains"].keys())
    for code, cfg in INTEREST_TREE.items()
}

# Flat label map for both domains and subdomains
SUBCATEGORY_LABELS: dict[str, str] = {
    **{code: cfg["label"] for code, cfg in ALL_DOMAINS.items()},
    **{code: cfg["label"] for code, cfg in ALL_SUBDOMAINS.items()},
}

# Valid code sets
VALID_DOMAIN_CODES: set[str] = set(INTEREST_TREE.keys())
VALID_SUBDOMAIN_CODES: set[str] = set(ALL_SUBDOMAINS.keys())
VALID_INTEREST_CODES: set[str] = VALID_DOMAIN_CODES | VALID_SUBDOMAIN_CODES


def resolve_to_subdomains(interest_codes: list[str]) -> list[str]:
    """
    Given a list of interest codes (mix of domain + subdomain codes),
    return a deduplicated list of subdomain codes to search.
    Domain codes expand to all their subdomains.
    """
    result: set[str] = set()
    for code in interest_codes:
        if code in VALID_DOMAIN_CODES:
            result.update(DOMAIN_TO_SUBDOMAINS.get(code, []))
        elif code in VALID_SUBDOMAIN_CODES:
            result.add(code)
    return list(result)
