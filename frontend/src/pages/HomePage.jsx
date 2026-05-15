import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import FeedCard from '@/components/FeedCard';
import { feedCardsApi, recommendationsApi, statsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES, SUBCATEGORY_LABELS, INTEREST_TREE } from '@/utils/helpers';

const DOMAIN_COLORS_CSS = {
  TEC: 'var(--domain-tech)',
  ECO: 'var(--domain-econ)',
  POL: 'var(--domain-policy)',
  BUS: 'var(--domain-biz)',
  OTH: 'var(--domain-others)',
};

const SOURCE_ICONS = {
  google_news: '📰',
  reddit: '🔴',
  youtube: '▶️',
};

function TrendingShimmer() {
  const rows = [5, 3, 4, 2];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
      {rows.map((count, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Domain header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div className="shimmer" style={{ width: 8, height: 8, borderRadius: '50%' }} />
            <div className="shimmer" style={{ width: `${60 + i * 20}px`, height: 13 }} />
          </div>
          {/* Subdomain rows */}
          {Array.from({ length: count }).map((_, j) => (
            <div key={j} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16 }}>
              <div className="shimmer" style={{ width: `${80 + (j * 17) % 60}px`, height: 11 }} />
              <div className="shimmer" style={{ width: 16, height: 11 }} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function UserStatsWidget({ stats }) {
  const total = stats?.total ?? null;
  const today = stats?.today ?? 0;

  return (
    <div className="metric">
      <span className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M2 10 Q2 7 6 7 Q10 7 10 10" stroke="currentColor" strokeWidth="1.3"/>
        </svg>
        Users
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="metric__val">
          {total === null ? '—' : total.toLocaleString()}
        </span>
        {today > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 700,
            color: '#4cba6e',
            background: 'rgba(76,186,110,0.12)',
            border: '1px solid rgba(76,186,110,0.25)',
            borderRadius: 4, padding: '1px 5px', flexShrink: 0,
          }}>
            +{today} today
          </span>
        )}
      </div>
    </div>
  );
}

function HotCardsSidebar({ cards, navigate }) {
  const [sortBy, setSortBy] = useState('hot'); // 'hot' | 'saves' | 'recent'

  const sorted = [...cards].sort((a, b) => {
    if (sortBy === 'saves') return (b.pinned_count || 0) - (a.pinned_count || 0);
    if (sortBy === 'recent') {
      const ta = a.updated_at ? new Date(a.updated_at) : 0;
      const tb = b.updated_at ? new Date(b.updated_at) : 0;
      return tb - ta;
    }
    // 'hot' — combined: content > saves > recency (server order)
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Sort toggle */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 8, padding: '0 2px',
      }}>
        {[
          { key: 'hot', label: '🔥 Hot' },
          { key: 'saves', label: '↑ Saves' },
          { key: 'recent', label: '⏱ Recent' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSortBy(key)}
            style={{
              flex: 1, padding: '4px 0',
              fontSize: 10, fontWeight: 700,
              borderRadius: 'var(--r-sm)',
              border: sortBy === key ? '1.5px solid var(--accent)' : '1.5px solid var(--line-1)',
              background: sortBy === key ? 'var(--accent-soft)' : 'transparent',
              color: sortBy === key ? 'var(--accent)' : 'var(--fg-3)',
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Card list */}
      {sorted.length === 0
        ? <div className="meta" style={{ textAlign: 'center', padding: '24px 0' }}>No cards yet.</div>
        : sorted.map((card, i) => {
          const color = DOMAIN_COLORS_CSS[card.domain] || DOMAIN_COLORS_CSS.OTH;
          const subLabel = SUBCATEGORY_LABELS[card.subdomain] || card.subdomain;
          const snippet = card.description
            ? card.description.slice(0, 60) + (card.description.length > 60 ? '…' : '')
            : null;

          const signal = card.pinned_count > 0
            ? { label: `↑ ${card.pinned_count} saved`, color: 'var(--accent)' }
            : card.run_id
              ? { label: 'Live', color: '#4cba6e' }
              : { label: 'New', color: 'var(--fg-4)' };

          return (
            <button
              key={card.id}
              onClick={() => navigate(`/feed/${card.id}`)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '9px 10px', borderRadius: 'var(--r-md)',
                background: 'transparent', border: 'none', cursor: 'pointer',
                textAlign: 'left', width: '100%', transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-4)', minWidth: 14, paddingTop: 3, lineHeight: 1 }}>
                {i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 'var(--t-meta)', fontWeight: 600, color: 'var(--fg-1)',
                  margin: 0, lineHeight: 1.4,
                  display: '-webkit-box', WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}>
                  {card.title}
                </p>
                {snippet && (
                  <p style={{ fontSize: 10, color: 'var(--fg-3)', margin: '3px 0 0', lineHeight: 1.4 }}>
                    {snippet}
                  </p>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  {subLabel && (
                    <span style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 80 }}>
                      {subLabel}
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: signal.color, flexShrink: 0 }}>
                    {signal.label}
                  </span>
                </div>
              </div>
            </button>
          );
        })
      }
    </div>
  );
}

/* Recommendation card — self-contained article from cron search */
function RecCard({ rec, onDismiss }) {
  const accentColor = DOMAIN_COLORS_CSS[rec.domain] || DOMAIN_COLORS_CSS.OTH;
  const catInfo = CATEGORIES.find((c) => c.id === rec.domain);
  const sourceIcon = SOURCE_ICONS[rec.source_type] || '🔗';

  return (
    <article
      className="card card--research"
      style={{ cursor: rec.source_url ? 'pointer' : 'default' }}
      onClick={() => rec.source_url && window.open(rec.source_url, '_blank', 'noopener')}
    >
      {/* Reason badge */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4,
        fontSize: 'var(--t-micro)', color: 'var(--accent)', fontWeight: 500,
        marginBottom: 4,
      }}>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M6 1 L7.5 4.5 L11 5 L8.5 7.5 L9 11 L6 9.5 L3 11 L3.5 7.5 L1 5 L4.5 4.5Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        </svg>
        {rec.reason}
      </div>

      {/* Header */}
      <header className="card__head">
        <span className="card__kind">
          <span>{sourceIcon}</span>
          {rec.source_type === 'google_news' ? 'News' : rec.source_type === 'reddit' ? 'Reddit' : rec.source_type === 'youtube' ? 'YouTube' : 'Web'}
        </span>
        {rec.subdomain && (
          <span className="tag tag--code">{SUBCATEGORY_LABELS[rec.subdomain] || rec.subdomain}</span>
        )}
        {!rec.subdomain && rec.domain && <span className="tag tag--code">{rec.domain}</span>}
        {rec.batch_label && (
          <span className="meta" style={{ marginLeft: 'auto', textTransform: 'capitalize' }}>{rec.batch_label}</span>
        )}
      </header>

      {/* Title */}
      <h3 className="card__title" style={{ fontSize: 'var(--t-body)', lineHeight: 1.4 }}>
        {rec.title}
      </h3>

      {/* Summary */}
      {rec.summary && (
        <p className="card__summary" style={{ fontSize: 'var(--t-meta)' }}>
          {rec.summary.slice(0, 300)}{rec.summary.length > 300 ? '...' : ''}
        </p>
      )}

      {/* Domain chip */}
      {catInfo && (
        <div className="card__chips">
          <span className="chip chip--tiny" style={{ '--chipColor': accentColor }}>
            <span className="chip__dot" />
            {catInfo.name}
          </span>
        </div>
      )}

      {/* Footer */}
      <footer className="card__foot">
        {rec.score != null && (
          <span className="meta">{rec.source_type === 'youtube' ? `${(rec.score / 1000).toFixed(1)}k views` : `${rec.score} pts`}</span>
        )}
        <span style={{ flex: 1 }} />
        {rec.source_url && (
          <span style={{ color: 'var(--accent)', fontSize: 'var(--t-meta)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
            Open
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 10 L10 4 M10 4 H5.5 M10 4 V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        )}
        {onDismiss && (
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(rec.id); }}
            title="Dismiss"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-4)', fontSize: 16, lineHeight: 1, padding: '0 2px', marginLeft: 4 }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--signal-critical)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--fg-4)'}
          >×</button>
        )}
      </footer>
    </article>
  );
}

export default function HomePage({ isDark, toggleDark }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('global');
  const [domain, setDomain] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [hoursBack, setHoursBack] = useState('6');

  const [globalCards, setGlobalCards] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // User's own created/researched cards
  const [myCards, setMyCards] = useState([]);
  const [myLoading, setMyLoading] = useState(false);

  // Pinned cards (saved feed)
  const [myPins, setMyPins] = useState([]);
  const [savedLoading, setSavedLoading] = useState(false);

  // Recommendations from cron
  const [recs, setRecs] = useState([]);
  const [recsLoading, setRecsLoading] = useState(false);

  const [hotCards, setHotCards] = useState([]);
  const [hotLoading, setHotLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);

  const [userStats, setUserStats] = useState(null);

  const loadGlobal = useCallback(async () => {
    setGlobalLoading(true);
    setGlobalError('');
    try {
      const params = { limit: 100 };
      if (domain) params.domain = domain;
      if (subdomain) params.subdomain = subdomain;
      if (hoursBack) params.hours_back = hoursBack;
      const res = await feedCardsApi.getGlobal(params);
      setGlobalCards(res.cards || []);
      setLastSyncTime(new Date());
    } catch {
      setGlobalError('Failed to load global feed.');
    } finally {
      setGlobalLoading(false);
    }
  }, [domain, subdomain, hoursBack]);

  const loadMyCards = useCallback(async () => {
    if (!isAuthenticated) return;
    setMyLoading(true);
    try {
      const params = {};
      if (domain) params.domain = domain;
      if (hoursBack) params.hours_back = hoursBack;
      const res = await feedCardsApi.getMyCards(params);
      setMyCards(res.cards || []);
      setLastSyncTime(new Date());
    } catch { /* silent */ } finally {
      setMyLoading(false);
    }
  }, [isAuthenticated, domain, hoursBack]);

  const loadMyPins = useCallback(async () => {
    if (!isAuthenticated) return;
    setSavedLoading(true);
    try {
      const pins = await feedCardsApi.getMyFeed();
      setMyPins(pins || []);
      setLastSyncTime(new Date());
    } catch { /* silent */ } finally {
      setSavedLoading(false);
    }
  }, [isAuthenticated]);

  const loadRecs = useCallback(async () => {
    if (!isAuthenticated) return;
    setRecsLoading(true);
    try {
      const params = {};
      if (domain) params.domain = domain;
      const res = await recommendationsApi.getMy(params);
      setRecs(res.recommendations || []);
      setLastSyncTime(new Date());
    } catch { /* silent */ } finally {
      setRecsLoading(false);
    }
  }, [isAuthenticated, domain]);

  const loadHot = useCallback(async () => {
    setHotLoading(true);
    try {
      const res = await feedCardsApi.getHot({ limit: 8 });
      setHotCards(res.cards || []);
    } catch { /* silent */ } finally {
      setHotLoading(false);
    }
  }, []);

  const loadUserStats = useCallback(async () => {
    try {
      const data = await statsApi.getUsers();
      setUserStats(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadGlobal(); }, [loadGlobal]);
  useEffect(() => { loadHot(); }, [loadHot]);
  useEffect(() => { loadUserStats(); }, [loadUserStats]);
  useEffect(() => { if (isAuthenticated) loadMyPins(); }, [loadMyPins, isAuthenticated]);
  useEffect(() => { if (activeTab === 'your') loadMyCards(); }, [activeTab, loadMyCards]);
  useEffect(() => { if (activeTab === 'saved' && isAuthenticated) loadMyPins(); }, [activeTab, isAuthenticated]);
  useEffect(() => { if (activeTab === 'recommended' && isAuthenticated) loadRecs(); }, [activeTab, loadRecs, isAuthenticated]);

  const handlePin = () => loadMyPins();
  const handleUnpin = (cardId) => setMyPins((prev) => prev.filter((p) => p.card_id !== cardId));

  const handleDismissRec = async (recId) => {
    setRecs((prev) => prev.filter((r) => r.id !== recId));
    try { await recommendationsApi.markSeen([recId]); } catch { /* silent */ }
  };

  const displayCards = activeTab === 'global' ? globalCards
    : activeTab === 'your' ? myCards
    : activeTab === 'saved' ? myPins.filter((p) => p.card).map((p) => p.card)
    : [];
  const loading = activeTab === 'global' ? globalLoading
    : activeTab === 'your' ? myLoading
    : activeTab === 'saved' ? savedLoading
    : recsLoading;

  const refreshCurrent = () => {
    if (activeTab === 'global') loadGlobal();
    else if (activeTab === 'your') loadMyCards();
    else if (activeTab === 'saved') loadMyPins();
    else loadRecs();
  };

  const activeCount = activeTab === 'global' ? globalCards.length
    : activeTab === 'your' ? myCards.length
    : activeTab === 'saved' ? myPins.length
    : recs.length;

  const activeCountLabel = activeTab === 'global' ? 'Cards today'
    : activeTab === 'saved' ? 'Saved cards'
    : activeTab === 'your' ? 'Your cards'
    : 'For you';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="main" style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px' }}>
        {/* Page header */}
        <div className="page">
          <div className="page__title">
            <h1 className="display">Intelligence<br/><em>Feed</em></h1>
            <p className="page__sub">
              Global news &amp; research, structured by domain.<br/>
              Now tracking <strong>{globalCards.length} cards</strong> across <strong>5 domains</strong>.
            </p>
          </div>
          <div className="page__actions">
            <div className="metric">
              <span className="eyebrow">Last sync</span>
              <span className="metric__val mono">
                {lastSyncTime ? lastSyncTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' UTC' : '—'}
              </span>
            </div>
            <div className="metric">
              <span className="eyebrow">{activeCountLabel}</span>
              <span className="metric__val">{activeCount}</span>
            </div>
            <UserStatsWidget stats={userStats} />
            <Link to="/custom/browser" className="btn btn--primary btn--lg">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2V12 M2 7H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
              New Research Card
            </Link>
          </div>
        </div>

        {/* Layout: sidebar + feed */}
        <div className="layout">
          {/* Sidebar */}
          <aside className="sidebar">
            <div className="sidebar__head">
              <span className="eyebrow sidebar__title">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 9 L5 6 L7 8 L10 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Trending
              </span>
            </div>
            <div className="sidebar__scroll">
              {hotLoading && hotCards.length === 0
                ? <TrendingShimmer />
                : <HotCardsSidebar cards={hotCards} navigate={navigate} />
              }
            </div>
            <div className="sidebar__foot">
              <span className="meta">5 domains</span>
              <span className="meta sidebar__live">
                <span className="pulse pulse--live"><span className="pulse__ring" /><span className="pulse__core" /></span>
                Live
              </span>
            </div>
          </aside>

          {/* Feed */}
          <section className="feed">
            {/* Segmented control */}
            <div className="filters">
              <div className="segmented">
                <button className={`seg ${activeTab === 'global' ? 'is-on' : ''}`} onClick={() => setActiveTab('global')}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 6 H10.5 M6 1.5 Q9 6 6 10.5 M6 1.5 Q3 6 6 10.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                  Global Feed
                </button>
                <button className={`seg ${activeTab === 'saved' ? 'is-on' : ''}`} onClick={() => setActiveTab('saved')}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 1.5 H9 Q10.5 1.5 10.5 3 V10.5 L6 8 L1.5 10.5 V3 Q1.5 1.5 3 1.5Z" stroke="currentColor" strokeWidth="1.3" fill="none"/></svg>
                  My Feed
                </button>
                <button className={`seg ${activeTab === 'your' ? 'is-on' : ''}`} onClick={() => setActiveTab('your')}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1.3"/><path d="M2 10 Q2 7 6 7 Q10 7 10 10" stroke="currentColor" strokeWidth="1.3"/></svg>
                  Your Cards
                </button>
                <button className={`seg ${activeTab === 'recommended' ? 'is-on' : ''}`} onClick={() => setActiveTab('recommended')}>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1 L7.5 4.5 L11 5 L8.5 7.5 L9 11 L6 9.5 L3 11 L3.5 7.5 L1 5 L4.5 4.5Z" stroke="currentColor" strokeWidth="1.2" fill="none"/></svg>
                  For You
                </button>
              </div>
            </div>

            <FilterBar
              domain={domain} setDomain={setDomain}
              subdomain={subdomain} setSubdomain={setSubdomain}
              hoursBack={hoursBack} setHoursBack={setHoursBack}
            />

            {/* Feed status */}
            <div className="feed__status">
              <span className="meta">
                {activeTab === 'recommended' ? `${recs.length} recommendations` : `${displayCards.length} cards`}
              </span>
              <span className="feed__sep">·</span>
              <span className="meta">
                {activeTab === 'global' ? 'trending & domain cards'
                  : activeTab === 'saved' ? 'your saved cards'
                  : activeTab === 'your' ? 'your research'
                  : 'personalized from Google News, Reddit & YouTube'}
              </span>
              <button className="iconbtn" title="Refresh" style={{ marginLeft: 'auto' }} onClick={refreshCurrent}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={loading ? { animation: 'spin 1s linear infinite' } : undefined}>
                  <path d="M2 7 A5 5 0 0 1 12 7 M12 4 V7 H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12 7 A5 5 0 0 1 2 7 M2 10 V7 H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>

            {/* Error */}
            {globalError && activeTab === 'global' && (
              <p style={{ color: 'var(--signal-critical)', fontSize: 'var(--t-meta)', marginBottom: 12 }}>{globalError}</p>
            )}

            {/* Signed-out overlay for My Feed / Your Cards / For You */}
            {(activeTab === 'saved' || activeTab === 'your' || activeTab === 'recommended') && !isAuthenticated ? (
              <div className="signedout">
                <div className="signedout__preview">
                  {[1, 2, 3].map(i => (
                    <article key={i} className="card card--ghost">
                      <span className="card__kind">Research</span>
                      <h3 className="card__title" style={{ fontSize: 'var(--t-body)' }}>Preview research title {i}</h3>
                      <p className="card__summary" style={{ fontSize: 'var(--t-meta)' }}>Signal-grade summary hidden until you sign in.</p>
                    </article>
                  ))}
                </div>
                <div className="signedout__overlay">
                  <div className="empty-state">
                    <div className="empty-state__icon">
                      <svg width="26" height="26" viewBox="0 0 26 26" fill="none"><path d="M6 13h14 M15 8 l5 5 -5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                    <h3 className="empty-state__title">
                      {activeTab === 'saved' ? 'Sign in to see your saved feed'
                        : activeTab === 'your' ? 'Sign in to see your cards'
                        : 'Sign in for personalized feed'}
                    </h3>
                    <p className="empty-state__body">
                      {activeTab === 'saved'
                        ? 'Cards you save appear here — your personal reading list.'
                        : activeTab === 'your'
                        ? 'Your research cards are private and only visible to you.'
                        : 'Get recommendations from Google News, Reddit & YouTube based on your interests.'}
                    </p>
                    <div className="empty-state__actions">
                      <Link to="/login" className="btn btn--primary">Sign in</Link>
                      <Link to="/register" className="btn">Create account</Link>
                    </div>
                  </div>
                </div>
              </div>
            ) : loading && (activeTab !== 'recommended' ? displayCards.length === 0 : recs.length === 0) ? (
              <div className="empty">
                <div style={{ width: 32, height: 32, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : activeTab === 'recommended' ? (
              /* For You — recommendation articles */
              recs.length === 0 ? (
                <div className="empty">
                  <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--fg-4)' }}>
                    <path d="M20 6 L23 16 L34 17 L26 24 L28 34 L20 29 L12 34 L14 24 L6 17 L17 16Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                  </svg>
                  <p className="empty__text">
                    No recommendations yet. Set your domain interests in your profile. The system searches Google News, Reddit &amp; YouTube at 6 AM, 2 PM &amp; 8 PM IST.
                  </p>
                  <Link to="/profile" className="btn btn--primary">Update interests</Link>
                </div>
              ) : (
                <div className="grid">
                  {recs.map((rec) => (
                    <RecCard key={rec.id} rec={rec} onDismiss={handleDismissRec} />
                  ))}
                </div>
              )
            ) : activeTab === 'saved' && displayCards.length === 0 ? (
              <div className="empty">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--fg-4)' }}>
                  <path d="M10 5 H30 Q34 5 34 9 V36 L20 28 L6 36 V9 Q6 5 10 5Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
                </svg>
                <p className="empty__text">No saved cards yet. Hit <strong>+ Save</strong> on any card in the Global Feed to add it here.</p>
                <button className="btn btn--primary" onClick={() => setActiveTab('global')}>Browse Global Feed</button>
              </div>
            ) : displayCards.length === 0 ? (
              <div className="empty">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ color: 'var(--fg-4)' }}>
                  <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="1.2" strokeDasharray="3 3"/>
                  <path d="M14 20 L18 24 L26 16" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <p className="empty__text">
                  {activeTab === 'global'
                    ? 'No global feed cards yet. Create a research card to get started.'
                    : 'You haven\'t created any research cards yet. Start a browser research to create one.'}
                </p>
                <Link to="/custom/browser" className="btn btn--primary">Create a research card</Link>
              </div>
            ) : (
              <div className="grid">
                {displayCards.map((card) => {
                  const pinned = activeTab === 'saved' ? true : myPins.some((p) => p.card_id === card.id);
                  return (
                    <FeedCard
                      key={card.id}
                      card={card}
                      isPinned={pinned}
                      onPin={handlePin}
                      onUnpin={handleUnpin}
                    />
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
