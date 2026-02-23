import React, { useState, useEffect, useRef } from 'react';
import Header from '@/components/Header';
import { COUNTRIES, CATEGORIES } from '@/utils/helpers';
import { Play, Square, CheckCircle, XCircle, Loader2, Clock, Zap, AlertTriangle } from 'lucide-react';

const STATUS_ICON = {
  saved:      <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />,
  skipped:    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />,
  error:      <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />,
  processing: <Loader2 className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5 animate-spin" />,
};

const STATUS_COLOR = {
  saved:      'text-green-400',
  skipped:    'text-yellow-400',
  error:      'text-red-400',
  processing: 'text-blue-400',
};

export default function AdminPage({ isDark, toggleDark }) {
  const [selectedCountries, setSelectedCountries] = useState(['USA']);
  const [selectedTopics, setSelectedTopics]       = useState(['policy']);
  const [isRunning, setIsRunning]                 = useState(false);
  const [stats, setStats]                         = useState(null);
  const [error, setError]                         = useState(null);
  const pollRef = useRef(null);
  const logRef  = useRef(null);

  const topics = [
    { id: 'policy',     name: 'Policy & Governance' },
    { id: 'economy',    name: 'Economy' },
    { id: 'business',   name: 'Business' },
    { id: 'technology', name: 'Science & Technology' },
  ];

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [stats?.log]);

  useEffect(() => () => clearInterval(pollRef.current), []);

  const toggleCountry = (code) =>
    setSelectedCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

  const toggleTopic = (id) =>
    setSelectedTopics(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  const startPolling = () => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch('http://localhost:8000/api/admin/scraping/progress');
        const data = await res.json();
        setStats(data.stats);
        if (data.status !== 'running') {
          clearInterval(pollRef.current);
          setIsRunning(false);
        }
      } catch {
        clearInterval(pollRef.current);
        setIsRunning(false);
      }
    }, 800);
  };

  const handleStart = async () => {
    if (!selectedCountries.length || !selectedTopics.length) {
      setError('Select at least one country and one topic');
      return;
    }
    setError(null);
    setStats(null);
    setIsRunning(true);
    try {
      const res = await fetch('http://localhost:8000/api/admin/scraping/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countries: selectedCountries,
          topics:    selectedTopics,
          date:      new Date().toISOString().split('T')[0],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      startPolling();
    } catch (err) {
      setError(err.message || 'Failed to start');
      setIsRunning(false);
    }
  };

  const handleStop = async () => {
    try {
      await fetch('http://localhost:8000/api/admin/scraping/stop', { method: 'POST' });
    } catch {}
    clearInterval(pollRef.current);
    setIsRunning(false);
  };

  const total     = stats?.total_to_process || 0;
  const done      = (stats?.articles_processed || 0) + (stats?.articles_skipped || 0) + (stats?.errors || 0);
  const pct       = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const elapsed   = stats?.started_at
    ? Math.round((Date.now() - new Date(stats.started_at).getTime()) / 1000)
    : 0;
  const rate      = elapsed > 0 && done > 0 ? done / elapsed : 0;
  const remaining = rate > 0 && total > done ? Math.round((total - done) / rate) : null;

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Header card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 border border-transparent dark:border-gray-700">
            <h1 className="text-3xl font-bold text-secondary-900 dark:text-white mb-1">News Research</h1>
            <p className="text-secondary-500 dark:text-gray-400 mb-6">AI-powered global news scraper with live observability</p>

            {/* Country selector */}
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-secondary-700 dark:text-gray-300 uppercase tracking-wider mb-3">Countries</h2>
              <div className="flex flex-wrap gap-2">
                {COUNTRIES.map(c => (
                  <button key={c.code} onClick={() => !isRunning && toggleCountry(c.code)}
                    disabled={isRunning}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${selectedCountries.includes(c.code)
                        ? 'bg-primary-600 text-white shadow'
                        : 'bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'}
                      ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {c.flag} {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Topic selector */}
            <div className="mb-8">
              <h2 className="text-sm font-semibold text-secondary-700 dark:text-gray-300 uppercase tracking-wider mb-3">Topics</h2>
              <div className="flex flex-wrap gap-2">
                {topics.map(t => (
                  <button key={t.id} onClick={() => !isRunning && toggleTopic(t.id)}
                    disabled={isRunning}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                      ${selectedTopics.includes(t.id)
                        ? 'bg-green-600 text-white shadow'
                        : 'bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'}
                      ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}>
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Estimated scope */}
            {!isRunning && (
              <div className="mb-6 p-3 bg-secondary-50 dark:bg-gray-700/50 rounded-lg text-sm text-secondary-600 dark:text-gray-400">
                <Zap className="inline h-4 w-4 mr-1 text-yellow-500" />
                Estimated: <strong className="dark:text-gray-200">{selectedCountries.length * selectedTopics.length * 5}</strong> articles across&nbsp;
                <strong className="dark:text-gray-200">{selectedCountries.length}</strong> {selectedCountries.length === 1 ? 'country' : 'countries'},&nbsp;
                <strong className="dark:text-gray-200">{selectedTopics.length}</strong> {selectedTopics.length === 1 ? 'topic' : 'topics'} &nbsp;·&nbsp;
                ~<strong className="dark:text-gray-200">{selectedCountries.length * selectedTopics.length * 30}s</strong> approx
              </div>
            )}

            {/* Start / Stop */}
            {isRunning ? (
              <button onClick={handleStop}
                className="w-full py-4 rounded-xl font-semibold text-lg bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-3 shadow-lg">
                <Square className="h-5 w-5" /> Stop Research
              </button>
            ) : (
              <button onClick={handleStart}
                className="w-full py-4 rounded-xl font-semibold text-lg bg-primary-600 hover:bg-primary-700 text-white flex items-center justify-center gap-3 shadow-lg">
                <Play className="h-5 w-5" /> Start Research
              </button>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm flex gap-2">
                <XCircle className="h-4 w-4 shrink-0 mt-0.5" /> {error}
              </div>
            )}
          </div>

          {/* Live observability panel */}
          {stats && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 space-y-5 border border-transparent dark:border-gray-700">

              {/* Status banner */}
              <div className="flex items-center gap-3">
                {stats.status === 'running'
                  ? <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
                  : stats.status === 'completed'
                  ? <CheckCircle className="h-5 w-5 text-green-500" />
                  : <XCircle className="h-5 w-5 text-red-500" />}
                <div>
                  <p className="font-semibold text-secondary-900 dark:text-white capitalize">
                    {stats.status === 'running' ? 'Research in Progress…' : `Research ${stats.status}`}
                  </p>
                  {stats.current_country && stats.status === 'running' && (
                    <p className="text-xs text-secondary-500 dark:text-gray-400">
                      Processing: <strong>{stats.current_country}</strong> › <strong>{stats.current_topic}</strong>
                      {stats.current_article && <> › "{stats.current_article}"</>}
                    </p>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-1 text-xs text-secondary-500 dark:text-gray-400">
                  <Clock className="h-3.5 w-3.5" />
                  {elapsed}s elapsed
                  {remaining !== null && stats.status === 'running' && (
                    <span className="ml-2">· ~{remaining}s left</span>
                  )}
                </div>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-secondary-500 dark:text-gray-400 mb-1">
                  <span>{done} / {total} articles</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 bg-secondary-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'Found',   value: stats.total_articles_found, color: 'text-secondary-900 dark:text-white' },
                  { label: 'Saved',   value: stats.articles_processed,   color: 'text-green-600 dark:text-green-400' },
                  { label: 'Skipped', value: stats.articles_skipped,     color: 'text-yellow-600 dark:text-yellow-400' },
                  { label: 'Errors',  value: stats.errors,               color: 'text-red-600 dark:text-red-400' },
                ].map(s => (
                  <div key={s.label} className="bg-secondary-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-secondary-500 dark:text-gray-400">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value || 0}</p>
                  </div>
                ))}
              </div>

              {/* Categories found */}
              {stats.categories_found?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {stats.categories_found.map(cat => {
                    const c = CATEGORIES.find(x => x.id === cat);
                    return (
                      <span key={cat} className="px-3 py-1 bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-300 rounded-full text-xs font-medium">
                        {c?.icon} {c?.name || cat}
                      </span>
                    );
                  })}
                </div>
              )}

              {/* Live log feed */}
              {stats.log?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-secondary-500 dark:text-gray-400 uppercase tracking-wider mb-2">Live Feed</p>
                  <div ref={logRef}
                    className="h-48 overflow-y-auto rounded-lg p-3 space-y-1 font-mono text-xs"
                    style={{ background: '#0f172a' }}>
                    {[...stats.log].reverse().map((entry, i) => (
                      <div key={i} className="flex items-start gap-2">
                        {STATUS_ICON[entry.status] || STATUS_ICON.processing}
                        <span className={STATUS_COLOR[entry.status] || 'text-blue-400'}>
                          [{entry.status?.toUpperCase()}]
                        </span>
                        <span className="text-slate-300 truncate">{entry.title}</span>
                        {entry.dna_code && (
                          <span className="text-slate-500 shrink-0">{entry.dna_code}</span>
                        )}
                        {entry.reason && (
                          <span className="text-slate-500 shrink-0 italic">{entry.reason}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
