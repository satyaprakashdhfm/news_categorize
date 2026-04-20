-- Migration v2: new user system, feed cards, subcategory taxonomy
-- Run against an existing living_world_stories database.
--
-- Usage:
--   psql -U postgres -d living_world_stories -f db/migration_v2.sql

\set ON_ERROR_STOP on
BEGIN;

-- 1) Drop countryenum dependency from articles & story_threads
ALTER TABLE articles
    ALTER COLUMN country TYPE VARCHAR(64) USING country::TEXT,
    ALTER COLUMN country DROP NOT NULL;

ALTER TABLE story_threads
    ALTER COLUMN country TYPE VARCHAR(64) USING country::TEXT,
    ALTER COLUMN country DROP NOT NULL;

-- 2) Add subcategory to articles
ALTER TABLE articles
    ADD COLUMN IF NOT EXISTS subcategory VARCHAR(8) NOT NULL DEFAULT 'OTH';

-- 3) Users table
CREATE TABLE IF NOT EXISTS users (
    id            VARCHAR      PRIMARY KEY,
    email         VARCHAR(256) UNIQUE NOT NULL,
    name          VARCHAR(256) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    role          VARCHAR(16)  NOT NULL DEFAULT 'user'
                      CHECK (role IN ('user', 'admin')),
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 4) Add created_by to browser_research_runs
ALTER TABLE browser_research_runs
    ADD COLUMN IF NOT EXISTS created_by VARCHAR
        REFERENCES users(id) ON DELETE SET NULL;

-- 5) Feed cards table
CREATE TABLE IF NOT EXISTS feed_cards (
    id          VARCHAR      PRIMARY KEY,
    type        VARCHAR(16)  NOT NULL CHECK (type IN ('domain', 'custom')),
    title       VARCHAR(256) NOT NULL,
    domain      VARCHAR(8),
    subdomain   VARCHAR(8),
    description TEXT,
    run_id      VARCHAR
        REFERENCES browser_research_runs(run_id) ON DELETE SET NULL,
    created_by  VARCHAR
        REFERENCES users(id) ON DELETE SET NULL,
    is_global   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 6) User feed cards junction table
CREATE TABLE IF NOT EXISTS user_feed_cards (
    id       VARCHAR   PRIMARY KEY,
    user_id  VARCHAR   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    card_id  VARCHAR   NOT NULL REFERENCES feed_cards(id) ON DELETE CASCADE,
    position INTEGER   NOT NULL DEFAULT 0,
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, card_id)
);

-- 7) New indexes
CREATE INDEX IF NOT EXISTS idx_articles_country        ON articles (country);
CREATE INDEX IF NOT EXISTS idx_articles_subcategory    ON articles (subcategory);
CREATE INDEX IF NOT EXISTS idx_articles_published_at   ON articles ("publishedAt");
CREATE INDEX IF NOT EXISTS idx_feed_cards_domain       ON feed_cards (domain);
CREATE INDEX IF NOT EXISTS idx_feed_cards_subdomain    ON feed_cards (subdomain);
CREATE INDEX IF NOT EXISTS idx_feed_cards_is_global    ON feed_cards (is_global);
CREATE INDEX IF NOT EXISTS idx_feed_cards_created_by   ON feed_cards (created_by);
CREATE INDEX IF NOT EXISTS idx_user_feed_cards_user_id ON user_feed_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_cards_card_id ON user_feed_cards (card_id);

COMMIT;
