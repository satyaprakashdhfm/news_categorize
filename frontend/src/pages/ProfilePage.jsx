import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { browserResearchApi, feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/helpers';
import { RefreshCw, ExternalLink } from 'lucide-react';

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
    <div className="w-16 h-16 rounded-2xl bg-primary-600 dark:bg-primary-700 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
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
    } catch {
      // silent
    } finally {
      setPinsLoading(false);
    }
  };

  const openRunDetail = async (runId) => {
    if (openRun === runId) {
      setOpenRun(null);
      setRunData(null);
      return;
    }
    setOpenRun(runId);
    setRunLoading(true);
    try {
      const res = await browserResearchApi.getRun(runId);
      setRunData(res);
    } catch {
      setRunData(null);
    } finally {
      setRunLoading(false);
    }
  };

  const joinedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">

        {/* User Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm p-6">
          <div className="flex items-center gap-4">
            <InitialsAvatar name={user?.name} />
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">{user?.name}</h1>
                {user?.role === 'admin' && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-400 text-amber-900">Admin</span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{user?.email}</p>
              {joinedDate && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Member since {joinedDate}</p>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-5 flex items-center gap-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{pinsLoading ? '…' : myPins.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Cards in feed</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{historyLoading ? '…' : history.length}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Research runs</p>
            </div>
          </div>
        </div>

        {/* Research History */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Research History</h2>
            <button
              onClick={loadHistory}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4 text-gray-400', historyLoading && 'animate-spin')} />
            </button>
          </div>

          {historyError && (
            <p className="px-5 py-3 text-sm text-red-600 dark:text-red-400">{historyError}</p>
          )}

          {historyLoading && !history.length ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-500">
              No research runs yet. Use the Browser Research page to start.
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {history.map((h) => (
                <div key={h.run_id}>
                  <button
                    onClick={() => openRunDetail(h.run_id)}
                    className="w-full text-left px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">{h.query}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-gray-400 dark:text-gray-500 flex-wrap">
                          <span>{new Date(h.generated_at).toLocaleString()}</span>
                          <span>{h.total_blogs} items</span>
                          {h.llm_usage && (
                            <span>{fmtInt(h.llm_usage.total_tokens)} tokens · {fmtUsd(h.llm_usage.estimated_cost_usd)}</span>
                          )}
                        </div>
                      </div>
                      <span className={cn('text-xs font-semibold transition-transform', openRun === h.run_id ? 'rotate-180' : '')}>
                        ▾
                      </span>
                    </div>
                  </button>

                  {openRun === h.run_id && (
                    <div className="px-5 pb-4 bg-gray-50 dark:bg-gray-700/20">
                      {runLoading ? (
                        <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
                          <div className="w-4 h-4 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                          Loading…
                        </div>
                      ) : runData ? (
                        <div className="space-y-2 pt-2 max-h-64 overflow-y-auto">
                          {(runData.blogs || []).slice(0, 10).map((b, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-xs">
                              <span className={cn(
                                'flex-shrink-0 px-1.5 py-0.5 rounded font-bold uppercase',
                                b.source === 'reddit' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' :
                                b.source === 'youtube' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' :
                                'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                              )}>{b.source}</span>
                              <span className="text-gray-700 dark:text-gray-300 line-clamp-1 flex-1">{b.title}</span>
                              {b.url && (
                                <a href={b.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex-shrink-0 text-primary-500 hover:text-primary-700">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
                          ))}
                          {(runData.blogs || []).length > 10 && (
                            <p className="text-xs text-gray-400 pt-1">+{runData.blogs.length - 10} more items</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 py-2">Could not load run details.</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
