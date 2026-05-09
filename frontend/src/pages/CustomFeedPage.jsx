import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import NewsCard from '@/components/NewsCard';
import { customAgentsApi } from '@/services/api';
import { extractKeywords } from '@/utils/customAgents';
import { ArrowLeft, Sparkles, Play, Square } from 'lucide-react';

export default function CustomFeedPage({ isDark, toggleDark }) {
  const { agentId } = useParams();
  const navigate = useNavigate();
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
        const prompt = String(found?.prompt || '').trim();
        if (prompt) {
          navigate(`/custom/browser?q=${encodeURIComponent(prompt)}`);
        }
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
        category: null,
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
          category: null,
        }));

        if (saved.length) {
          setArticles(saved);
          setSearchMeta({
            totalFound: data?.total_found || saved.length,
            limit: data?.limit || saved.length,
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
      <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
        <Header isDark={isDark} toggleDark={toggleDark} />
        <main className="container mx-auto px-4 py-8">
          <div className="panel" style={{ maxWidth: 768, margin: '0 auto', textAlign: 'center', color: 'var(--fg-2)' }}>
            Loading custom feed...
          </div>
        </main>
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
        <Header isDark={isDark} toggleDark={toggleDark} />
        <main className="container mx-auto px-4 py-8">
          <div className="panel" style={{ maxWidth: 768, margin: '0 auto' }}>
            <p style={{ color: 'var(--fg-2)', marginBottom: 16 }}>Custom card not found.</p>
            <Link to="/custom" className="back">
              <ArrowLeft className="h-4 w-4" />
              Back to Custom Cards
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <Link to="/custom" className="back mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Custom Cards
          </Link>

          <div className="panel mb-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5" style={{ color: 'var(--accent)' }} />
              <h1 style={{ fontSize: 'var(--t-h1)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>{agent.title}</h1>
            </div>
            <p style={{ color: 'var(--fg-2)', marginBottom: 16 }}>{agent.prompt}</p>
            <div className="flex flex-wrap gap-2">
              {keywords.map((k) => (
                <span key={k} className="badge badge--info">
                  {k}
                </span>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                onClick={runSearch}
                disabled={searchLoading}
                className="btn btn--primary"
              >
                <Play className="h-4 w-4" />
                Start Search
              </button>

              <button
                onClick={stopSearch}
                disabled={!searchLoading}
                className="btn"
                style={!searchLoading ? { opacity: 0.5 } : { borderColor: 'var(--signal-critical)', color: 'var(--signal-critical)' }}
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </div>
          </div>

          <div className="panel mb-6">
            <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 600, color: 'var(--fg-1)', margin: '0 0 12px' }}>Search Output</h2>

            {searchMeta && (
              <p style={{ fontSize: 'var(--t-meta)', color: 'var(--fg-2)', marginBottom: 12 }}>
                date={searchMeta.date} limit={searchMeta.limit} total_found={searchMeta.totalFound}
              </p>
            )}

            {searchLog.length === 0 && (
              <p className="meta">No search yet. Click Start Search.</p>
            )}

            {searchLog.length > 0 && (
              <div className="mono" style={{ background: 'var(--bg-2)', borderRadius: 'var(--r-md)', padding: 12, fontSize: 'var(--t-meta)', color: 'var(--fg-2)', maxHeight: 176, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {searchLog.map((line, idx) => (
                  <div key={`${line}-${idx}`}>{line}</div>
                ))}
              </div>
            )}
          </div>

          {searchLoading && (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12" style={{ borderBottom: '2px solid var(--accent)' }} />
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(240,110,110,0.08)', border: '1px solid rgba(240,110,110,0.25)', color: 'var(--signal-critical)', padding: '12px 16px', borderRadius: 'var(--r-md)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          {!searchLoading && !error && articles.length === 0 && (
            <div className="empty" style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-lg)' }}>
              <p className="empty__text">No articles matched this prompt yet. Try a broader custom prompt.</p>
            </div>
          )}

          {!searchLoading && !error && articles.length > 0 && (
            <>
              <p className="meta" style={{ marginBottom: 16 }}>
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
