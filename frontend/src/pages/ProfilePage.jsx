import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { authApi, browserResearchApi, feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { INTEREST_TREE } from '@/utils/helpers';

const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'US Eastern (ET)' },
  { value: 'America/Chicago', label: 'US Central (CT)' },
  { value: 'America/Denver', label: 'US Mountain (MT)' },
  { value: 'America/Los_Angeles', label: 'US Pacific (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Kolkata', label: 'India (IST)' },
  { value: 'Asia/Shanghai', label: 'China (CST)' },
  { value: 'Asia/Tokyo', label: 'Japan (JST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST)' },
];

function fmtInt(value) {
  return Number(value || 0).toLocaleString();
}

function fmtUsd(value) {
  return `$${Number(value || 0).toFixed(6)}`;
}

function InitialsAvatar({ name }) {
  const initials = (name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <div style={{
      width: 56, height: 56, borderRadius: 'var(--r-xl)',
      background: 'var(--accent)', color: 'var(--fg-on-accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)',
    }}>
      {initials}
    </div>
  );
}

// ── Chip used for subdomain toggles ──────────────────────────────────────────
function InterestChip({ label, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '5px 13px',
        borderRadius: 'var(--r-pill)',
        fontSize: 13,
        fontWeight: active ? 600 : 400,
        cursor: 'pointer',
        transition: 'all 0.15s',
        border: `1.5px solid ${active ? color : 'var(--line-1)'}`,
        background: active ? `color-mix(in srgb, ${color} 18%, var(--bg-1))` : 'var(--bg-1)',
        color: active ? color : 'var(--fg-3)',
        whiteSpace: 'nowrap',
      }}
    >
      {active && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M2 5 L4 7 L8 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
      {label}
    </button>
  );
}

// ── Single domain group (always visible chips) ────────────────────────────────
function DomainGroup({ domain, interests, onToggle }) {
  const activeSubCount = domain.subdomains.filter(s => interests.includes(s.code)).length;

  return (
    <div style={{
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden',
      background: 'var(--bg-1)',
      border: '1px solid var(--line-1)',
      borderLeft: `3px solid ${activeSubCount > 0 ? domain.color : 'var(--line-1)'}`,
      transition: 'border-color 0.2s',
    }}>
      {/* Domain header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 16px',
        background: activeSubCount > 0 ? `color-mix(in srgb, ${domain.color} 5%, var(--bg-1))` : 'transparent',
        borderBottom: '1px solid var(--line-1)',
      }}>
        <span style={{ fontSize: 16 }}>{domain.icon}</span>
        <span style={{
          fontWeight: 700, fontSize: 'var(--t-body)',
          color: activeSubCount > 0 ? domain.color : 'var(--fg-1)',
        }}>
          {domain.label}
        </span>
        {activeSubCount > 0 && (
          <span style={{
            marginLeft: 'auto',
            padding: '2px 8px', borderRadius: 'var(--r-pill)',
            fontSize: 11, fontWeight: 700,
            background: `color-mix(in srgb, ${domain.color} 15%, transparent)`,
            color: domain.color,
          }}>
            {activeSubCount} selected
          </span>
        )}
      </div>

      {/* Subdomain chips — always visible */}
      <div style={{
        padding: '12px 16px',
        display: 'flex', flexWrap: 'wrap', gap: 6,
      }}>
        {domain.subdomains.map((sub) => (
          <InterestChip
            key={sub.code}
            label={sub.label}
            active={interests.includes(sub.code)}
            color={domain.color}
            onClick={() => onToggle(sub.code)}
          />
        ))}
      </div>
    </div>
  );
}

// ── ProfilePage ───────────────────────────────────────────────────────────────
export default function ProfilePage({ isDark, toggleDark }) {
  const { user, setUser, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [myPins, setMyPins] = useState([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [openRun, setOpenRun] = useState(null);
  const [runData, setRunData] = useState(null);
  const [runLoading, setRunLoading] = useState(false);

  const [interests, setInterests] = useState([]);
  const [interestsSaving, setInterestsSaving] = useState(false);
  const [interestsSaved, setInterestsSaved] = useState(false);

  const [tz, setTz] = useState('UTC');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    setInterests(user?.interests || []);
    setTz(user?.timezone || 'UTC');
    loadHistory();
    loadPins();
  }, [isAuthenticated]);

  const loadHistory = async () => {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const res = await browserResearchApi.getHistory({ limit: 50 });
      setHistory(res?.runs || []);
    } catch (err) {
      setHistoryError(err?.response?.data?.detail || 'Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadPins = async () => {
    setPinsLoading(true);
    try {
      const pins = await feedCardsApi.getMyFeed();
      setMyPins(pins || []);
    } catch { /* silent */ } finally {
      setPinsLoading(false);
    }
  };

  const openRunDetail = async (runId) => {
    if (openRun === runId) { setOpenRun(null); setRunData(null); return; }
    setOpenRun(runId);
    setRunLoading(true);
    try {
      const res = await browserResearchApi.getRun(runId);
      setRunData(res);
    } catch { setRunData(null); } finally { setRunLoading(false); }
  };

  const toggleInterest = (code) => {
    setInterests((prev) => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
    setInterestsSaved(false);
  };

  const saveInterests = async () => {
    setInterestsSaving(true);
    try {
      const updated = await authApi.updateInterests(interests);
      setUser(updated);
      setInterestsSaved(true);
      setTimeout(() => setInterestsSaved(false), 2500);
    } catch { /* silent */ } finally {
      setInterestsSaving(false);
    }
  };

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      const updated = await authApi.updateProfile({ timezone: tz });
      setUser(updated);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch { /* silent */ } finally {
      setProfileSaving(false);
    }
  };

  const totalSubSelected = INTEREST_TREE.reduce(
    (acc, d) => acc + d.subdomains.filter(s => interests.includes(s.code)).length, 0
  );

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 40px' }}>
        {/* User Info Card */}
        <div className="panel" style={{ marginTop: 32, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <InitialsAvatar name={user?.name} />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>{user?.name}</h1>
                {user?.role === 'admin' && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    padding: '2px 8px', borderRadius: 'var(--r-sm)',
                    background: 'rgba(232,182,92,0.15)', color: 'var(--signal-warn)',
                  }}>Admin</span>
                )}
              </div>
              <p className="meta" style={{ marginTop: 4 }}>{user?.email}</p>
              {joinedDate && <p className="meta" style={{ marginTop: 2, color: 'var(--fg-4)' }}>Member since {joinedDate}</p>}
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', gap: 32, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--line-1)' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
                {pinsLoading ? '...' : myPins.length}
              </p>
              <p className="meta" style={{ marginTop: 2 }}>Cards in feed</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
                {historyLoading ? '...' : history.length}
              </p>
              <p className="meta" style={{ marginTop: 2 }}>Research runs</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
                {totalSubSelected}
              </p>
              <p className="meta" style={{ marginTop: 2 }}>Interests tracked</p>
            </div>
          </div>
        </div>

        {/* Timezone */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 700, color: 'var(--fg-1)', margin: '0 0 4px' }}>
            Timezone
          </h2>
          <p className="meta" style={{ marginBottom: 16 }}>
            Sets your recommendation batch labels (morning / afternoon / evening).
          </p>

          <div style={{ maxWidth: 300 }}>
            <select
              value={tz}
              onChange={(e) => { setTz(e.target.value); setProfileSaved(false); }}
              style={{
                width: '100%', padding: '8px 12px',
                borderRadius: 'var(--r-md)', border: '1.5px solid var(--line-1)',
                background: 'var(--bg-0)', color: 'var(--fg-1)',
                fontSize: 'var(--t-body)', cursor: 'pointer',
              }}
            >
              {TIMEZONE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 16,
            padding: '14px 0 0', borderTop: '1px solid var(--line-1)',
          }}>
            <button
              className="btn btn--primary"
              onClick={saveProfile}
              disabled={profileSaving}
              style={{ minWidth: 140 }}
            >
              {profileSaving ? 'Saving...' : profileSaved ? 'Saved!' : 'Save Timezone'}
            </button>
            <span className="meta" style={{ color: 'var(--fg-4)' }}>
              News from all 8 countries automatically
            </span>
          </div>
        </div>

        {/* Interests Panel */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <div>
              <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>
                Your Interests
              </h2>
              <p className="meta" style={{ marginTop: 4 }}>
                Pick specific topics — used to generate your personalised <strong style={{ color: 'var(--fg-2)' }}>For You</strong> feed from Google News, Reddit, YouTube, Hacker News and RSS.
              </p>
            </div>
            {totalSubSelected > 0 && (
              <span style={{
                flexShrink: 0, marginLeft: 12, padding: '3px 10px',
                borderRadius: 'var(--r-pill)', fontSize: 'var(--t-micro)', fontWeight: 700,
                background: 'var(--accent-soft)', color: 'var(--accent)',
              }}>
                {totalSubSelected} selected
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
            {INTEREST_TREE.map((domain) => (
              <DomainGroup
                key={domain.code}
                domain={domain}
                interests={interests}
                onToggle={toggleInterest}
              />
            ))}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, marginTop: 16,
            padding: '14px 0 0', borderTop: '1px solid var(--line-1)',
          }}>
            <button
              className="btn btn--primary"
              onClick={saveInterests}
              disabled={interestsSaving}
              style={{ minWidth: 140 }}
            >
              {interestsSaving ? 'Saving…' : interestsSaved ? '✓ Saved!' : 'Save Interests'}
            </button>
            <span className="meta" style={{ color: totalSubSelected === 0 ? 'var(--signal-warn)' : 'var(--fg-4)' }}>
              {totalSubSelected === 0
                ? 'Select at least one topic to enable recommendations'
                : `${totalSubSelected} topic${totalSubSelected !== 1 ? 's' : ''} selected across all categories`}
            </span>
          </div>
        </div>

        {/* Research History */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 24px', borderBottom: '1px solid var(--line-1)',
          }}>
            <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Research History</h2>
            <button className="iconbtn" onClick={loadHistory} title="Refresh">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={historyLoading ? { animation: 'spin 1s linear infinite' } : undefined}>
                <path d="M2 7 A5 5 0 0 1 12 7 M12 4 V7 H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 7 A5 5 0 0 1 2 7 M2 10 V7 H5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>

          {historyError && <p style={{ padding: '12px 24px', color: 'var(--signal-critical)', fontSize: 'var(--t-meta)' }}>{historyError}</p>}

          {historyLoading && !history.length ? (
            <div className="empty">
              <div style={{ width: 24, height: 24, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : history.length === 0 ? (
            <div className="empty">
              <p className="empty__text">No research runs yet. Use the Browser Research page to start.</p>
            </div>
          ) : (
            <div>
              {history.map((h) => (
                <div key={h.run_id} style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <button
                    onClick={() => openRunDetail(h.run_id)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '16px 24px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'inherit', display: 'block', transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-2)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--fg-1)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.query}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                          <span className="meta">{new Date(h.generated_at).toLocaleString()}</span>
                          <span className="meta">{h.total_blogs} items</span>
                          {h.llm_usage && (
                            <span className="meta mono">{fmtInt(h.llm_usage.total_tokens)} tokens · {fmtUsd(h.llm_usage.estimated_cost_usd)}</span>
                          )}
                        </div>
                      </div>
                      <span style={{
                        fontSize: 'var(--t-meta)', fontWeight: 600, color: 'var(--fg-3)',
                        transition: 'transform 0.2s',
                        transform: openRun === h.run_id ? 'rotate(180deg)' : 'none',
                      }}>▾</span>
                    </div>
                  </button>

                  {openRun === h.run_id && (
                    <div style={{ padding: '0 24px 16px', background: 'var(--bg-2)' }}>
                      {runLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                          <div style={{ width: 16, height: 16, border: '1.5px solid var(--fg-3)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                          <span className="meta">Loading...</span>
                        </div>
                      ) : runData ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, maxHeight: 480, overflowY: 'auto' }}>
                          {(runData.blogs || []).map((b, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--t-meta)' }}>
                              <span style={{
                                flexShrink: 0, padding: '1px 6px', borderRadius: 'var(--r-sm)',
                                fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                                background: b.source === 'reddit' ? 'rgba(232,145,60,0.12)' : b.source === 'youtube' ? 'rgba(240,110,110,0.12)' : b.source === 'hackernews' ? 'rgba(255,102,0,0.12)' : b.source === 'twitter' ? 'rgba(29,161,242,0.12)' : 'var(--accent-soft)',
                                color: b.source === 'reddit' ? '#E8913C' : b.source === 'youtube' ? 'var(--signal-critical)' : b.source === 'hackernews' ? '#FF6600' : b.source === 'twitter' ? '#1DA1F2' : 'var(--accent)',
                              }}>{b.source === 'hackernews' ? 'HN' : b.source}</span>
                              <span style={{ color: 'var(--fg-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                              {b.url && (
                                <a href={b.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                  style={{ flexShrink: 0, color: 'var(--accent)' }}>
                                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 10 L10 4 M10 4 H5.5 M10 4 V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="meta" style={{ padding: '8px 0' }}>Could not load run details.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
