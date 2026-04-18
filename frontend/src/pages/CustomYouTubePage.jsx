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
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Link to="/custom" className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Custom
          </Link>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6 border border-transparent dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Youtube className="h-6 w-6 text-red-600" />
              <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Custom YouTube Scraper</h1>
            </div>
            <p className="text-secondary-600 dark:text-gray-400 mb-4">
              Enter channel handles/URLs. Scraper fetches latest 5 videos per channel and generates a full blog-style summary.
            </p>

            <label className="block text-sm font-semibold text-secondary-800 dark:text-gray-200 mb-2">
              Channels (one per line or comma-separated)
            </label>
            <textarea
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-3 text-secondary-900 dark:text-white placeholder-secondary-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="@GoogleDevelopers\n@Fireship\nhttps://www.youtube.com/@OpenAI"
            />

            {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                onClick={handleStart}
                disabled={scraping}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold"
              >
                <Play className="h-4 w-4" />
                Start YouTube Scrape
              </button>

              <button
                onClick={handleStop}
                disabled={!scraping}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </div>

            <p className="mt-3 text-xs text-secondary-500 dark:text-gray-400">
              Each video card shows full summary text and a small source link at the end.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6 border border-transparent dark:border-gray-700">
            <div className="flex items-center gap-2 mb-4">
              <Filter className="h-4 w-4 text-primary-600 dark:text-primary-400" />
              <h2 className="text-lg font-semibold text-secondary-900 dark:text-white">History Filters</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-secondary-600 dark:text-gray-300 mb-1">Channel</label>
                <input
                  type="text"
                  value={channelFilter}
                  onChange={(e) => setChannelFilter(e.target.value)}
                  placeholder="OpenAI or @OpenAI"
                  className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-secondary-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary-600 dark:text-gray-300 mb-1">Topic Keyword</label>
                <input
                  type="text"
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  placeholder="AI chips, funding, policy..."
                  className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-secondary-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary-600 dark:text-gray-300 mb-1">Day</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-2.5 h-4 w-4 text-secondary-400" />
                  <input
                    type="date"
                    value={dayFilter}
                    onChange={(e) => setDayFilter(e.target.value)}
                    className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-2 text-sm text-secondary-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary-600 dark:text-gray-300 mb-1">Time Window</label>
                <div className="relative">
                  <Clock3 className="absolute left-3 top-2.5 h-4 w-4 text-secondary-400" />
                  <select
                    value={windowFilter}
                    onChange={(e) => setWindowFilter(e.target.value)}
                    disabled={!!dayFilter}
                    className="w-full rounded-lg border border-secondary-300 dark:border-gray-600 bg-white dark:bg-gray-700 pl-9 pr-3 py-2 text-sm text-secondary-900 dark:text-white disabled:opacity-60"
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
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-200"
              >
                Reset Filters
              </button>
              <span className="text-xs text-secondary-500 dark:text-gray-400">Tip: Set Day for exact date. Time Window auto-disables when Day is selected.</span>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6 border border-transparent dark:border-gray-700">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Run Output</h2>
            {log.length === 0 && (
              <p className="text-sm text-secondary-500 dark:text-gray-400">No run yet.</p>
            )}
            {log.length > 0 && (
              <div className="rounded-lg bg-secondary-100 dark:bg-gray-900 p-3 font-mono text-xs text-secondary-700 dark:text-gray-300 max-h-44 overflow-auto space-y-1">
                {log.map((line, idx) => (
                  <div key={`${line}-${idx}`}>{line}</div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-bold text-secondary-900 dark:text-white">YouTube History</h2>
            {loadingHistory && <span className="text-sm text-secondary-500 dark:text-gray-400">Loading...</span>}
          </div>

          {!loadingHistory && history.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-dashed border-secondary-300 dark:border-gray-700 p-10 text-center text-secondary-500 dark:text-gray-400">
              No videos saved yet. Run a scrape to populate history.
            </div>
          )}

          {history.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.map((video, idx) => (
                <article key={`${video.video_url}-${idx}`} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-transparent dark:border-gray-700 p-5 flex flex-col">
                  <h3 className="font-semibold text-secondary-900 dark:text-white line-clamp-2 mb-2">{video.title}</h3>
                  <p className="text-xs text-secondary-500 dark:text-gray-400 mb-2">
                    {video.channel_title || video.channel_input || 'Unknown channel'}
                  </p>

                  {video.summary && (
                    <p className="text-sm text-secondary-700 dark:text-gray-300 whitespace-pre-wrap mb-3">{video.summary}</p>
                  )}

                  {!video.summary && video.description ? (
                    <p className="text-sm text-secondary-700 dark:text-gray-300 whitespace-pre-wrap mb-3">{video.description}</p>
                  ) : null}

                  {video.published_at ? (
                    <p className="text-[11px] text-secondary-500 dark:text-gray-400 mb-2">published {formatPublished(video.published_at)}</p>
                  ) : null}

                  <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-xs font-semibold"
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
