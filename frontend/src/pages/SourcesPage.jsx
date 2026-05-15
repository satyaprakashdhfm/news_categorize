import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import Header from '@/components/Header';
import { sourcesApi } from '@/services/api';
import { INTEREST_TREE, SUBCATEGORY_LABELS } from '@/utils/helpers';

// Top-level domain colours (matched to platform theme)
const TOP_COLORS = {
  TEC: { bg: 'rgba(249,115,22,0.12)',  color: '#f97316' },
  BUS: { bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6' },
  POL: { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6' },
  ECO: { bg: 'rgba(16,185,129,0.12)', color: '#10b981' },
  OTH: { bg: 'rgba(100,116,139,0.12)',color: '#64748b' },
};

// All subdomain colours inherit from their parent
const getDomainColor = (code) => {
  if (TOP_COLORS[code]) return TOP_COLORS[code];
  for (const d of INTEREST_TREE) {
    if (d.subdomains.some(s => s.code === code)) return TOP_COLORS[d.code] || TOP_COLORS.OTH;
  }
  return { bg: 'rgba(100,116,139,0.12)', color: '#64748b' };
};

const getLabel = (code) => SUBCATEGORY_LABELS[code] || code;

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

function SourceFormModal({ onClose, onDone, existing }) {
  const isEdit = !!existing;
  const [form, setForm] = useState({
    name: existing?.name || '',
    url: existing?.url || '',
    description: existing?.description || '',
    domain: existing?.domain || 'TEC',
    source_type: existing?.source_type || 'web',
  });
  const [aiDetecting, setAiDetecting] = useState(false);
  const [aiDone, setAiDone] = useState(isEdit);
  const [showDomainPicker, setShowDomainPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const detectTimer = useRef(null);

  const detectSourceType = (url) => {
    const u = url.toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
    if (u.includes('twitter.com') || u.includes('x.com')) return 'twitter';
    if (u.includes('reddit.com')) return 'reddit';
    return 'web';
  };

  const triggerAiDetect = (name, url) => {
    if (!url) return;
    setAiDone(false);
    clearTimeout(detectTimer.current);
    detectTimer.current = setTimeout(async () => {
      setAiDetecting(true);
      try {
        const res = await sourcesApi.detectInfo(name, url);
        setForm(f => ({
          ...f,
          domain: res.domain || f.domain,
          description: res.description || f.description,
          source_type: detectSourceType(url),
        }));
        setAiDone(true);
      } catch { /* keep current */ }
      finally { setAiDetecting(false); }
    }, 900);
  };

  const handleUrlChange = (val) => {
    setForm(f => ({ ...f, url: val, source_type: detectSourceType(val) }));
    triggerAiDetect(form.name, val);
  };

  const submit = async () => {
    if (!form.name.trim() || !form.url.trim()) { setErr('Name and URL are required'); return; }
    if (!form.description.trim()) { setErr('Waiting for AI description — or type one yourself'); return; }
    setSaving(true); setErr('');
    try {
      if (isEdit) await sourcesApi.edit(existing.id, form);
      else await sourcesApi.add(form);
      onDone(); onClose();
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Failed to save');
    } finally { setSaving(false); }
  };

  const tm = TYPE_META[form.source_type || 'web'] || TYPE_META.web;
  const domStyle = getDomainColor(form.domain);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'var(--bg-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', padding: 28, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{isEdit ? 'Edit Source' : 'Add a Source'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-3)', fontSize: 18 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Name */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. The Batch — DeepLearning.AI"
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--bg-0)', color: 'var(--fg-1)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          {/* URL — AI triggers from here */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>URL *</label>
            <input value={form.url} onChange={e => handleUrlChange(e.target.value)}
              placeholder="https://..."
              style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--bg-0)', color: 'var(--fg-1)', fontSize: 13, boxSizing: 'border-box' }} />
          </div>

          {/* AI preview card — shown after URL typed */}
          {form.url && (
            <div style={{ borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--bg-2)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>

              {aiDetecting ? (
                <div style={{ fontSize: 12, color: 'var(--fg-4)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: 'var(--fg-4)', animation: 'pulse 1s infinite' }} />
                  AI is reading the page...
                </div>
              ) : (
                <>
                  {/* Type + Domain badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 99, background: 'var(--bg-1)', border: '1px solid var(--line-1)', color: tm.color }}>
                      {tm.icon} {tm.label}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: domStyle.bg, color: domStyle.color }}>
                      {getLabel(form.domain)}
                    </span>
                    <button onClick={() => setShowDomainPicker(p => !p)}
                      style={{ fontSize: 10, color: 'var(--fg-4)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}>
                      {showDomainPicker ? 'done' : 'change domain'}
                    </button>
                  </div>

                  {/* Domain picker — collapsed by default */}
                  {showDomainPicker && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {INTEREST_TREE.map(parent => {
                        const pc = TOP_COLORS[parent.code];
                        return (
                          <div key={parent.code}>
                            <div style={{ fontSize: 9, fontWeight: 700, color: pc.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>{parent.label}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {parent.subdomains.map(s => {
                                const active = form.domain === s.code;
                                return (
                                  <button key={s.code} onClick={() => { setForm(f => ({ ...f, domain: s.code })); setShowDomainPicker(false); }}
                                    style={{ padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 600, cursor: 'pointer',
                                      border: `1px solid ${active ? pc.color : 'var(--line-1)'}`,
                                      background: active ? pc.bg : 'transparent',
                                      color: active ? pc.color : 'var(--fg-4)' }}>
                                    {s.label}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Description — editable */}
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder={aiDone ? '' : 'AI will fill this from the page...'}
                    rows={2}
                    style={{ width: '100%', padding: '6px 8px', borderRadius: 'var(--r-sm)', border: `1px solid ${!form.description.trim() && err ? 'var(--signal-err)' : 'var(--line-1)'}`, background: 'var(--bg-0)', color: 'var(--fg-1)', fontSize: 12, resize: 'vertical', boxSizing: 'border-box' }} />
                </>
              )}
            </div>
          )}

          {err && <div style={{ fontSize: 12, color: 'var(--signal-err)' }}>{err}</div>}

          <button onClick={submit} disabled={saving || aiDetecting}
            style={{ padding: '9px 0', borderRadius: 'var(--r-sm)', background: 'var(--fg-1)', color: 'var(--bg-0)', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', opacity: (saving || aiDetecting) ? 0.6 : 1 }}>
            {saving ? 'Saving...' : aiDetecting ? 'Reading page...' : isEdit ? 'Save Changes' : 'Add Source'}
          </button>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ src, onVote, isAuthenticated, onEdit }) {
  const domStyle = getDomainColor(src.domain);
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
          {getLabel(src.domain)}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {src.submitted_by && (
            <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>by {src.submitted_by}</span>
          )}
          {src.is_mine && (
            <button onClick={() => onEdit(src)}
              title="Edit your source"
              style={{ background: 'none', border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)', padding: '2px 8px', cursor: 'pointer', fontSize: 10, fontWeight: 600, color: 'var(--fg-3)' }}>
              Edit
            </button>
          )}
        </div>
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
  const [editSrc, setEditSrc] = useState(null);

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
          {/* Domain tabs — top-level only, clicking shows all subdomains too */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {['all', ...INTEREST_TREE.map(d => d.code)].map(d => {
              const col = d !== 'all' ? TOP_COLORS[d] : null;
              const active = domain === d;
              return (
                <button key={d} onClick={() => setDomain(d)}
                  style={{
                    padding: '4px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid',
                    borderColor: active ? (col?.color || 'var(--fg-1)') : 'var(--line-1)',
                    background: active ? (col?.bg || 'var(--bg-2)') : 'transparent',
                    color: active ? (col?.color || 'var(--fg-1)') : 'var(--fg-3)',
                    transition: 'all 0.15s',
                  }}>
                  {d === 'all' ? 'All' : getLabel(d)}
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
              <SourceCard key={src.id} src={src} onVote={handleVote} isAuthenticated={isAuthenticated} onEdit={setEditSrc} />
            ))}
          </div>
        )}

        {!isAuthenticated && (
          <div style={{ marginTop: 24, textAlign: 'center', padding: '12px', borderRadius: 'var(--r-md)', background: 'var(--bg-2)', fontSize: 13, color: 'var(--fg-3)' }}>
            <a href="/login" style={{ color: 'var(--fg-1)', fontWeight: 600 }}>Sign in</a> to add sources and vote
          </div>
        )}
      </div>

      {showAdd && <SourceFormModal onClose={() => setShowAdd(false)} onDone={load} />}
      {editSrc && <SourceFormModal existing={editSrc} onClose={() => setEditSrc(null)} onDone={load} />}
    </div>
  );
}
