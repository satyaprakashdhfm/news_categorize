import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { customYoutubeApi } from '@/services/api';
import { ArrowLeft, CalendarDays, Clock3, Filter, Play, Square, Youtube } from 'lucide-react';

function normalizeChannels(text) {
  return (text || '')
    .split(/\r?\n|,/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function CustomYouTubePage({ isDark, toggleDark }) {
  const [channelsText, setChannelsText] = useState('@GoogleDevelopers');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState([]);
  const [channelFilter, setChannelFilter] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [dayFilter, setDayFilter] = useState('');
  const [windowFilter, setWindowFilter] = useState('today');
  const abortRef = useRef(null);

  const channels = useMemo(() => normalizeChannels(channelsText), [channelsText]);

  const addLog = (line) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 30));
  };

  const formatPublished = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^\d{8}$/.test(raw)) {
      return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    }
    return raw;
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const params = { limit: 200 };
      if (channelFilter.trim()) {
        params.channel = channelFilter.trim();
      }
      if (topicFilter.trim()) {
        params.topic = topicFilter.trim();
      }
      if (dayFilter) {
        params.day = dayFilter;
      } else if (windowFilter === 'today') {
        params.day = new Date().toISOString().slice(0, 10);
      } else if (windowFilter !== 'all') {
        params.hours_back = Number(windowFilter);
      }

      const data = await customYoutubeApi.getHistory(params);
      setHistory(data?.videos || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load YouTube history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [channelFilter, topicFilter, dayFilter, windowFilter]);

  const handleStart = async () => {
    if (!channels.length || scraping) {
      setError('Please provide at least one channel.');
      return;
    }

    abortRef.current = new AbortController();

    try {
      setScraping(true);
      setError('');
      addLog(`START scrape for ${channels.length} channel(s), latest 10 each`);

      const data = await customYoutubeApi.scrape(
        {
          channels,
          videos_per_channel: 5,
          summarize: true,
        },
        { signal: abortRef.current.signal }
      );

      addLog(`DONE run=${data?.run_id || 'n/a'} total_videos=${data?.total_videos || 0}`);
      await loadHistory();
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        addLog('STOP requested by user');
        setError('YouTube scrape stopped.');
      } else {
        console.error(err);
        setError('Failed to scrape YouTube channels.');
        addLog('ERROR during YouTube scrape');
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
            <div className="flex items-center gap-2 mb-2">
              <Youtube className="h-6 w-6" style={{ color: 'var(--signal-critical)' }} />
              <h1 style={{ fontSize: 'var(--t-h1)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Custom YouTube Scraper</h1>
            </div>
            <p style={{ color: 'var(--fg-2)', marginBottom: 16 }}>
              Enter channel handles/URLs. Scraper fetches latest 5 videos per channel and generates a full blog-style summary.
            </p>

            <div className="field mb-2">
              <label className="field__label">
                Channels (one per line or comma-separated)
              </label>
              <textarea
                value={channelsText}
                onChange={(e) => setChannelsText(e.target.value)}
                rows={4}
                className="field__ta"
                placeholder="@GoogleDevelopers&#10;@Fireship&#10;https://www.youtube.com/@OpenAI"
              />
            </div>

            {error && <p style={{ marginTop: 8, fontSize: 'var(--t-meta)', color: 'var(--signal-critical)' }}>{error}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleStart}
                disabled={scraping}
                className="btn btn--primary"
              >
                <Play className="h-4 w-4" />
                Start YouTube Scrape
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
              Each video card shows full summary text and a small source link at the end.
            </p>
          </div>

          <div className="panel mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4" style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>History Filters</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="field">
                <label className="field__label">Channel</label>
                <div className="field__input">
                  <input
                    type="text"
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    placeholder="OpenAI or @OpenAI"
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
                    placeholder="AI chips, funding, policy..."
                  />
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
                    <option value="5">Last 5 hours</option>
                    <option value="10">Last 10 hours</option>
                    <option value="20">Last 20 hours</option>
                    <option value="all">All time</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3">
              <button
                onClick={() => {
                  setChannelFilter('');
                  setTopicFilter('');
                  setDayFilter('');
                  setWindowFilter('today');
                }}
                className="btn"
                style={{ fontSize: 'var(--t-meta)' }}
              >
                Reset Filters
              </button>
              <span className="meta">Tip: Set Day for exact date. Time Window auto-disables when Day is selected.</span>
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
            <h2 style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)' }}>YouTube History</h2>
            {loadingHistory && <span className="meta">Loading...</span>}
          </div>

          {!loadingHistory && history.length === 0 && (
            <div className="empty" style={{ background: 'var(--bg-1)', border: '1px dashed var(--line-2)', borderRadius: 'var(--r-lg)' }}>
              <p className="empty__text">No videos saved yet. Run a scrape to populate history.</p>
            </div>
          )}

          {history.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((video, idx) => (
                <article key={`${video.video_url}-${idx}`} className="card" style={{ cursor: 'default' }}>
                  <h3 style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--fg-1)', margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{video.title}</h3>
                  <p className="meta" style={{ margin: 0 }}>
                    {video.channel_title || video.channel_input || 'Unknown channel'}
                  </p>

                  {video.summary && (
                    <p style={{ fontSize: 'var(--t-body)', color: 'var(--fg-2)', whiteSpace: 'pre-wrap', margin: 0 }}>{video.summary}</p>
                  )}

                  {!video.summary && video.description ? (
                    <p style={{ fontSize: 'var(--t-body)', color: 'var(--fg-2)', whiteSpace: 'pre-wrap', margin: 0 }}>{video.description}</p>
                  ) : null}

                  {video.published_at ? (
                    <p className="meta" style={{ margin: 0 }}>published {formatPublished(video.published_at)}</p>
                  ) : null}

                  <a
                    href={video.video_url}
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
