import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import NewsCard from '@/components/NewsCard';
import { customAgentsApi } from '@/services/api';
import { extractKeywords } from '@/utils/customAgents';
import { ArrowLeft, Sparkles, Play, Square } from 'lucide-react';

export default function CustomFeedPage({ isDark, toggleDark }) {
  const { agentId } = useParams();
  const [agent, setAgent] = useState(null);
  const [articles, setArticles] = useState([]);
  const [agentLoading, setAgentLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchMeta, setSearchMeta] = useState(null);
  const [searchLog, setSearchLog] = useState([]);
  const abortRef = useRef(null);

  useEffect(() => {
    const loadAgent = async () => {
      try {
        setAgentLoading(true);
        const found = await customAgentsApi.getAgent(agentId);
        setAgent(found);
      } catch (err) {
        console.error(err);
        setAgent(null);
      } finally {
        setAgentLoading(false);
      }
    };

    loadAgent();
  }, [agentId]);

  const keywords = useMemo(() => extractKeywords(agent?.prompt || ''), [agent?.prompt]);

  const addLog = (line) => {
    setSearchLog((prev) => [
      `${new Date().toLocaleTimeString()} ${line}`,
      ...prev,
    ].slice(0, 20));
  };

  const runSearch = async () => {
    if (!agent || searchLoading) return;

    abortRef.current = new AbortController();

    try {
      setSearchLoading(true);
      setError('');
      setSearchMeta(null);
      addLog('START custom prompt search (limit=5)');

      const data = await customAgentsApi.searchAgent(
        agent.id,
        {
          limit: 5,
        },
        { signal: abortRef.current.signal }
      );

      const ranked = (data?.articles || []).map((article, index) => ({
        id: article.url || `${agent.id}-${index}`,
        title: article.title,
        summary: article.summary,
        content: article.content,
        image_url: article.image_url,
        source_url: article.url,
        published_at: article.published_at || new Date().toISOString(),
        country: data?.country || 'USA',
        category: 'TEC',
      }));

      setArticles((prev) => {
        const merged = [...ranked, ...prev];
        const seen = new Set();
        return merged.filter((item) => {
          const key = item.source_url || item.id;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
      });
      setSearchMeta({
        totalFound: data?.total_found || ranked.length,
        limit: data?.limit || 5,
        country: data?.country || 'USA',
        date: data?.date || new Date().toISOString().slice(0, 10),
      });
      addLog(`DONE fetched ${ranked.length} new articles`);
    } catch (err) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED') {
        addLog('STOP requested by user');
        setError('Search stopped.');
      } else {
        console.error(err);
        setError('Failed to load custom feed.');
        addLog('ERROR while fetching custom feed');
      }
    } finally {
      setSearchLoading(false);
      abortRef.current = null;
    }
  };

  const stopSearch = () => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
  };

  useEffect(() => {
    const loadLatestFeed = async () => {
      if (!agent) return;
      try {
        setError('');
        const data = await customAgentsApi.getLatestFeed(agent.id);
        const saved = (data?.articles || []).map((article, index) => ({
          id: article.url || `${agent.id}-saved-${index}`,
          title: article.title,
          summary: article.summary,
          content: article.content,
          image_url: article.image_url,
          source_url: article.url,
          published_at: article.published_at || new Date().toISOString(),
          country: data?.country || 'USA',
          category: 'TEC',
        }));

        if (saved.length) {
          setArticles(saved);
          setSearchMeta({
            totalFound: data?.total_found || saved.length,
            limit: data?.limit || saved.length,
            country: data?.country || 'USA',
            date: data?.date || new Date().toISOString().slice(0, 10),
          });
          addLog(`LOADED history feed (${saved.length})`);
        }
      } catch (err) {
        console.error(err);
      }
    };

    loadLatestFeed();
  }, [agent]);

  if (agentLoading) {
    return (
      <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
        <Header isDark={isDark} toggleDark={toggleDark} />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl p-8 border border-transparent dark:border-gray-700 text-center text-secondary-600 dark:text-gray-400">
            Loading custom feed...
          </div>
        </main>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
        <Header isDark={isDark} toggleDark={toggleDark} />
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl p-8 border border-transparent dark:border-gray-700">
            <p className="text-secondary-700 dark:text-gray-300 mb-4">Custom card not found.</p>
            <Link to="/custom" className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium">
              <ArrowLeft className="h-4 w-4" />
              Back to Custom Cards
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Link to="/custom" className="inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Custom Cards
          </Link>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6 border border-transparent dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">{agent.title}</h1>
            </div>
            <p className="text-secondary-700 dark:text-gray-300 mb-4">{agent.prompt}</p>
            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span key={k} className="px-2 py-1 rounded-md text-xs bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                  {k}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={runSearch}
                disabled={searchLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold"
              >
                <Play className="h-4 w-4" />
                Start Search
              </button>

              <button
                onClick={stopSearch}
                disabled={!searchLoading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-semibold"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 mb-6 border border-transparent dark:border-gray-700">
            <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Search Output</h2>

            {searchMeta && (
              <p className="text-sm text-secondary-600 dark:text-gray-300 mb-3">
                country={searchMeta.country} date={searchMeta.date} limit={searchMeta.limit} total_found={searchMeta.totalFound}
              </p>
            )}

            {searchLog.length === 0 && (
              <p className="text-sm text-secondary-500 dark:text-gray-400">No search yet. Click Start Search.</p>
            )}

            {searchLog.length > 0 && (
              <div className="rounded-lg bg-secondary-100 dark:bg-gray-900 p-3 font-mono text-xs text-secondary-700 dark:text-gray-300 max-h-44 overflow-auto space-y-1">
                {searchLog.map((line, idx) => (
                  <div key={`${line}-${idx}`}>{line}</div>
                ))}
              </div>
            )}
          </div>

          {searchLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {!searchLoading && !error && articles.length === 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-secondary-600 dark:text-gray-400 border border-transparent dark:border-gray-700">
              No articles matched this prompt yet. Try a broader custom prompt.
            </div>
          )}

          {!searchLoading && !error && articles.length > 0 && (
            <>
              <p className="text-sm text-secondary-500 dark:text-gray-400 mb-4">
                Showing {articles.length} accumulated custom feed articles.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
