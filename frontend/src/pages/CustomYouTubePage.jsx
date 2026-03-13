import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import { customYoutubeApi } from '@/services/api';
import { ArrowLeft, Play, Square, Youtube } from 'lucide-react';

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
  const abortRef = useRef(null);

  const channels = useMemo(() => normalizeChannels(channelsText), [channelsText]);

  const addLog = (line) => {
    setLog((prev) => [`${new Date().toLocaleTimeString()} ${line}`, ...prev].slice(0, 30));
  };

  const loadHistory = async () => {
    try {
      setLoadingHistory(true);
      const data = await customYoutubeApi.getHistory({ limit: 200 });
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
  }, []);

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
          videos_per_channel: 10,
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
              Enter channel handles/URLs. Scraper fetches latest 10 videos per channel with summaries.
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
                <article key={`${video.video_url}-${idx}`} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-md border border-transparent dark:border-gray-700 p-5">
                  <h3 className="font-semibold text-secondary-900 dark:text-white line-clamp-2 mb-2">{video.title}</h3>
                  <p className="text-xs text-secondary-500 dark:text-gray-400 mb-2">
                    {video.channel_title || 'Unknown channel'}
                    {video.published_at ? ` | ${video.published_at}` : ''}
                  </p>
                  {video.summary && (
                    <p className="text-sm text-secondary-600 dark:text-gray-400 line-clamp-4 mb-3">{video.summary}</p>
                  )}
                  <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-300 text-sm font-medium"
                  >
                    Open video
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
