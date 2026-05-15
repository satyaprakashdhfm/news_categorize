-- Migration v4: add card_id to browser_research_runs for cross-run item queries
ALTER TABLE browser_research_runs
    ADD COLUMN IF NOT EXISTS card_id VARCHAR;

CREATE INDEX IF NOT EXISTS idx_browser_research_runs_card_id
    ON browser_research_runs(card_id);
