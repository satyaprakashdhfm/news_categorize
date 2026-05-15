-- Migration v3: add relevance_score to browser_research_items
ALTER TABLE browser_research_items
    ADD COLUMN IF NOT EXISTS relevance_score FLOAT;
