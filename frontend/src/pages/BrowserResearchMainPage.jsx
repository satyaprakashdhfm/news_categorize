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
    setLoading(true);
    setError('');

    try {
      const channels = splitChannels(channelsText);
      if (!channels.length) {
        throw new Error('Please add at least one YouTube channel');
      }

      const effectiveQuery = String(queryOverride || query || '').trim();
      const res = await browserResearchApi.run({
        query: effectiveQuery,
        youtube_channels: channels,
        youtube_videos_per_channel: 5,
        reddit_communities_limit: 10,
        reddit_posts_per_community: 10,
        news_count: 8,
        relevance_threshold: 0.5,
      });
      setData(res);
      setQuery(res?.query || effectiveQuery);
      setExpanded({});
      setHistory((prev) => [
        {
          run_id: res.run_id,
          query: res.query,
          total_blogs: res.total_blogs,
          generated_at: res.generated_at,
        },
        ...prev.filter((x) => x.run_id !== res.run_id),
      ].slice(0, 20));
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Research run failed');
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
            Relevance mode enabled: only items with 50%+ topic relevance are kept as cards.
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
              className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-secondary-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-gray-300 mb-2">YouTube Channels (required, one per line)</label>
            <textarea
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-secondary-900 dark:text-white"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-lg font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60"
          >
            {loading ? 'Running...' : 'Run Browser Research'}
          </button>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </form>

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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {history.map((h) => (
              <button
                key={h.run_id}
                onClick={() => openRun(h.run_id)}
                className="text-left rounded-lg border border-secondary-200 dark:border-gray-700 p-4 hover:border-primary-400 dark:hover:border-primary-500"
              >
                <p className="text-xs text-secondary-500 dark:text-gray-400">{new Date(h.generated_at).toLocaleString()}</p>
                <p className="mt-1 text-sm font-semibold text-secondary-900 dark:text-white">{h.query}</p>
                <p className="mt-2 text-xs text-secondary-600 dark:text-gray-300">{h.total_blogs} items</p>
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

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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
