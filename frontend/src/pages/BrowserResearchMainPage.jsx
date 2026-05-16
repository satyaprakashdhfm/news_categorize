import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import { browserResearchApi, feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES, SUBCATEGORY_CODES, SUBCATEGORY_LABELS } from '@/utils/helpers';

const SUMMARY_PREVIEW_CHARS = 240;

function AddToFeedBtn({ cardId, initialPinned = false }) {
  const [pinned, setPinned] = useState(initialPinned);
  const [busy, setBusy] = useState(false);

  const handleAdd = async (e) => {
    e.stopPropagation();
    if (busy || pinned) return;
    setBusy(true);
    try {
      await feedCardsApi.pin(cardId);
      setPinned(true);
    } catch {
      setPinned(true);
    } finally {
      setBusy(false);
    }
  };

  if (pinned) {
    return (
      <span className="badge badge--live"><span className="badge__dot" />Saved</span>
    );
  }

  return (
    <button onClick={handleAdd} disabled={busy} className="btn" style={{ padding: '4px 12px', fontSize: 'var(--t-micro)' }}>
      {busy ? '...' : '+ Add to My Feed'}
    </button>
  );
}

function compact(text, n = SUMMARY_PREVIEW_CHARS) {
  const value = String(text || '').trim();
  if (value.length <= n) return { text: value, truncated: false };
  return { text: `${value.slice(0, n)}...`, truncated: true };
}

function fmtInt(value) {
  return Number(value || 0).toLocaleString();
}

function fmtUsd(value) {
  return `$${Number(value || 0).toFixed(6)}`;
}

const SUGGESTED = [
  'US AI startup funding and open source models',
  'Semiconductor export controls — last 7 days',
  'Central bank communications, G7 focus',
  'Cross-border M&A in European industrials',
];

export default function BrowserResearchMainPage({ isDark, toggleDark }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState('US AI startup funding and open source models');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [sourceFilter, setSourceFilter] = useState('all');
  const [expanded, setExpanded] = useState({});
  const [history, setHistory] = useState([]);
  const [autoRunKey, setAutoRunKey] = useState('');
  const [processingLog, setProcessingLog] = useState([]);
  const [streamPhase, setStreamPhase] = useState('idle');
  const abortRef = useRef(null);
  const [currentUrl, setCurrentUrl] = useState('');

  const [cardTitle, setCardTitle] = useState('');
  const [cardDomain, setCardDomain] = useState('');
  const [cardSubdomain, setCardSubdomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [savedCardId, setSavedCardId] = useState(null);
  const [attachResult, setAttachResult] = useState(null);

  const blogs = useMemo(() => {
    const items = data?.blogs || [];
    if (sourceFilter === 'all') return items;
    return items.filter((b) => b.source === sourceFilter);
  }, [data, sourceFilter]);

  const toggleExpand = (key) => setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  const loadHistory = async () => {
    try {
      const res = await browserResearchApi.getHistory({ limit: 20 });
      setHistory(res?.runs || []);
    } catch { /* silent */ }
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

  useEffect(() => { loadHistory(); }, []);

  useEffect(() => {
    const q = String(searchParams.get('q') || '').trim();
    const d = String(searchParams.get('domain') || '').trim().toUpperCase();
    const sub = String(searchParams.get('subdomain') || '').trim().toUpperCase();
    const shouldAutoRun = String(searchParams.get('autorun') || '') === '1';
    if (!q) return;
    setQuery(q);
    if (d) setCardDomain(d);
    if (sub) setCardSubdomain(sub);
    if (shouldAutoRun && autoRunKey !== q && !loading) {
      setAutoRunKey(q);
      const next = new URLSearchParams(searchParams);
      next.delete('autorun');
      navigate(`/custom/browser?${next.toString()}`, { replace: true });
      runResearch(q);
    }
  }, [searchParams]);

  const runResearch = async (queryOverride) => {
    const effectiveQuery = String(queryOverride || query || '').trim();
    if (effectiveQuery.length < 3) { setError('Query must be at least 3 characters'); return; }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError('');
    setProcessingLog([]);
    setStreamPhase('streaming');
    setData(null);
    setCurrentUrl('');
    setCardTitle(effectiveQuery);
    setSaveError('');
    setSavedCardId(null);
    setAttachResult(null);

    const ts = () => new Date().toLocaleTimeString();

    try {
      const token = localStorage.getItem('curio_token');
      const response = await fetch('/api/browser-research/live-browser-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query: effectiveQuery, hint_channels: [] }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Server error ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processBuffer = (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let parsed;
          try { parsed = JSON.parse(line.slice(6)); } catch { continue; }

          if (parsed.type === 'url') {
            setCurrentUrl(parsed.payload);
          } else if (parsed.type === 'step') {
            setProcessingLog((prev) => [`${ts()} ${parsed.payload}`, ...prev].slice(0, 60));
          } else if (parsed.type === 'result') {
            const res = parsed.payload;
            setData(res);
            setQuery(res?.query || effectiveQuery);
            setExpanded({});
            setStreamPhase('done');
            setAttachResult(null);
            setHistory((prev) => [
              { run_id: res.run_id, query: res.query, total_blogs: res.total_blogs, generated_at: res.generated_at, llm_usage: res.llm_usage },
              ...prev.filter((x) => x.run_id !== res.run_id),
            ].slice(0, 20));
            feedCardsApi.attachRun({
              run_id: res.run_id,
              query: res.query,
              title: cardTitle || res.query,
              domain: cardDomain || null,
              subdomain: cardSubdomain || null,
            }).then(setAttachResult).catch(() => {});
          } else if (parsed.type === 'error') {
            setError(parsed.payload || 'Research failed');
            setStreamPhase('error');
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush remaining buffer — result event is always the last chunk
          if (buffer.trim()) processBuffer('\n');
          break;
        }
        processBuffer(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if (err.name === 'AbortError') { setStreamPhase('idle'); setError(''); }
      else { setError(err.message || 'Research run failed'); setStreamPhase('error'); }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const cancelResearch = () => { if (abortRef.current) abortRef.current.abort(); };

  const run = async (e) => { e.preventDefault(); await runResearch(); };

  const saveAsCard = async () => {
    if (!data?.run_id || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const card = await feedCardsApi.create({
        type: 'custom', title: cardTitle || data.query,
        domain: cardDomain || null, subdomain: cardSubdomain || null,
        run_id: data.run_id, is_global: true,
      });
      await feedCardsApi.pin(card.id);
      setSavedCardId(card.id);
    } catch (err) {
      setSaveError(err?.response?.data?.detail || 'Failed to save card');
    } finally {
      setSaving(false);
    }
  };

  const subdominOptions = SUBCATEGORY_CODES[cardDomain] || [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="main" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        {/* Page header */}
        <div className="page">
          <div className="page__title">
            <h1 className="display">Custom<br/><em>Research</em></h1>
            <p className="page__sub">
              Dynamically discover Reddit communities, search YouTube, and scrape Google News for any query — grounded in real URLs, no hallucinated sources.
            </p>
          </div>
          <div className="page__actions">
            <div className="metric">
              <span className="eyebrow">Mode</span>
              <span className="metric__val">Browser (Primary)</span>
            </div>
            <div className="metric">
              <span className="eyebrow">LLM calls / run</span>
              <span className="metric__val mono">2</span>
            </div>
          </div>
        </div>

        <div className="custom">
          {/* Left column */}
          <div className="custom__left">
            {/* Research input panel */}
            <section className="panel">
              <header className="panel__head">
                <div>
                  <h2 className="panel__title">Browser Research</h2>
                  <p className="panel__sub">Main browser-based flow. Old Reddit and YouTube adapters remain available as backup.</p>
                </div>
                <span className="badge badge--info"><span className="badge__dot" />Relevance filtering · off</span>
              </header>

              <form onSubmit={run}>
                <div className="field">
                  <label className="field__label" htmlFor="q">Research query</label>
                  <div className="field__input">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ color: 'var(--fg-3)', flexShrink: 0 }}>
                      <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.4"/>
                      <path d="M9 9 L12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <input
                      id="q"
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      placeholder="What do you want to research?"
                      minLength={3}
                      required
                    />
                    <kbd className="field__kbd">⌘↵</kbd>
                  </div>
                  <div className="field__sug">
                    <span className="meta" style={{ marginRight: 8 }}>Try</span>
                    {SUGGESTED.map(s => (
                      <button type="button" key={s} className="sug" onClick={() => setQuery(s)}>{s}</button>
                    ))}
                  </div>
                </div>

                {error && <p style={{ color: 'var(--signal-critical)', fontSize: 'var(--t-meta)', margin: '12px 0 0' }}>{error}</p>}

                <div className="panel__foot">
                  <div className="panel__budget">
                    <span className="eyebrow">Cost estimate</span>
                    <span className="panel__budgetVal">
                      <span className="mono">2</span> LLM calls
                      <span className="panel__budgetSep">·</span>
                      <span className="mono">~0.04</span> USD
                      <span className="panel__budgetSep">·</span>
                      <span className="mono">~90s</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {loading && (
                      <button type="button" onClick={cancelResearch} className="btn">
                        <svg width="10" height="10" viewBox="0 0 10 10"><rect x="2" y="2" width="6" height="6" fill="currentColor" rx="1"/></svg>
                        Stop
                      </button>
                    )}
                    <button type="submit" disabled={loading} className={`btn btn--primary btn--lg ${loading ? 'is-running' : ''}`} style={{ opacity: loading ? 0.7 : 1 }}>
                      {loading ? (
                        <>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="3" y="3" width="6" height="6" fill="currentColor" rx="1"/></svg>
                          Browsing the web...
                        </>
                      ) : (
                        <>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M4 3 L11 7 L4 11 Z" fill="currentColor"/></svg>
                          Run live browser research
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </section>

            {/* Current URL bar (shown while loading, no screenshots) */}
            {loading && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                background: 'var(--bg-1)', border: '1px solid var(--line-1)',
                borderRadius: 'var(--r-lg)',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--signal-warn)', animation: 'step-pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)', color: 'var(--fg-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {currentUrl || 'Launching browser...'}
                </span>
                <span style={{ fontSize: 'var(--t-micro)', fontWeight: 600, color: 'var(--signal-warn)', flexShrink: 0 }}>Browsing...</span>
              </div>
            )}

            {/* Live feed panel */}
            <section className="panel">
              <header className="panel__head">
                <div>
                  <h2 className="panel__title">Live research feed</h2>
                  <p className="panel__sub">
                    {loading ? 'Streaming steps as the browser runs.' : processingLog.length ? 'Run complete.' : 'No run yet. Start browser research to see the live step-by-step feed.'}
                  </p>
                </div>
                <span className={`badge ${streamPhase === 'streaming' ? 'badge--live' : streamPhase === 'done' ? 'badge--info' : 'badge--idle'}`}>
                  <span className={`pulse ${streamPhase === 'streaming' ? 'pulse--live' : 'pulse--steady'}`}><span className="pulse__ring"/><span className="pulse__core"/></span>
                  {streamPhase === 'streaming' ? 'Running' : streamPhase === 'done' ? 'Complete' : streamPhase === 'error' ? 'Error' : 'Idle'}
                </span>
              </header>

              {processingLog.length === 0 ? (
                <div className="empty">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--fg-4)' }}>
                    <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3"/>
                    <path d="M14 20 L18 24 L26 16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p className="empty__text">When a run starts, you'll see planner decisions, source discovery, and synthesis progress in real time.</p>
                </div>
              ) : (
                <div style={{
                  background: 'var(--bg-0)', border: '1px solid var(--line-1)',
                  borderRadius: 'var(--r-md)', padding: 16,
                  fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)',
                  maxHeight: 280, overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: 2,
                }}>
                  {streamPhase === 'streaming' && (
                    <div style={{ color: 'var(--signal-warn)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ animation: 'step-pulse 1.5s ease-in-out infinite' }}>▶</span>
                      Research in progress — streaming live steps below
                    </div>
                  )}
                  {processingLog.map((line, idx) => {
                    const isArrow = line.includes('  →');
                    const isError = line.toLowerCase().includes('error');
                    const isDone = line.toLowerCase().includes('done') || line.toLowerCase().includes('complete');
                    return (
                      <div key={`${line}-${idx}`} style={{
                        lineHeight: 1.6,
                        color: isError ? 'var(--signal-critical)' : isDone ? 'var(--signal-positive)' : isArrow ? 'var(--fg-3)' : 'var(--accent)',
                        paddingLeft: isArrow ? 16 : 0,
                      }}>
                        {isArrow ? '' : '› '}{line}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <aside className="custom__right">
            <section className="panel panel--compact">
              <h2 className="panel__title" style={{ marginBottom: 12 }}>Sources</h2>
              <ul className="sources">
                <li className="src is-on"><span className="src__glyph">R</span><span className="src__name">Reddit</span><span className="meta">relevance</span></li>
                <li className="src is-on"><span className="src__glyph">Y</span><span className="src__name">YouTube</span><span className="meta">search</span></li>
                <li className="src is-on"><span className="src__glyph">G</span><span className="src__name">Bing + Google News</span><span className="meta">RSS</span></li>
                <li className="src is-on"><span className="src__glyph">H</span><span className="src__name">Hacker News</span><span className="meta">Algolia</span></li>
                <li className="src is-on"><span className="src__glyph">X</span><span className="src__name">X / Twitter</span><span className="meta">Bing web</span></li>
                <li className="src is-on"><span className="src__glyph">B</span><span className="src__name">Blogs / Opinion</span><span className="meta">DDG</span></li>
              </ul>
            </section>

            <section className="panel panel--compact">
              <h2 className="panel__title" style={{ marginBottom: 12 }}>Recent runs</h2>
              {history.length === 0 ? (
                <p className="meta" style={{ padding: '8px 0' }}>No runs yet.</p>
              ) : (
                <ul className="history">
                  {history.slice(0, 5).map((h) => (
                    <li key={h.run_id} className="hist" style={{ cursor: 'pointer' }} onClick={() => openRun(h.run_id)}>
                      <span className="hist__q">{h.query}</span>
                      <span className="hist__meta mono">{h.total_blogs} cards</span>
                    </li>
                  ))}
                </ul>
              )}
              <button onClick={() => navigate('/profile')} className="panel__link">View full history →</button>
            </section>
          </aside>
        </div>

        {/* Results */}
        {data && (
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Global Feed status */}
            {streamPhase === 'done' && (
              <div className="panel" style={{ borderColor: 'rgba(139,196,138,0.3)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
                  <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Global Feed</h2>
                  <button onClick={() => navigate('/')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 500 }}>View Home Feed →</button>
                </div>

                {attachResult ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '10px 16px', borderRadius: 'var(--r-md)',
                    background: attachResult.merged ? 'var(--accent-soft)' : 'rgba(139,196,138,0.12)',
                    border: `1px solid ${attachResult.merged ? 'rgba(127,212,209,0.2)' : 'rgba(139,196,138,0.2)'}`,
                    marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 'var(--t-meta)', fontWeight: 500, color: attachResult.merged ? 'var(--accent)' : 'var(--signal-positive)' }}>
                      {attachResult.merged ? '🔀' : '✓'} {attachResult.message}
                    </span>
                    {isAuthenticated && attachResult.card_id && <AddToFeedBtn cardId={attachResult.card_id} initialPinned={!!attachResult.auto_pinned} />}
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <div style={{ width: 12, height: 12, border: '1.5px solid var(--fg-3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                    <span className="meta">Attaching to Global Feed...</span>
                  </div>
                )}

                {/* Override domain */}
                <details>
                  <summary style={{ cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 600, color: 'var(--fg-3)' }}>
                    Override domain / category (optional)
                  </summary>
                  <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                      <div className="field">
                        <label className="field__label">Card Title</label>
                        <div className="field__input">
                          <input type="text" value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} />
                        </div>
                      </div>
                      <div className="field">
                        <label className="field__label">Domain</label>
                        <select value={cardDomain} onChange={(e) => { setCardDomain(e.target.value); setCardSubdomain(''); }}
                          style={{
                            width: '100%', padding: '10px 14px', background: 'var(--bg-2)',
                            border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)',
                            color: 'var(--fg-1)', fontSize: 'var(--t-body)', fontFamily: 'var(--font-sans)',
                          }}>
                          <option value="">— Select —</option>
                          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field__label">Subcategory</label>
                        <select value={cardSubdomain} onChange={(e) => setCardSubdomain(e.target.value)} disabled={!cardDomain}
                          style={{
                            width: '100%', padding: '10px 14px', background: 'var(--bg-2)',
                            border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)',
                            color: 'var(--fg-1)', fontSize: 'var(--t-body)', fontFamily: 'var(--font-sans)',
                            opacity: cardDomain ? 1 : 0.5,
                          }}>
                          <option value="">— Select —</option>
                          {subdominOptions.map((code) => <option key={code} value={code}>{SUBCATEGORY_LABELS[code]}</option>)}
                        </select>
                      </div>
                    </div>
                    {saveError && <p style={{ color: 'var(--signal-critical)', fontSize: 'var(--t-meta)' }}>{saveError}</p>}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <button onClick={saveAsCard} disabled={saving || !isAuthenticated} className="btn btn--primary" style={{ opacity: saving ? 0.6 : 1 }}>
                        {saving ? 'Saving...' : savedCardId ? '✓ Saved' : 'Save with this category'}
                      </button>
                      {!isAuthenticated && <span className="meta">Sign in to pin this to your personal feed.</span>}
                    </div>
                  </div>
                </details>
              </div>
            )}

            {/* Run stats */}
            <div className="panel">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: 'var(--t-meta)', color: 'var(--fg-2)' }}>
                <span>Total blogs: <strong style={{ color: 'var(--fg-1)' }}>{data.total_blogs}</strong></span>
                <span>Reddit: <strong style={{ color: 'var(--fg-1)' }}>{data.selected_reddit_communities?.join(', ') || 'none'}</strong></span>
                <span>YouTube: <strong style={{ color: 'var(--fg-1)' }}>{data.youtube_channels_used?.join(', ') || 'none'}</strong></span>
                {data.llm_usage && (
                  <span className="mono">
                    {fmtInt(data.llm_usage.total_tokens)} tokens · {fmtUsd(data.llm_usage.estimated_cost_usd)}
                  </span>
                )}
              </div>
            </div>

            {/* Source filter */}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['all', 'reddit', 'youtube', 'news', 'twitter', 'hn', 'blog'].map((f) => (
                <button
                  key={f}
                  onClick={() => setSourceFilter(f)}
                  className={`fchip ${sourceFilter === f ? 'is-on' : ''}`}
                  style={{ textTransform: 'uppercase', fontWeight: 600 }}
                >
                  {f === 'hn' ? 'HackerNews' : f}
                </button>
              ))}
            </div>

            {/* Blog cards grid */}
            <div className="grid">
              {blogs.map((b, idx) => {
                const key = `${b.source}-${idx}-${b.url}`;
                const isExpanded = !!expanded[key];
                const summary = compact(b.summary || '');
                const shownSummary = isExpanded ? (b.summary || '') : summary.text;

                const sourceColor = b.source === 'reddit' ? '#E8913C'
                  : b.source === 'youtube' ? 'var(--signal-critical)'
                  : b.source === 'twitter' ? '#1DA1F2'
                  : b.source === 'hn' ? '#FF6600'
                  : b.source === 'blog' ? '#9B59B6'
                  : 'var(--accent)';
                const sourceBg = b.source === 'reddit' ? 'rgba(232,145,60,0.12)'
                  : b.source === 'youtube' ? 'rgba(240,110,110,0.12)'
                  : b.source === 'twitter' ? 'rgba(29,161,242,0.10)'
                  : b.source === 'hn' ? 'rgba(255,102,0,0.10)'
                  : b.source === 'blog' ? 'rgba(155,89,182,0.10)'
                  : 'var(--accent-soft)';

                return (
                  <article key={key} className="card" style={{ gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 'var(--r-sm)',
                        fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                        background: sourceBg, color: sourceColor,
                      }}>{b.source}</span>
                      {b.community && <span className="meta">r/{b.community}</span>}
                      {b.channel && <span className="meta">{b.channel}</span>}
                    </div>
                    <h3 style={{ fontSize: 'var(--t-body)', fontWeight: 700, color: 'var(--fg-1)', lineHeight: 1.4, margin: 0 }}>{b.title}</h3>
                    <p style={{ fontSize: 'var(--t-meta)', color: 'var(--fg-2)', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap' }}>{shownSummary}</p>
                    {summary.truncated && (
                      <button onClick={() => toggleExpand(key)} style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--accent)', fontSize: 'var(--t-meta)', fontWeight: 500, padding: 0,
                      }}>
                        {isExpanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 'var(--t-micro)', color: 'var(--fg-3)' }}>
                      {typeof b.relevance_score === 'number' && <span>match: {Math.round((b.relevance_score || 0) * 100)}%</span>}
                      {typeof b.score === 'number' && <span>↑{b.score}</span>}
                      {typeof b.comments === 'number' && <span>{b.comments} comments</span>}
                    </div>
                    {b.url && (
                      <a href={b.url} target="_blank" rel="noreferrer" style={{
                        color: 'var(--accent)', fontSize: 'var(--t-meta)', fontWeight: 500, textDecoration: 'none',
                      }}>
                        Open source →
                      </a>
                    )}
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
