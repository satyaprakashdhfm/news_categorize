import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { browserResearchApi, feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

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

export default function ProfilePage({ isDark, toggleDark }) {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [myPins, setMyPins] = useState([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [openRun, setOpenRun] = useState(null);
  const [runData, setRunData] = useState(null);
  const [runLoading, setRunLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
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

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="main" style={{ maxWidth: 800, margin: '0 auto', padding: '0 24px 40px' }}>
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
                      color: 'inherit', display: 'block',
                      transition: 'background 0.15s',
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
                        fontSize: 'var(--t-meta)', fontWeight: 600,
                        transition: 'transform 0.2s',
                        transform: openRun === h.run_id ? 'rotate(180deg)' : 'none',
                        color: 'var(--fg-3)',
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
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 8, maxHeight: 256, overflowY: 'auto' }}>
                          {(runData.blogs || []).slice(0, 10).map((b, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--t-meta)' }}>
                              <span style={{
                                flexShrink: 0, padding: '1px 6px', borderRadius: 'var(--r-sm)',
                                fontWeight: 700, textTransform: 'uppercase', fontSize: 10,
                                background: b.source === 'reddit' ? 'rgba(232,145,60,0.12)' : b.source === 'youtube' ? 'rgba(240,110,110,0.12)' : 'var(--accent-soft)',
                                color: b.source === 'reddit' ? '#E8913C' : b.source === 'youtube' ? 'var(--signal-critical)' : 'var(--accent)',
                              }}>{b.source}</span>
                              <span style={{ color: 'var(--fg-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</span>
                              {b.url && (
                                <a href={b.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                                  style={{ flexShrink: 0, color: 'var(--accent)' }}>
                                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 10 L10 4 M10 4 H5.5 M10 4 V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                </a>
                              )}
                            </div>
                          ))}
                          {(runData.blogs || []).length > 10 && (
                            <p className="meta" style={{ paddingTop: 4 }}>+{runData.blogs.length - 10} more items</p>
                          )}
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
