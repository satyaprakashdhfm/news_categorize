import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import NewsCard from '@/components/NewsCard';
import { articlesApi, browserResearchApi, feedCardsApi } from '@/services/api';
import { CATEGORIES, COUNTRIES, DOMAIN_COLORS, SUBCATEGORY_LABELS, formatTimeAgo } from '@/utils/helpers';

const PAGE_SIZE = 15;

const DOMAIN_CSS = {
  POL: 'var(--domain-policy)',
  ECO: 'var(--domain-econ)',
  BUS: 'var(--domain-biz)',
  TEC: 'var(--domain-tech)',
  OTH: 'var(--domain-others)',
};

const SOURCE_COLORS = {
  reddit: { bg: 'rgba(232,145,60,0.12)', color: '#E8913C' },
  youtube: { bg: 'rgba(240,110,110,0.12)', color: 'var(--signal-critical)' },
  news: { bg: 'var(--accent-soft)', color: 'var(--accent)' },
};

function todayParam() {
  return new Date().toISOString().split('T')[0];
}

function BrowserItem({ item }) {
  const [open, setOpen] = useState(false);
  const src = SOURCE_COLORS[item.source] || { bg: 'var(--bg-2)', color: 'var(--fg-3)' };

  return (
    <article style={{
      padding: '16px 20px', borderBottom: '1px solid var(--line-1)',
      transition: 'background 0.15s', cursor: 'default',
    }}
    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 6,
          background: src.color,
        }} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              padding: '2px 8px', borderRadius: 'var(--r-sm)',
              background: src.bg, color: src.color,
            }}>{item.source}</span>
            {item.community && <span className="meta" style={{ fontWeight: 600, color: '#E8913C' }}>r/{item.community}</span>}
            {item.channel && <span className="meta" style={{ fontWeight: 600, color: 'var(--signal-critical)' }}>{item.channel}</span>}
            {item.published_at && <span className="meta">{formatTimeAgo(item.published_at)}</span>}
          </div>
          <h3 style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.4, margin: 0 }}>
            {item.title}
          </h3>
          {item.summary && (
            <p style={{
              fontSize: 'var(--t-meta)', color: 'var(--fg-2)', lineHeight: 1.55, margin: 0,
              display: open ? 'block' : '-webkit-box',
              WebkitLineClamp: open ? undefined : 2,
              WebkitBoxOrient: 'vertical',
              overflow: open ? 'visible' : 'hidden',
            }}>{item.summary}</p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 2 }}>
            {item.score > 0 && <span className="meta">↑{item.score.toLocaleString()}</span>}
            {item.comments > 0 && <span className="meta">{item.comments.toLocaleString()} comments</span>}
            {item.summary && item.summary.length > 120 && (
              <button onClick={() => setOpen((o) => !o)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 'var(--t-meta)', color: 'var(--fg-3)',
              }}>
                {open ? 'Show less' : 'Read more'}
              </button>
            )}
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                style={{ marginLeft: 'auto', color: 'var(--accent)', fontSize: 'var(--t-meta)', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                Open
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 10 L10 4 M10 4 H5.5 M10 4 V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FeedCardDetailPage({ isDark, toggleDark }) {
  const { cardId } = useParams();
  const navigate = useNavigate();

  const [card, setCard] = useState(null);
  const [items, setItems] = useState([]);
  const [cardLoading, setCardLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [itemType, setItemType] = useState('article');
  const [country, setCountry] = useState('');
  const [timeFilter, setTimeFilter] = useState('today');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [textSearch, setTextSearch] = useState('');
  const [rerunStatus, setRerunStatus] = useState('idle'); // idle | running | done | error
  const [rerunLog, setRerunLog] = useState([]);
  const rerunAbort = useRef(null);

  const handleRerun = async () => {
    if (!card || rerunStatus === 'running') return;
    setRerunStatus('running');
    setRerunLog([]);
    const token = localStorage.getItem('curio_token');
    const controller = new AbortController();
    rerunAbort.current = controller;
    try {
      const resp = await fetch('/api/browser-research/live-browser-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ query: card.title, domain: card.domain || '', subdomain: card.subdomain || '' }),
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let runId = null;

      const processLines = (chunk) => {
        buf += chunk;
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          try {
            const d = JSON.parse(line.slice(5).trim());
            if (d.type === 'step') setRerunLog((p) => [...p, d.payload].slice(-40));
            if (d.type === 'error') setRerunLog((p) => [...p, `ERROR: ${d.payload}`].slice(-40));
            if (d.type === 'result' && d.payload?.run_id) runId = d.payload.run_id;
          } catch { /* skip malformed */ }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush any remaining bytes — the result event is often the last chunk
          if (buf.trim()) processLines('\n');
          break;
        }
        processLines(dec.decode(value, { stream: true }));
      }

      if (runId) {
        await feedCardsApi.attachRun({ run_id: runId, card_id: card.id, query: card.title, title: card.title, domain: card.domain, subdomain: card.subdomain });
        // Load all accumulated items across all runs for this card
        try {
          const allData = await browserResearchApi.getCardItems(card.id);
          if (allData.items && allData.items.length > 0) {
            setItems(allData.items);
          } else {
            const runData = await browserResearchApi.getRun(runId);
            setItems(runData.blogs || []);
          }
          setItemType('browser');
          setSourceFilter('all');
          setVisibleCount(PAGE_SIZE);
          setTextSearch('');
        } catch { /* items may already be visible from SSE */ }
        // Refresh card metadata in background (non-blocking)
        feedCardsApi.getCard(cardId).then(setCard).catch(() => {});
        setRerunStatus('done');
        setRerunLog((p) => [...p, 'Done! Fresh results loaded.']);
      } else {
        setRerunStatus('done');
        setRerunLog((p) => [...p, 'Research done (no new run created).']);
        await loadItems();
      }
    } catch (e) {
      if (e.name !== 'AbortError') { setRerunStatus('error'); setRerunLog((p) => [...p, `Stream crashed: ${e.message || e}`]); }
      else { setRerunStatus('idle'); setRerunLog([]); }
    }
  };

  useEffect(() => {
    feedCardsApi.getCard(cardId)
      .then(setCard)
      .catch(() => setError('Card not found.'))
      .finally(() => setCardLoading(false));
  }, [cardId]);

  const loadItems = useCallback(async () => {
    if (!card) return;
    setLoading(true);
    setError('');
    setVisibleCount(PAGE_SIZE);
    try {
      if (card.type === 'domain') {
        const params = { limit: 60 };
        if (card.domain) params.categories = card.domain;
        if (card.subdomain && card.subdomain !== 'OTH') params.subcategory = card.subdomain;
        if (country) params.country = country;
        if (timeFilter === 'today') params.day = todayParam();
        else params.hours_back = parseInt(timeFilter);
        const res = await articlesApi.getArticles(params);
        const articles = res.articles || [];
        if (articles.length > 0) { setItems(articles); setItemType('article'); }
        else if (card.run_id) {
          const runData = await browserResearchApi.getRun(card.run_id);
          setItems(runData.blogs || []); setItemType('browser');
        } else { setItems([]); setItemType('article'); }
      } else {
        // Custom card — load all items across all runs (accumulated history), fall back to latest run
        try {
          const res = await browserResearchApi.getCardItems(card.id);
          if (res.items && res.items.length > 0) {
            setItems(res.items); setItemType('browser');
          } else if (card.run_id) {
            const runData = await browserResearchApi.getRun(card.run_id);
            setItems(runData.blogs || []); setItemType('browser');
          } else { setItems([]); setItemType('browser'); }
        } catch {
          if (card.run_id) {
            const runData = await browserResearchApi.getRun(card.run_id);
            setItems(runData.blogs || []); setItemType('browser');
          } else { setItems([]); setItemType('browser'); }
        }
      }
    } catch { setError('Failed to load items.'); setItems([]); }
    finally { setLoading(false); }
  }, [card, timeFilter, country]);

  useEffect(() => { if (card) loadItems(); }, [card, loadItems]);

  const filteredItems = items.filter((i) => {
    if (card?.type === 'custom' && sourceFilter !== 'all' && i.source !== sourceFilter) return false;
    if (textSearch) {
      const q = textSearch.toLowerCase();
      const title = (i.title || i.headline || '').toLowerCase();
      const summary = (i.summary || i.content || '').toLowerCase();
      if (!title.includes(q) && !summary.includes(q)) return false;
    }
    return true;
  });

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = filteredItems.length > visibleCount;
  const category = CATEGORIES.find((c) => c.id === card?.domain);
  const subcategoryLabel = SUBCATEGORY_LABELS[card?.subdomain] || card?.subdomain;
  const dnaCode = card?.domain
    ? card?.subdomain && card?.subdomain !== 'OTH' ? `${card.domain}·${card.subdomain}` : card?.domain
    : null;
  const accentColor = DOMAIN_CSS[card?.domain] || DOMAIN_CSS.OTH;
  const sourceCounts = items.reduce((acc, i) => { acc[i.source] = (acc[i.source] || 0) + 1; return acc; }, {});

  if (cardLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
        <Header isDark={isDark} toggleDark={toggleDark} />
        <div className="empty"><div style={{ width: 32, height: 32, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '24px 24px 60px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Back */}
        <button onClick={() => navigate(-1)} className="back">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 3 L4 6 L8 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Back
        </button>

        {/* Card hero */}
        {card && (
          <div className="card" style={{ cursor: 'default', paddingLeft: 24 }}>
            <div style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, borderRadius: 2, background: accentColor }} />
            <header className="card__head">
              <span className="card__kind">{card.type === 'domain' ? 'Domain' : 'Research'}</span>
              {dnaCode && <span className="tag tag--code">{dnaCode}</span>}
              {card.is_global && !card.created_by && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 3,
                  fontSize: 'var(--t-micro)', fontWeight: 600,
                  color: '#f0c060',
                  background: 'rgba(240,192,96,0.12)',
                  border: '1px solid rgba(240,192,96,0.25)',
                  borderRadius: 4,
                  padding: '1px 6px',
                  letterSpacing: '0.02em',
                }}>
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
                    <path d="M6 1L7.2 4.2H10.5L7.9 6.3L8.9 9.5L6 7.5L3.1 9.5L4.1 6.3L1.5 4.2H4.8Z" fill="#f0c060"/>
                  </svg>
                  Official
                </span>
              )}
            </header>
            <h1 style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', margin: 0, lineHeight: 1.3 }}>{card.title}</h1>
            {card.description && <p className="card__summary">{card.description}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              {category && (
                <span className="chip" style={{ '--chipColor': accentColor }}>
                  <span className="chip__dot" />{category.name}
                </span>
              )}
              {subcategoryLabel && card.subdomain !== 'OTH' && (
                <span className="chip chip--tiny">{subcategoryLabel}</span>
              )}
              {card.pinned_count > 0 && <span className="meta">{card.pinned_count} following</span>}
              {card.created_at && <span className="meta">{formatTimeAgo(card.created_at)}</span>}
              <button
                onClick={rerunStatus === 'running' ? () => { rerunAbort.current?.abort(); setRerunStatus('idle'); } : handleRerun}
                className="btn btn--primary"
                style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--t-meta)', padding: '5px 14px' }}
              >
                {rerunStatus === 'running' ? (
                  <>
                    <div style={{ width: 10, height: 10, border: '1.5px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    Stop
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M10 6A4 4 0 1 1 6 2M6 2V0M6 2L8 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    Get Latest News
                  </>
                )}
              </button>
            </div>

            {/* Live rerun log */}
            {(rerunStatus === 'running' || rerunLog.length > 0) && (
              <div style={{ marginTop: 8 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                  fontSize: 'var(--t-micro)', color: 'var(--fg-3)', fontWeight: 600,
                }}>
                  {rerunStatus === 'running' && (
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--signal-warn)', animation: 'step-pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                  )}
                  {rerunStatus === 'running' ? 'Researching live...' : rerunStatus === 'error' ? 'Research failed' : 'Research complete'}
                  {rerunLog.length > 0 && <span style={{ fontWeight: 400, opacity: 0.6 }}>{rerunLog.length} steps</span>}
                </div>
                <div style={{
                  background: 'var(--bg-0)',
                  border: `1px solid ${rerunStatus === 'error' ? 'rgba(240,110,110,0.25)' : 'var(--line-1)'}`,
                  borderRadius: 'var(--r-md)', padding: '10px 14px',
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  maxHeight: 260, overflowY: 'auto',
                  display: 'flex', flexDirection: 'column', gap: 3,
                }}>
                  {rerunLog.length === 0 ? (
                    <span style={{ color: 'var(--fg-4)' }}>Starting browser research...</span>
                  ) : rerunLog.map((msg, i) => {
                    const isArrow = msg && msg.includes('→');
                    const isError = msg && msg.toLowerCase().includes('error');
                    const isDone = msg && (msg.toLowerCase().includes('done') || msg.toLowerCase().includes('complete'));
                    return (
                      <div key={i} style={{
                        color: isError ? 'var(--signal-critical)' : isDone ? 'var(--signal-positive)' : isArrow ? 'var(--fg-3)' : 'var(--accent)',
                        paddingLeft: isArrow ? 12 : 0,
                        lineHeight: 1.5,
                      }}>
                        {isArrow ? '' : '› '}{msg}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filter bar */}
        {card && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
            padding: '10px 16px', background: 'var(--bg-1)', borderRadius: 'var(--r-lg)',
            border: '1px solid var(--line-1)',
          }}>
            {/* Text search */}
            <div className="field__input" style={{ flex: 1, minWidth: 120, padding: '6px 12px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--fg-4)', flexShrink: 0 }}>
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/><path d="M7.5 7.5 L10 10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                type="text"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                placeholder="Search within feed..."
                style={{ fontSize: 'var(--t-meta)' }}
              />
            </div>

            {/* Time filter for domain cards */}
            {card.type === 'domain' && itemType === 'article' && (
              <div style={{ display: 'flex', gap: 2 }}>
                {[['today', 'Today'], ['24', '24h'], ['48', '48h'], ['168', '7d']].map(([v, l]) => (
                  <button key={v} onClick={() => setTimeFilter(v)}
                    className={`tchip ${timeFilter === v ? 'is-on' : ''}`}>
                    {l}
                  </button>
                ))}
              </div>
            )}

            {/* Country for domain cards */}
            {card.type === 'domain' && itemType === 'article' && (
              <select value={country} onChange={(e) => setCountry(e.target.value)}
                style={{
                  padding: '6px 10px', borderRadius: 'var(--r-md)', fontSize: 'var(--t-meta)',
                  background: 'var(--bg-2)', border: '1px solid var(--line-1)',
                  color: 'var(--fg-2)', fontFamily: 'var(--font-sans)',
                }}>
                <option value="">All countries</option>
                {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.flag} {c.name}</option>)}
              </select>
            )}

            {/* Source filter for custom/browser cards */}
            {(card.type === 'custom' || itemType === 'browser') && (
              <div style={{ display: 'flex', gap: 2 }}>
                {['all', 'reddit', 'youtube', 'news'].map((src) => {
                  const count = src === 'all' ? items.length : (sourceCounts[src] || 0);
                  return (
                    <button key={src} onClick={() => setSourceFilter(src)}
                      className={`fchip ${sourceFilter === src ? 'is-on' : ''}`}
                      style={{ textTransform: 'capitalize', fontSize: 'var(--t-micro)', fontWeight: 600 }}>
                      {src}
                      {count > 0 && <span className="mono" style={{ fontSize: 10, opacity: 0.7, marginLeft: 4 }}>{count}</span>}
                    </button>
                  );
                })}
              </div>
            )}

            <span className="meta" style={{ marginLeft: 'auto' }}>{filteredItems.length}</span>
            <button className="iconbtn" onClick={loadItems} title="Refresh" style={{ width: 28, height: 28 }}>
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style={loading ? { animation: 'spin 1s linear infinite' } : undefined}>
                <path d="M2 7 A5 5 0 0 1 12 7 M12 4 V7 H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 7 A5 5 0 0 1 2 7 M2 10 V7 H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        )}

        {/* Content */}
        {error && <p style={{ color: 'var(--signal-critical)', fontSize: 'var(--t-meta)' }}>{error}</p>}

        {loading ? (
          <div className="empty">
            <div style={{ width: 32, height: 32, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="empty">
            <p className="empty__text">No items for the selected filters.</p>
            {timeFilter === 'today' && card?.type === 'domain' && (
              <button onClick={() => setTimeFilter('24')} style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 500 }}>
                Try last 24h instead →
              </button>
            )}
          </div>
        ) : itemType === 'article' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {visibleItems.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
            {hasMore && (
              <button onClick={() => setVisibleCount((n) => n + PAGE_SIZE)} className="btn" style={{ width: '100%', justifyContent: 'center' }}>
                See more ({filteredItems.length - visibleCount} remaining)
              </button>
            )}
          </div>
        ) : (
          <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            {visibleItems.map((item, idx) => (
              <BrowserItem key={`${item.url}-${idx}`} item={item} />
            ))}
            {hasMore && (
              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--line-1)' }}>
                <button onClick={() => setVisibleCount((n) => n + PAGE_SIZE)} className="btn" style={{ width: '100%', justifyContent: 'center' }}>
                  See more ({filteredItems.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
