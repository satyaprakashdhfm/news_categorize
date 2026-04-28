import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { customRedditApi } from '@/services/api';
import { ArrowLeft, CalendarDays, Clock3, Filter, Play, Square } from 'lucide-react';

function normalizeCommunities(text) {
  return (text || '')
    .split(/\r?\n|,/)
    .map((x) => x.trim().replace(/^r\//i, ''))
    .filter(Boolean);
}

export default function CustomRedditPage({ isDark, toggleDark }) {
  const [communitiesText, setCommunitiesText] = useState('MachineLearning\nOpenAI\nartificial');
  const [mode, setMode] = useState('top_today');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState([]);
  const [communityFilter, setCommunityFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [windowFilter, setWindowFilter] = useState('today');
  const abortRef = useRef(null);

  const communities = useMemo(() => normalizeCommunities(communitiesText), [communitiesText]);

  const addLog = (line) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 30));
  };

  const formatPublished = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const maybeDate = new Date(raw);
    if (!Number.isNaN(maybeDate.getTime())) {
      return maybeDate.toLocaleString();
    }
    return raw;
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const params = { limit: 200 };
      if (communityFilter.trim()) {
        params.community = communityFilter.trim();
      }
      if (topicFilter.trim()) {
        params.topic = topicFilter.trim();
      }
      if (modeFilter) {
        params.mode = modeFilter;
      }
      if (dayFilter) {
        params.day = dayFilter;
      } else if (windowFilter === 'today') {
        params.day = new Date().toISOString().slice(0, 10);
      } else if (windowFilter !== 'all') {
        params.hours_back = Number(windowFilter);
      }

      const data = await customRedditApi.getHistory(params);
      setHistory(data?.posts || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load Reddit history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [communityFilter, topicFilter, modeFilter, dayFilter, windowFilter]);

  const handleStart = async () => {
    if (!communities.length || scraping) {
      setError('Please provide at least one community.');
      return;
    }

    abortRef.current = new AbortController();

    try {
      setScraping(true);
      setError('');
      addLog(`START reddit scrape for ${communities.length} community(s) mode=${mode} limit=10`);

      const data = await customRedditApi.scrape(
        {
          communities,
          mode,
          posts_per_community: 5,
          summarize: true,
        },
        { signal: abortRef.current.signal }
      );

      addLog(`DONE run=${data?.run_id || 'n/a'} total_posts=${data?.total_posts || 0}`);
      await loadHistory();
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        addLog('STOP requested by user');
        setError('Reddit scrape stopped.');
      } else {
        console.error(err);
        setError('Failed to scrape Reddit communities.');
        addLog('ERROR during Reddit scrape');
      }
    } finally {
      setScraping(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Link to="/custom" className="back mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Custom
          </Link>

          <div className="panel mb-6">
            <h1 style={{ fontSize: 'var(--t-h1)', fontWeight: 700, color: 'var(--fg-1)', margin: '0 0 8px' }}>Custom Reddit Scraper</h1>
            <p style={{ color: 'var(--fg-2)', marginBottom: 16 }}>
              Input communities. Fetch top today / hot / new with latest 5 posts each and full blog-style summaries.
            </p>

            <div className="field mb-3">
              <label className="field__label">
                Communities (one per line or comma-separated)
              </label>
              <textarea
                value={communitiesText}
                onChange={(e) => setCommunitiesText(e.target.value)}
                rows={4}
                className="field__ta"
                placeholder="MachineLearning&#10;OpenAI&#10;technology"
              />
            </div>

            <div className="field mb-3">
              <label className="field__label">Mode</label>
              <div className="field__input" style={{ width: 'fit-content' }}>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--fg-1)', fontFamily: 'var(--font-sans)', fontSize: 'var(--t-body)' }}
                >
                  <option value="top_today">Top Today</option>
                  <option value="hot">Hot</option>
                  <option value="new">Most Recent</option>
                </select>
              </div>
            </div>

            {error && <p style={{ marginTop: 8, fontSize: 'var(--t-meta)', color: 'var(--signal-critical)' }}>{error}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleStart}
                disabled={scraping}
                className="btn btn--primary"
              >
                <Play className="h-4 w-4" />
                Start Reddit Scrape
              </button>

              <button
                onClick={handleStop}
                disabled={!scraping}
                className="btn"
                style={!scraping ? { opacity: 0.5 } : { borderColor: 'var(--signal-critical)', color: 'var(--signal-critical)' }}
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </div>

            <p className="meta" style={{ marginTop: 12 }}>
              Full summary cards include context, key points, and a small source link at the end.
            </p>
          </div>

          <div className="panel mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>History Filters</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
              <div className="field">
                <label className="field__label">Community</label>
                <div className="field__input">
                  <input
                    type="text"
                    value={communityFilter}
                    onChange={(e) => setCommunityFilter(e.target.value)}
                    placeholder="MachineLearning"
                  />
                </div>
              </div>

              <div className="field">
                <label className="field__label">Topic Keyword</label>
                <div className="field__input">
                  <input
                    type="text"
                    value={topicFilter}
                    onChange={(e) => setTopicFilter(e.target.value)}
                    placeholder="agentic AI, startup funding..."
                  />
                </div>
              </div>

              <div className="field">
                <label className="field__label">Mode</label>
                <div className="field__input">
                  <select
                    value={modeFilter}
                    onChange={(e) => setModeFilter(e.target.value)}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--fg-1)', fontFamily: 'var(--font-sans)', fontSize: 'var(--t-body)' }}
                  >
                    <option value="">All</option>
                    <option value="top_today">Top Today</option>
                    <option value="hot">Hot</option>
                    <option value="new">Most Recent</option>
                  </select>
                </div>
              </div>

              <div className="field">
                <label className="field__label">Day</label>
                <div className="field__input">
                  <CalendarDays className="h-4 w-4" style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
                  <input
                    type="date"
                    value={dayFilter}
                    onChange={(e) => setDayFilter(e.target.value)}
                  />
                </div>
              </div>

              <div className="field">
                <label className="field__label">Time Window</label>
                <div className="field__input">
                  <Clock3 className="h-4 w-4" style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
                  <select
                    value={windowFilter}
                    onChange={(e) => setWindowFilter(e.target.value)}
                    disabled={!!dayFilter}
                    style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--fg-1)', fontFamily: 'var(--font-sans)', fontSize: 'var(--t-body)' }}
                  >
                    <option value="today">Today</option>
                    <option value="2">Last 2 hours</option>
                    <option value="5">Last 5 hours</option>
                    <option value="6">Last 6 hours</option>
                    <option value="10">Last 10 hours</option>
                    <option value="12">Last 12 hours</option>
                    <option value="20">Last 20 hours</option>
                    <option value="24">Last 24 hours</option>
                    <option value="48">Last 48 hours</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => {
                  setCommunityFilter('');
                  setTopicFilter('');
                  setModeFilter('');
                  setDayFilter('');
                  setWindowFilter('today');
                }}
                className="btn"
                style={{ fontSize: 'var(--t-meta)' }}
              >
                Reset Filters
              </button>
              <span className="meta">Tip: Day overrides time window for exact date filtering.</span>
            </div>
          </div>

          <div className="panel mb-6">
            <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--fg-1)', margin: '0 0 12px' }}>Run Output</h2>
            {log.length === 0 && (
              <p className="meta">No run yet.</p>
            )}
            {log.length > 0 && (
              <div className="mono" style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: 12, fontSize: 'var(--t-meta)', color: 'var(--fg-2)', maxHeight: 176, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {log.map((line, idx) => (
                  <div key={`${line}-${idx}`}>{line}</div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)' }}>Reddit History</h2>
            {loadingHistory && <span className="meta">Loading...</span>}
          </div>

          {!loadingHistory && history.length === 0 && (
            <div className="empty" style={{ background: 'var(--bg-1)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-lg)' }}>
              <p className="empty__text">No posts saved yet. Run a scrape to populate history.</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((post, idx) => (
                <article key={`${post.post_url}-${idx}`} className="card" style={{ cursor: 'default' }}>
                  <h3 style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--fg-1)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.title}</h3>
                  <p className="meta" style={{ margin: 0 }}>
                    r/{post.subreddit}
                  </p>

                  {post.summary && (
                    <p style={{ fontSize: 'var(--t-body)', color: 'var(--fg-2)', whiteSpace: 'pre-wrap', margin: 0 }}>{post.summary}</p>
                  )}

                  {!post.summary && post.selftext ? (
                    <p style={{ fontSize: 'var(--t-body)', color: 'var(--fg-2)', whiteSpace: 'pre-wrap', margin: 0 }}>{post.selftext}</p>
                  ) : null}

                  {post.published_at ? (
                    <p className="meta" style={{ margin: 0 }}>published {formatPublished(post.published_at)}</p>
                  ) : null}

                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginTop: 'auto', color: 'var(--accent)', fontSize: 'var(--t-meta)', fontWeight: 600, textDecoration: 'none' }}
                  >
                    Source link
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
