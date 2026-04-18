import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import { browserResearchApi } from '@/services/api';

const SUMMARY_PREVIEW_CHARS = 240;

function compact(text, n = SUMMARY_PREVIEW_CHARS) {
  const value = String(text || '').trim();
  if (value.length <= n) {
    return { text: value, truncated: false };
  }
  return { text: `${value.slice(0, n)}...`, truncated: true };
}

function splitChannels(raw) {
  return String(raw || '')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function fmtInt(value) {
  return Number(value || 0).toLocaleString();
}

function fmtUsd(value) {
  return `$${Number(value || 0).toFixed(6)}`;
}

export default function BrowserResearchMainPage({ isDark, toggleDark }) {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('US AI startup funding and open source models');
  const [channelsText, setChannelsText] = useState('@OpenAI\n@GoogleDeepMind');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [autoRunKey, setAutoRunKey] = useState('');
  const [processingLog, setProcessingLog] = useState([]);
  const [streamPhase, setStreamPhase] = useState('idle'); // 'idle' | 'streaming' | 'done' | 'error'
  const [liveScreenshot, setLiveScreenshot] = useState(null);
  const [currentUrl, setCurrentUrl] = useState('');

  const blogs = useMemo(() => {
    const items = data?.blogs || [];
    if (sourceFilter === 'all') {
      return items;
    }
    return items.filter((b) => b.source === sourceFilter);
  }, [data, sourceFilter]);

  const toggleExpand = (key) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await browserResearchApi.getHistory({ limit: 20 });
      setHistory(res?.runs || []);
    } catch (err) {
      setHistoryError(err?.response?.data?.detail || err.message || 'Failed to load run history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openRun = async (runId) => {
    setLoading(true);
    setError('');
    try {
      const res = await browserResearchApi.getRun(runId);
      setData(res);
      setQuery(res?.query || query);
      setExpanded({});
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to open run');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    const q = String(searchParams.get('q') || '').trim();
    const shouldAutoRun = String(searchParams.get('autorun') || '') === '1';
    if (!q) {
      return;
    }

    setQuery(q);

    if (shouldAutoRun && autoRunKey !== q && !loading) {
      setAutoRunKey(q);
      runResearch(q);
    }
  }, [searchParams]);

  const runResearch = async (queryOverride) => {
    const effectiveQuery = String(queryOverride || query || '').trim();
    if (effectiveQuery.length < 3) {
      setError('Query must be at least 3 characters');
      return;
    }

    setLoading(true);
    setError('');
    setProcessingLog([]);
    setStreamPhase('streaming');
    setData(null);
    setLiveScreenshot(null);
    setCurrentUrl('');

    const ts = () => new Date().toLocaleTimeString();

    try {
      const response = await fetch('/api/browser-research/live-browser-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: effectiveQuery, hint_channels: [] }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let parsed;
          try { parsed = JSON.parse(line.slice(6)); } catch { continue; }

          if (parsed.type === 'screenshot') {
            setLiveScreenshot(parsed.payload);
          } else if (parsed.type === 'url') {
            setCurrentUrl(parsed.payload);
          } else if (parsed.type === 'step') {
            setProcessingLog((prev) => [`${ts()} ${parsed.payload}`, ...prev].slice(0, 60));
          } else if (parsed.type === 'result') {
            const res = parsed.payload;
            setData(res);
            setQuery(res?.query || effectiveQuery);
            setExpanded({});
            setStreamPhase('done');
            setHistory((prev) => [
              { run_id: res.run_id, query: res.query, total_blogs: res.total_blogs, generated_at: res.generated_at, llm_usage: res.llm_usage },
              ...prev.filter((x) => x.run_id !== res.run_id),
            ].slice(0, 20));
          } else if (parsed.type === 'error') {
            setError(parsed.payload || 'Research failed');
            setStreamPhase('error');
          }
        }
      }
    } catch (err) {
      setError(err.message || 'Research run failed');
      setStreamPhase('error');
    } finally {
      setLoading(false);
    }
  };

  const run = async (e) => {
    e.preventDefault();
    await runResearch();
  };

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-transparent dark:border-gray-700">
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Browser Research (Primary)</h1>
          <p className="text-sm text-secondary-600 dark:text-gray-300 mt-2">
            Main browser-based flow. Old custom YouTube and custom Reddit pages remain available as backup.
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-300 mt-2">
            Relevance filtering disabled: all collected items are kept as cards.
          </p>
        </section>

        <form onSubmit={run} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-transparent dark:border-gray-700 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-gray-300 mb-2">Research Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              minLength={3}
              required
              placeholder="e.g. what's happening with China AI policy"
              className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-secondary-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-lg font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60"
          >
            {loading ? 'Browsing the web...' : 'Run Live Browser Research'}
          </button>

          <p className="text-xs text-secondary-500 dark:text-gray-400">
            Browser will dynamically discover Reddit communities, search YouTube, and scrape Google News for your query. 2 LLM calls total.
          </p>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </form>

        {(loading || liveScreenshot) ? (
          <section className="bg-gray-950 rounded-xl shadow-xl border border-gray-800 overflow-hidden">
            {/* Browser chrome bar */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900 border-b border-gray-800">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
                <span className="w-3 h-3 rounded-full bg-yellow-400 opacity-80" />
                <span className="w-3 h-3 rounded-full bg-green-500 opacity-80" />
              </div>
              <div className="flex-1 mx-3 px-3 py-1 rounded-md bg-gray-800 text-xs text-gray-400 font-mono truncate flex items-center gap-2">
                {loading && <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />}
                {currentUrl || 'about:blank'}
              </div>
              <span className="text-xs text-gray-500 font-semibold">
                {loading ? 'Browsing...' : 'Done'}
              </span>
            </div>
            {/* Viewport */}
            <div className="relative bg-gray-900 min-h-[200px] sm:min-h-[320px] md:min-h-[400px]">
              {liveScreenshot ? (
                <img
                  src={`data:image/jpeg;base64,${liveScreenshot}`}
                  alt="Live browser view"
                  className="w-full block"
                  style={{ imageRendering: 'auto' }}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-40 sm:h-56 md:h-64 gap-3 text-gray-500">
                  <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm">Launching browser...</span>
                </div>
              )}
              {loading && liveScreenshot && (
                <div className="absolute bottom-3 right-3 flex items-center gap-2 bg-black/60 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  LIVE
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">Live Browser Research Feed</h2>
            <span className={`text-xs font-semibold px-2 py-1 rounded ${
              streamPhase === 'streaming' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' :
              streamPhase === 'done' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' :
              streamPhase === 'error' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
              'bg-secondary-100 text-secondary-500 dark:bg-gray-700 dark:text-gray-400'
            }`}>
              {streamPhase === 'streaming' ? '⬤ Streaming live...' :
               streamPhase === 'done' ? '✓ Complete' :
               streamPhase === 'error' ? '✗ Error' : 'Idle'}
            </span>
          </div>

          {processingLog.length === 0 ? (
            <p className="text-sm text-secondary-600 dark:text-gray-300">No run yet. Start browser research to see the live step-by-step feed.</p>
          ) : (
            <div className="rounded-lg bg-gray-950 dark:bg-gray-950 border border-gray-800 p-3 sm:p-4 font-mono text-xs max-h-48 sm:max-h-72 overflow-auto space-y-1">
              {streamPhase === 'streaming' && (
                <div className="flex items-center gap-2 text-amber-400 mb-2">
                  <span className="animate-pulse">▶</span>
                  <span>Research in progress — streaming live steps below</span>
                </div>
              )}
              {processingLog.map((line, idx) => {
                const isArrow = line.includes('  →');
                const isError = line.toLowerCase().includes('error');
                const isDone = line.toLowerCase().includes('done') || line.toLowerCase().includes('complete');
                return (
                  <div
                    key={`${line}-${idx}`}
                    className={`leading-relaxed ${
                      isError ? 'text-red-400' :
                      isDone ? 'text-emerald-400' :
                      isArrow ? 'text-gray-400 pl-4' :
                      'text-green-300'
                    }`}
                  >
                    {isArrow ? '' : '› '}{line}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">Run History</h2>
            <button
              onClick={loadHistory}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-200"
            >
              Refresh
            </button>
          </div>
          {historyError ? <p className="text-sm text-red-600 dark:text-red-400 mb-3">{historyError}</p> : null}
          {historyLoading ? <p className="text-sm text-secondary-600 dark:text-gray-300">Loading history...</p> : null}
          {!historyLoading && !history.length ? <p className="text-sm text-secondary-600 dark:text-gray-300">No runs yet. Run once and it will be saved here.</p> : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {history.map((h) => (
              <button
                key={h.run_id}
                onClick={() => openRun(h.run_id)}
                className="text-left rounded-lg border border-secondary-200 dark:border-gray-700 p-4 hover:border-primary-400 dark:hover:border-primary-500"
              >
                <p className="text-xs text-secondary-500 dark:text-gray-400">{new Date(h.generated_at).toLocaleString()}</p>
                <p className="mt-1 text-sm font-semibold text-secondary-900 dark:text-white">{h.query}</p>
                <p className="mt-2 text-xs text-secondary-600 dark:text-gray-300">{h.total_blogs} items</p>
                {h.llm_usage ? (
                  <p className="mt-1 text-xs text-secondary-600 dark:text-gray-300">
                    {fmtInt(h.llm_usage.total_tokens)} tokens • {fmtUsd(h.llm_usage.estimated_cost_usd)}
                  </p>
                ) : null}
              </button>
            ))}
          </div>
        </section>

        {data ? (
          <section className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-transparent dark:border-gray-700">
              <p className="text-sm text-secondary-700 dark:text-gray-300">Total blogs: <span className="font-semibold">{data.total_blogs}</span></p>
              <p className="text-sm text-secondary-700 dark:text-gray-300 mt-1">Reddit communities: {data.selected_reddit_communities.join(', ')}</p>
              <p className="text-sm text-secondary-700 dark:text-gray-300 mt-1">YouTube channels: {data.youtube_channels_used.join(', ')}</p>
              {data.llm_usage ? (
                <p className="text-sm text-secondary-700 dark:text-gray-300 mt-1">
                  LLM usage this run: {fmtInt(data.llm_usage.total_tokens)} tokens, estimated {fmtUsd(data.llm_usage.estimated_cost_usd)}
                </p>
              ) : null}
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border border-transparent dark:border-gray-700 flex flex-wrap gap-2">
              {['all', 'reddit', 'youtube', 'news'].map((f) => (
                <button
                  key={f}
                  onClick={() => setSourceFilter(f)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold uppercase ${sourceFilter === f ? 'bg-primary-600 text-white' : 'bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-200'}`}
                >
                  {f}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {blogs.map((b, idx) => {
                const key = `${b.source}-${idx}-${b.url}`;
                const isExpanded = !!expanded[key];
                const summary = compact(b.summary || '');
                const shownSummary = isExpanded ? (b.summary || '') : summary.text;

                return (
                <article key={key} className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 border border-transparent dark:border-gray-700 h-full flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 rounded text-xs font-bold uppercase bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200">{b.source}</span>
                    {b.community ? <span className="text-xs text-secondary-500 dark:text-gray-400">r/{b.community}</span> : null}
                    {b.channel ? <span className="text-xs text-secondary-500 dark:text-gray-400">{b.channel}</span> : null}
                  </div>
                  <h3 className="text-base font-semibold text-secondary-900 dark:text-white leading-snug">{b.title}</h3>
                  <p className="mt-2 text-sm text-secondary-700 dark:text-gray-300 whitespace-pre-wrap">{shownSummary}</p>
                  {summary.truncated ? (
                    <button
                      onClick={() => toggleExpand(key)}
                      className="mt-2 self-start text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline"
                    >
                      {isExpanded ? 'Show less' : 'Read more'}
                    </button>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-secondary-500 dark:text-gray-400">
                    {typeof b.relevance_score === 'number' ? <span>match: {Math.round((b.relevance_score || 0) * 100)}%</span> : null}
                    {typeof b.score === 'number' ? <span>upvotes: {b.score}</span> : null}
                    {typeof b.comments === 'number' ? <span>comments: {b.comments}</span> : null}
                  </div>
                  {b.url ? (
                    <a href={b.url} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline">
                      Open source
                    </a>
                  ) : null}
                </article>
              )})}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
