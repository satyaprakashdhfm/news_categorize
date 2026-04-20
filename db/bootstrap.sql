-- PostgreSQL bootstrap script for Curio backend
-- Creates database + schema objects (enums, tables, indexes, FK constraints).
--
-- Usage:
--   psql -U postgres -f db/bootstrap.sql
--
-- Optional override for DB name:
--   psql -U postgres -v db_name='living_world_stories' -f db/bootstrap.sql

\set ON_ERROR_STOP on
\if :{?db_name}
\else
\set db_name 'living_world_stories'
\endif

-- 1) Create database if missing
SELECT format('CREATE DATABASE %I', :'db_name')
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = :'db_name'
)
\gexec

-- 2) Connect to target DB
\connect :db_name

BEGIN;

-- 3) Enums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoryenum') THEN
        CREATE TYPE categoryenum AS ENUM ('POL', 'ECO', 'BUS', 'TEC');
    END IF;
END $$;

-- 4) Users
CREATE TABLE IF NOT EXISTS users (
    id           VARCHAR      PRIMARY KEY,
    email        VARCHAR(256) UNIQUE NOT NULL,
    name         VARCHAR(256) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    role         VARCHAR(16)  NOT NULL DEFAULT 'user'
                     CHECK (role IN ('user', 'admin')),
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- 5) Story threads  (country is now a plain tag, not an enum)
CREATE TABLE IF NOT EXISTS story_threads (
    id            VARCHAR      PRIMARY KEY,
    title         VARCHAR      NOT NULL,
    description   TEXT,
    country       VARCHAR(64),
    category      categoryenum NOT NULL,
    "startDate"   TIMESTAMP    NOT NULL,
    "lastUpdate"  TIMESTAMP    DEFAULT NOW(),
    "articleCount" INTEGER     DEFAULT 0
);

-- 6) Articles
CREATE TABLE IF NOT EXISTS articles (
    id           VARCHAR      PRIMARY KEY,
    "dnaCode"    VARCHAR      NOT NULL UNIQUE,
    title        VARCHAR      NOT NULL,
    content      TEXT,
    summary      TEXT,
    "imageUrl"   VARCHAR,
    "sourceUrl"  VARCHAR      NOT NULL,
    "publishedAt" TIMESTAMP   NOT NULL,
    "scrapedAt"  TIMESTAMP    DEFAULT NOW(),
    country      VARCHAR(64),
    category     categoryenum NOT NULL,
    subcategory  VARCHAR(8)   NOT NULL DEFAULT 'OTH',
    year         INTEGER      NOT NULL,
    "sequenceNum" INTEGER     NOT NULL,
    "threadId"   VARCHAR,
    "parentId"   VARCHAR,
    CONSTRAINT fk_articles_thread
        FOREIGN KEY ("threadId") REFERENCES story_threads(id),
    CONSTRAINT fk_articles_parent
        FOREIGN KEY ("parentId") REFERENCES articles(id)
);

-- 7) Custom agents
CREATE TABLE IF NOT EXISTS custom_agents (
    id        VARCHAR      PRIMARY KEY,
    title     VARCHAR(160) NOT NULL,
    prompt    TEXT         NOT NULL,
    "createdAt" TIMESTAMP  NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP  NOT NULL DEFAULT NOW()
);

-- 8) Custom agent feed articles
CREATE TABLE IF NOT EXISTS custom_agent_feed_articles (
    id           VARCHAR       PRIMARY KEY,
    agent_id     VARCHAR       NOT NULL,
    title        VARCHAR(500)  NOT NULL,
    url          VARCHAR(1000) NOT NULL,
    summary      TEXT,
    content      TEXT,
    image_url    VARCHAR(1000),
    published_at VARCHAR(64),
    score        DOUBLE PRECISION DEFAULT 0,
    position     INTEGER       NOT NULL DEFAULT 0,
    "createdAt"  TIMESTAMP     NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_custom_agent_feed_agent
        FOREIGN KEY (agent_id) REFERENCES custom_agents(id)
);

-- 9) Custom YouTube videos
CREATE TABLE IF NOT EXISTS custom_youtube_videos (
    id             VARCHAR       PRIMARY KEY,
    run_id         VARCHAR(64)   NOT NULL,
    channel_input  VARCHAR(500)  NOT NULL,
    channel_title  VARCHAR(500),
    video_id       VARCHAR(64),
    video_url      VARCHAR(1000) NOT NULL,
    title          VARCHAR(500)  NOT NULL,
    description    TEXT,
    summary        TEXT,
    published_at   VARCHAR(64),
    position       INTEGER       NOT NULL DEFAULT 0,
    score          DOUBLE PRECISION DEFAULT 0,
    "scrapedAt"    TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- 10) Custom Reddit posts
CREATE TABLE IF NOT EXISTS custom_reddit_posts (
    id           VARCHAR       PRIMARY KEY,
    run_id       VARCHAR(64)   NOT NULL,
    subreddit    VARCHAR(128)  NOT NULL,
    mode         VARCHAR(32)   NOT NULL,
    post_id      VARCHAR(64),
    post_url     VARCHAR(1000) NOT NULL,
    title        VARCHAR(500)  NOT NULL,
    selftext     TEXT,
    summary      TEXT,
    author       VARCHAR(128),
    score        DOUBLE PRECISION DEFAULT 0,
    num_comments INTEGER       DEFAULT 0,
    published_at VARCHAR(64),
    position     INTEGER       NOT NULL DEFAULT 0,
    "scrapedAt"  TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- 11) Browser research runs
CREATE TABLE IF NOT EXISTS browser_research_runs (
    run_id                    VARCHAR   PRIMARY KEY,
    query                     VARCHAR   NOT NULL,
    selected_reddit_communities TEXT    NOT NULL DEFAULT '[]',
    youtube_channels_used     TEXT      NOT NULL DEFAULT '[]',
    total_blogs               INTEGER   NOT NULL DEFAULT 0,
    created_by                VARCHAR,
    generated_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_browser_research_runs_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 12) Browser research items
CREATE TABLE IF NOT EXISTS browser_research_items (
    id           SERIAL    PRIMARY KEY,
    run_id       VARCHAR   NOT NULL,
    source       VARCHAR   NOT NULL,
    title        TEXT      NOT NULL,
    summary      TEXT      NOT NULL,
    url          TEXT      NOT NULL,
    community    VARCHAR,
    channel      VARCHAR,
    author       VARCHAR,
    score        INTEGER,
    comments     INTEGER,
    published_at VARCHAR,
    CONSTRAINT fk_browser_research_items_run
        FOREIGN KEY (run_id) REFERENCES browser_research_runs(run_id) ON DELETE CASCADE
);

-- 13) Browser research run metrics
CREATE TABLE IF NOT EXISTS browser_research_run_metrics (
    run_id             VARCHAR PRIMARY KEY,
    llm_model          VARCHAR,
    llm_calls          INTEGER NOT NULL DEFAULT 0,
    prompt_tokens      INTEGER NOT NULL DEFAULT 0,
    output_tokens      INTEGER NOT NULL DEFAULT 0,
    total_tokens       INTEGER NOT NULL DEFAULT 0,
    estimated_cost_usd TEXT    NOT NULL DEFAULT '0',
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_browser_research_run_metrics_run
        FOREIGN KEY (run_id) REFERENCES browser_research_runs(run_id) ON DELETE CASCADE
);

-- 14) Feed cards  (domain cards created by admin; custom cards created by users)
CREATE TABLE IF NOT EXISTS feed_cards (
    id          VARCHAR      PRIMARY KEY,
    type        VARCHAR(16)  NOT NULL CHECK (type IN ('domain', 'custom')),
    title       VARCHAR(256) NOT NULL,
    domain      VARCHAR(8),           -- POL / ECO / BUS / TEC / OTH
    subdomain   VARCHAR(8),           -- EXE / BIO / SAI … / OTH
    description TEXT,
    run_id      VARCHAR,              -- FK → browser_research_runs (custom cards)
    created_by  VARCHAR,              -- FK → users (NULL = admin/system)
    is_global   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_feed_cards_run
        FOREIGN KEY (run_id) REFERENCES browser_research_runs(run_id) ON DELETE SET NULL,
    CONSTRAINT fk_feed_cards_user
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

-- 15) User feed cards  (which cards each user has pinned to their personal feed)
CREATE TABLE IF NOT EXISTS user_feed_cards (
    id       VARCHAR   PRIMARY KEY,
    user_id  VARCHAR   NOT NULL,
    card_id  VARCHAR   NOT NULL,
    position INTEGER   NOT NULL DEFAULT 0,
    added_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, card_id),
    CONSTRAINT fk_user_feed_cards_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_feed_cards_card
        FOREIGN KEY (card_id) REFERENCES feed_cards(id) ON DELETE CASCADE
);

-- 16) Indexes
CREATE INDEX IF NOT EXISTS idx_articles_country        ON articles (country);
CREATE INDEX IF NOT EXISTS idx_articles_category       ON articles (category);
CREATE INDEX IF NOT EXISTS idx_articles_subcategory    ON articles (subcategory);
CREATE INDEX IF NOT EXISTS idx_articles_published_at   ON articles ("publishedAt");

CREATE INDEX IF NOT EXISTS idx_custom_agent_feed_agent_id  ON custom_agent_feed_articles (agent_id);

CREATE INDEX IF NOT EXISTS idx_custom_youtube_videos_run_id       ON custom_youtube_videos (run_id);
CREATE INDEX IF NOT EXISTS idx_custom_youtube_videos_channel_input ON custom_youtube_videos (channel_input);
CREATE INDEX IF NOT EXISTS idx_custom_youtube_videos_video_id      ON custom_youtube_videos (video_id);

CREATE INDEX IF NOT EXISTS idx_custom_reddit_posts_run_id   ON custom_reddit_posts (run_id);
CREATE INDEX IF NOT EXISTS idx_custom_reddit_posts_subreddit ON custom_reddit_posts (subreddit);
CREATE INDEX IF NOT EXISTS idx_custom_reddit_posts_mode      ON custom_reddit_posts (mode);
CREATE INDEX IF NOT EXISTS idx_custom_reddit_posts_post_id   ON custom_reddit_posts (post_id);

CREATE INDEX IF NOT EXISTS idx_browser_research_items_run_id ON browser_research_items (run_id);

CREATE INDEX IF NOT EXISTS idx_feed_cards_domain       ON feed_cards (domain);
CREATE INDEX IF NOT EXISTS idx_feed_cards_subdomain    ON feed_cards (subdomain);
CREATE INDEX IF NOT EXISTS idx_feed_cards_is_global    ON feed_cards (is_global);
CREATE INDEX IF NOT EXISTS idx_feed_cards_created_by   ON feed_cards (created_by);

CREATE INDEX IF NOT EXISTS idx_user_feed_cards_user_id ON user_feed_cards (user_id);
CREATE INDEX IF NOT EXISTS idx_user_feed_cards_card_id ON user_feed_cards (card_id);

COMMIT;
