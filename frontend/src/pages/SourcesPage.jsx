import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import { sourcesApi } from '@/services/api';

const DOMAINS = ['all', 'general', 'technology', 'defence', 'science', 'business', 'politics', 'health', 'environment', 'sports'];

const DOMAIN_COLORS = {
  technology:  { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  defence:     { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444' },
  science:     { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  business:    { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  politics:    { bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6' },
  health:      { bg: 'rgba(236,72,153,0.12)',  color: '#ec4899' },
  environment: { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e' },
  sports:      { bg: 'rgba(249,115,22,0.12)',  color: '#f97316' },
  general:     { bg: 'rgba(100,116,139,0.12)', color: '#64748b' },
};

const TYPE_META = {
  youtube: { label: 'YouTube', color: '#ff0000', icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1C24 15.9 24 12 24 12s0-3.9-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/></svg>
  )},
  twitter: { label: 'X / Twitter', color: '#000', icon: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M18.3 1.5h3.4l-7.4 8.5 8.7 11.5h-6.8l-5.3-7-6.1 7H1.4l7.9-9L.9 1.5h7l4.8 6.4 5.6-6.4zm-1.2 18h1.9L7 3.4H5L17.1 19.5z"/></svg>
  )},
  reddit: { label: 'Reddit', color: '#ff4500', icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.9 13.4c0 .1 0 .2.1.3 0 1.9-2.2 3.5-5 3.5s-5-1.6-5-3.5c0-.1 0-.2.1-.3-.5-.2-.8-.7-.8-1.2 0-.8.6-1.4 1.4-1.4.4 0 .7.1 1 .4C10.3 11 11.5 10.6 13 10.5l.8-3.6 2.5.5c.1-.5.5-.8 1-.8.6 0 1.1.5 1.1 1.1s-.5 1.1-1.1 1.1c-.6 0-1-.4-1.1-.9l-2.2-.5-.7 3.1c1.4.1 2.7.5 3.6 1.1.3-.2.6-.4 1-.4.8 0 1.4.6 1.4 1.4-.1.5-.4 1-.8 1.2zM9 13c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm6 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm-1.5 2c-.4.4-1.1.6-1.5.6s-1.1-.2-1.5-.6c-.1-.1-.1-.3 0-.4.1-.1.3-.1.4 0 .3.3.8.4 1.1.4s.8-.2 1.1-.4c.1-.1.3-.1.4 0 .1.1.1.3 0 .4z"/></svg>
  )},
  web: { label: 'Website', color: '#64748b', icon: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
  )},
};

function getFavicon(url) {
  try {
    const domain = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
  } catch {
    return null;
  }
}

function getShortUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '') + (u.pathname !== '/' ? u.pathname.slice(0, 24) : '');
  } catch {
    return url.slice(0, 40);
  }
}

function AddSourceModal({ onClose, onAdded }) {
  const [form, setForm] = useState({ name: '', url: '', description: '', domain: 'general' });
  const [detectedType, setDetectedType] = useState('web');
  const [domainDetecting, setDomainDetecting] = useState(false);
  const [domainAiSet, setDomainAiSet] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const detectTimer = useRef(null);

  const triggerDomainDetect = (name, url) => {
    if (!name && !url) return;
    clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(async () => {
      setDomainDetecting(true);
      try {
        const res = await sourcesApi.detectDomain(name, url);
        setForm(f => ({ ...f, domain: res.domain }));
        setDomainAiSet(true);
      } catch { /* keep current */ }
      finally { setDomainDetecting(false); }
    }, 800);
  };

  const handleNameChange = (val) => {
    setForm(f => ({ ...f, name: val }));
    setDomainAiSet(false);
    triggerDomainDetect(val, form.url);
  };

  const handleUrlChange = (val) => {
    setForm(f => ({ ...f, url: val }));
    setDomainAiSet(false);
    const u = val.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) setDetectedType('youtube');
    else if (u.includes('twitter.com') || u.includes('x.com')) setDetectedType('twitter');
    else if (u.includes('reddit.com')) setDetectedType('reddit');
    else setDetectedType('web');
    triggerDomainDetect(form.name, val);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.url.trim()) { setErr('Name and URL are required'); return; }
    setSaving(true); setErr('');
    try {
      await sourcesApi.add(form);
      onAdded();
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to add source');
    } finally { setSaving(false); }
  };

  const tm = TYPE_META[detectedType];
  const domStyle = DOMAIN_COLORS[form.domain] || DOMAIN_COLORS.general;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-1)', border: '1px solid var(--line-1)',
        borderRadius: 'var(--r-md)', padding: 28, width: 440, maxWidth: '95vw',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Add a Source</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name *</label>
            <input
              value={form.name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="e.g. Ars Technica, Wendover Productions"
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--bg-0)', color: 'var(--fg-1)', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>URL *</label>
            <input
              value={form.url}
              onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--bg-0)', color: 'var(--fg-1)', fontSize: 13, boxSizing: 'border-box' }}
            />
            {form.url && (
              <div style={{ marginTop: 5, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ color: tm.color, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                  {tm.icon} {tm.label}
                </span>
              </div>
            )}
          </div>

          {/* Domain — AI auto-detected, user can override */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Domain</label>
              {domainDetecting && (
                <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>AI detecting...</span>
              )}
              {domainAiSet && !domainDetecting && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: domStyle.bg, color: domStyle.color }}>
                  ✦ AI: {form.domain}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {DOMAINS.filter(d => d !== 'all').map(d => {
                const dc = DOMAIN_COLORS[d] || DOMAIN_COLORS.general;
                const active = form.domain === d;
                return (
                  <button
                    key={d}
                    onClick={() => { setForm(f => ({ ...f, domain: d })); setDomainAiSet(false); }}
                    style={{
                      padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${active ? dc.color : 'var(--line-1)'}`,
                      background: active ? dc.bg : 'transparent',
                      color: active ? dc.color : 'var(--fg-4)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {d.charAt(0).toUpperCase() + d.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description <span style={{ fontWeight: 400 }}>(optional)</span></label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What makes this source good?"
              rows={2}
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--bg-0)', color: 'var(--fg-1)', fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
            />
          </div>

          {err && <div style={{ color: 'var(--signal-err)', fontSize: 12 }}>{err}</div>}

          <button
            onClick={submit}
            disabled={saving || domainDetecting}
            style={{ padding: '9px 0', borderRadius: 'var(--r-sm)', background: 'var(--fg-1)', color: 'var(--bg-0)', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', opacity: (saving || domainDetecting) ? 0.6 : 1 }}
          >
            {saving ? 'Adding...' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ src, onVote, isAuthenticated }) {
  const domStyle = DOMAIN_COLORS[src.domain] || DOMAIN_COLORS.general;
  const tm = TYPE_META[src.source_type] || TYPE_META.web;
  const favicon = getFavicon(src.url);
  const shortUrl = getShortUrl(src.url);

  return (
    <div style={{
      background: 'var(--bg-1)', border: '1px solid var(--line-1)',
      borderRadius: 'var(--r-md)', padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 10,
      transition: 'border-color 0.15s',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Favicon */}
        <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 'var(--r-sm)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {favicon
            ? <img src={favicon} width={20} height={20} alt="" onError={e => { e.target.style.display = 'none'; }} />
            : <span style={{ color: tm.color }}>{tm.icon}</span>}
        </div>

        {/* Name + URL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <a href={src.url} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, fontSize: 14, color: 'var(--fg-1)', textDecoration: 'none' }}>
            {src.name}
          </a>
          <div style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {shortUrl}
          </div>
        </div>
      </div>

      {/* Description */}
      {src.description && (
        <div style={{ fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.5 }}>{src.description}</div>
      )}

      {/* Badges */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 8px', borderRadius: 99, background: domStyle.bg, color: domStyle.color }}>
          {src.domain}
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-2)', color: tm.color, display: 'flex', alignItems: 'center', gap: 4 }}>
          {tm.icon} {tm.label}
        </span>
      </div>

      {/* Footer: votes + submitter */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Upvote */}
          <button
            onClick={() => isAuthenticated && onVote(src.id, 1)}
            title={isAuthenticated ? 'Upvote' : 'Sign in to vote'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line-1)',
              background: src.my_vote === 1 ? 'rgba(16,185,129,0.15)' : 'var(--bg-2)',
              color: src.my_vote === 1 ? '#10b981' : 'var(--fg-3)',
              cursor: isAuthenticated ? 'pointer' : 'default',
              fontWeight: 700, fontSize: 12, transition: 'all 0.15s',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 2L11 8H1L6 2Z" fill="currentColor"/></svg>
            {src.upvotes}
          </button>

          {/* Downvote */}
          <button
            onClick={() => isAuthenticated && onVote(src.id, -1)}
            title={isAuthenticated ? 'Downvote' : 'Sign in to vote'}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 10px', borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line-1)',
              background: src.my_vote === -1 ? 'rgba(239,68,68,0.15)' : 'var(--bg-2)',
              color: src.my_vote === -1 ? '#ef4444' : 'var(--fg-3)',
              cursor: isAuthenticated ? 'pointer' : 'default',
              fontWeight: 700, fontSize: 12, transition: 'all 0.15s',
            }}
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 10L1 4H11L6 10Z" fill="currentColor"/></svg>
            {src.downvotes}
          </button>

          {/* Score */}
          <span style={{ fontSize: 11, color: src.score > 0 ? '#10b981' : src.score < 0 ? '#ef4444' : 'var(--fg-4)', fontWeight: 700 }}>
            {src.score > 0 ? '+' : ''}{src.score}
          </span>
        </div>

        {src.submitted_by && (
          <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>by {src.submitted_by}</span>
        )}
      </div>
    </div>
  );
}

export default function SourcesPage({ isDark, toggleDark }) {
  const { isAuthenticated } = useAuth();
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState('all');
  const [sort, setSort] = useState('hot');
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await sourcesApi.list({ domain: domain === 'all' ? undefined : domain, sort });
      setSources(data.sources || []);
    } finally {
      setLoading(false);
    }
  }, [domain, sort]);

  useEffect(() => { load(); }, [load]);

  const handleVote = async (id, vote) => {
    await sourcesApi.vote(id, vote);
    setSources(prev => prev.map(s => {
      if (s.id !== id) return s;
      const wasVote = s.my_vote;
      let up = s.upvotes, down = s.downvotes;
      if (wasVote === vote) {
        if (vote === 1) up--;
        else down--;
        return { ...s, upvotes: up, downvotes: down, score: up - down, my_vote: 0 };
      }
      if (wasVote === 1) up--;
      if (wasVote === -1) down--;
      if (vote === 1) up++;
      else down++;
      return { ...s, upvotes: up, downvotes: down, score: up - down, my_vote: vote };
    }));
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', color: 'var(--fg-1)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 20px' }}>
        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Wall of Sources</h1>
            <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: '4px 0 0' }}>
              Community-curated news sources — vote up the best ones
            </p>
          </div>
          {isAuthenticated && (
            <button
              onClick={() => setShowAdd(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 'var(--r-sm)', background: 'var(--fg-1)', color: 'var(--bg-0)', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
              Add Source
            </button>
          )}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          {/* Domain tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DOMAINS.map(d => {
              const col = d !== 'all' ? (DOMAIN_COLORS[d] || DOMAIN_COLORS.general) : null;
              const active = domain === d;
              return (
                <button
                  key={d}
                  onClick={() => setDomain(d)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                    borderColor: active ? (col?.color || 'var(--fg-1)') : 'var(--line-1)',
                    background: active ? (col?.bg || 'var(--bg-2)') : 'transparent',
                    color: active ? (col?.color || 'var(--fg-1)') : 'var(--fg-3)',
                    transition: 'all 0.15s',
                  }}
                >
                  {d === 'all' ? 'All' : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              );
            })}
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', gap: 4 }}>
            {['hot', 'new'].map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                style={{
                  padding: '4px 12px', borderRadius: 'var(--r-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--line-1)',
                  background: sort === s ? 'var(--bg-2)' : 'transparent',
                  color: sort === s ? 'var(--fg-1)' : 'var(--fg-4)',
                }}
              >
                {s === 'hot' ? 'Hot' : 'New'}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--fg-4)', fontSize: 13 }}>Loading sources...</div>
        ) : sources.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--fg-4)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🌐</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>No sources yet</div>
            <div style={{ fontSize: 13 }}>Be the first to add a great source!</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
            {sources.map(src => (
              <SourceCard key={src.id} src={src} onVote={handleVote} isAuthenticated={isAuthenticated} />
            ))}
          </div>
        )}

        {!isAuthenticated && (
          <div style={{ marginTop: 24, textAlign: 'center', padding: '12px', borderRadius: 'var(--r-md)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--fg-3)' }}>
            <a href="/login" style={{ color: 'var(--fg-1)', fontWeight: 600 }}>Sign in</a> to add sources and vote
          </div>
        )}
      </div>

      {showAdd && <AddSourceModal onClose={() => setShowAdd(false)} onAdded={load} />}
    </div>
  );
}
