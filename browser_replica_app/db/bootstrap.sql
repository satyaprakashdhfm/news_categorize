-- PostgreSQL bootstrap script for Curio backend
-- Creates database + schema objects (enums, tables, indexes, FK constraints).
--
-- Usage:
--   psql -U postgres -f db/bootstrap.sql
--
-- Optional override for DB name:
--   psql -U postgres -v db_name='living_world_stories_browser' -f db/bootstrap.sql

\set ON_ERROR_STOP on
\if :{?db_name}
\else
\set db_name 'living_world_stories_browser'
\endif

-- 1) Create database if missing (default: living_world_stories_browser)
SELECT format('CREATE DATABASE %I', :'db_name')
WHERE NOT EXISTS (
    SELECT 1 FROM pg_database WHERE datname = :'db_name'
)
\gexec

-- 2) Connect to target DB
\connect :db_name

BEGIN;

-- 3) Enums used by SQLAlchemy models
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'countryenum') THEN
        CREATE TYPE countryenum AS ENUM (
            'USA', 'CHINA', 'GERMANY', 'INDIA', 'JAPAN', 'UK', 'FRANCE', 'ITALY'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'categoryenum') THEN
        CREATE TYPE categoryenum AS ENUM (
            'POL', 'ECO', 'BUS', 'TEC'
        );
    END IF;
END $$;

-- 4) Core story thread table
CREATE TABLE IF NOT EXISTS story_threads (
    id VARCHAR PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    country countryenum NOT NULL,
    category categoryenum NOT NULL,
    "startDate" TIMESTAMP NOT NULL,
    "lastUpdate" TIMESTAMP DEFAULT NOW(),
    "articleCount" INTEGER DEFAULT 0
);

-- 5) Articles table
CREATE TABLE IF NOT EXISTS articles (
    id VARCHAR PRIMARY KEY,
    "dnaCode" VARCHAR NOT NULL UNIQUE,
    title VARCHAR NOT NULL,
    content TEXT,
    summary TEXT,
    "imageUrl" VARCHAR,
    "sourceUrl" VARCHAR NOT NULL,
    "publishedAt" TIMESTAMP NOT NULL,
    "scrapedAt" TIMESTAMP DEFAULT NOW(),
    country countryenum NOT NULL,
    category categoryenum NOT NULL,
    year INTEGER NOT NULL,
    "sequenceNum" INTEGER NOT NULL,
    "threadId" VARCHAR,
    "parentId" VARCHAR,
    CONSTRAINT fk_articles_thread
        FOREIGN KEY ("threadId") REFERENCES story_threads(id),
    CONSTRAINT fk_articles_parent
        FOREIGN KEY ("parentId") REFERENCES articles(id)
);

-- 6) Custom agent table
CREATE TABLE IF NOT EXISTS custom_agents (
    id VARCHAR PRIMARY KEY,
    title VARCHAR(160) NOT NULL,
    prompt TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 7) Custom agent feed articles
CREATE TABLE IF NOT EXISTS custom_agent_feed_articles (
    id VARCHAR PRIMARY KEY,
    agent_id VARCHAR NOT NULL,
    title VARCHAR(500) NOT NULL,
    url VARCHAR(1000) NOT NULL,
    summary TEXT,
    content TEXT,
    image_url VARCHAR(1000),
    published_at VARCHAR(64),
    score DOUBLE PRECISION DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_custom_agent_feed_agent
        FOREIGN KEY (agent_id) REFERENCES custom_agents(id)
);

-- 8) Custom YouTube videos
CREATE TABLE IF NOT EXISTS custom_youtube_videos (
    id VARCHAR PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL,
    channel_input VARCHAR(500) NOT NULL,
    channel_title VARCHAR(500),
    video_id VARCHAR(64),
    video_url VARCHAR(1000) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    summary TEXT,
    published_at VARCHAR(64),
    position INTEGER NOT NULL DEFAULT 0,
    score DOUBLE PRECISION DEFAULT 0,
    "scrapedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 9) Custom Reddit posts
CREATE TABLE IF NOT EXISTS custom_reddit_posts (
    id VARCHAR PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL,
    subreddit VARCHAR(128) NOT NULL,
    mode VARCHAR(32) NOT NULL,
    post_id VARCHAR(64),
    post_url VARCHAR(1000) NOT NULL,
    title VARCHAR(500) NOT NULL,
    selftext TEXT,
    summary TEXT,
    author VARCHAR(128),
    score DOUBLE PRECISION DEFAULT 0,
    num_comments INTEGER DEFAULT 0,
    published_at VARCHAR(64),
    position INTEGER NOT NULL DEFAULT 0,
    "scrapedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 10) Browser scrape records (Satya-backed browser mode)
CREATE TABLE IF NOT EXISTS browser_scrape_records (
    id VARCHAR PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL,
    requested_url VARCHAR(1000) NOT NULL,
    final_url VARCHAR(1000) NOT NULL,
    title VARCHAR(500),
    extracted_text TEXT NOT NULL,
    mode VARCHAR(32) NOT NULL DEFAULT 'browser',
    output_format VARCHAR(32) NOT NULL DEFAULT 'text',
    scrape_source VARCHAR(64) NOT NULL DEFAULT 'browser_satya',
    truncated_text INTEGER NOT NULL DEFAULT 0,
    "scrapedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 11) Indexes matching model declarations and common lookups
CREATE INDEX IF NOT EXISTS idx_custom_agent_feed_agent_id
    ON custom_agent_feed_articles (agent_id);

CREATE INDEX IF NOT EXISTS idx_custom_youtube_videos_run_id
    ON custom_youtube_videos (run_id);

CREATE INDEX IF NOT EXISTS idx_custom_youtube_videos_channel_input
    ON custom_youtube_videos (channel_input);

CREATE INDEX IF NOT EXISTS idx_custom_youtube_videos_video_id
    ON custom_youtube_videos (video_id);

CREATE INDEX IF NOT EXISTS idx_custom_reddit_posts_run_id
    ON custom_reddit_posts (run_id);

CREATE INDEX IF NOT EXISTS idx_custom_reddit_posts_subreddit
    ON custom_reddit_posts (subreddit);

CREATE INDEX IF NOT EXISTS idx_custom_reddit_posts_mode
    ON custom_reddit_posts (mode);

CREATE INDEX IF NOT EXISTS idx_custom_reddit_posts_post_id
    ON custom_reddit_posts (post_id);

CREATE INDEX IF NOT EXISTS idx_browser_scrape_records_run_id
    ON browser_scrape_records (run_id);

CREATE INDEX IF NOT EXISTS idx_browser_scrape_records_requested_url
    ON browser_scrape_records (requested_url);

CREATE INDEX IF NOT EXISTS idx_browser_scrape_records_source
    ON browser_scrape_records (scrape_source);

COMMIT;
