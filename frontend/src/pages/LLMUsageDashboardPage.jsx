import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import { browserResearchApi } from '@/services/api';

function fmtInt(value) {
  return Number(value || 0).toLocaleString();
}

function fmtUsd(value) {
  return `$${Number(value || 0).toFixed(6)}`;
}

export default function LLMUsageDashboardPage({ isDark, toggleDark }) {
  const [rows, setRows] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const byModel = useMemo(() => {
    const map = new Map();
    for (const row of rows) {
      const usage = row?.llm_usage;
      if (!usage) {
        continue;
      }
      const model = usage.model || 'unknown';
      if (!map.has(model)) {
        map.set(model, {
          model,
          runs: 0,
          calls: 0,
          prompt_tokens: 0,
          output_tokens: 0,
          total_tokens: 0,
          estimated_cost_usd: 0,
        });
      }
      const bucket = map.get(model);
      bucket.runs += 1;
      bucket.calls += Number(usage.calls || 0);
      bucket.prompt_tokens += Number(usage.prompt_tokens || 0);
      bucket.output_tokens += Number(usage.output_tokens || 0);
      bucket.total_tokens += Number(usage.total_tokens || 0);
      bucket.estimated_cost_usd += Number(usage.estimated_cost_usd || 0);
    }
    return Array.from(map.values()).sort((a, b) => b.total_tokens - a.total_tokens);
  }, [rows]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await browserResearchApi.getHistory({ limit: 100 });
      setRows(res?.runs || []);
      setTotals(res?.totals || null);
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Failed to load LLM usage history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-transparent dark:border-gray-700">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">LLM Usage Dashboard</h1>
              <p className="text-sm text-secondary-600 dark:text-gray-300 mt-1">
                Separate model-wise observability for each browser research run.
              </p>
            </div>
            <button
              onClick={load}
              className="px-3 py-2 rounded-lg text-sm font-semibold bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-200"
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-transparent dark:border-gray-700">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Model Summary</h2>
          {!byModel.length ? (
            <p className="text-sm text-secondary-600 dark:text-gray-300">No model usage found yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {byModel.map((m) => (
                <div key={m.model} className="rounded-lg bg-secondary-100 dark:bg-gray-900 p-4">
                  <p className="text-sm font-semibold text-secondary-900 dark:text-white break-all">{m.model}</p>
                  <p className="text-xs text-secondary-600 dark:text-gray-300 mt-2">Runs: {fmtInt(m.runs)} | Calls: {fmtInt(m.calls)}</p>
                  <p className="text-xs text-secondary-600 dark:text-gray-300">Tokens: {fmtInt(m.total_tokens)}</p>
                  <p className="text-xs text-secondary-600 dark:text-gray-300">Cost: {fmtUsd(m.estimated_cost_usd)}</p>
                </div>
              ))}
            </div>
          )}
          {totals ? (
            <p className="text-xs text-secondary-500 dark:text-gray-400 mt-4">
              All-history totals: {fmtInt(totals.calls)} calls, {fmtInt(totals.total_tokens)} tokens, {fmtUsd(totals.estimated_cost_usd)}.
            </p>
          ) : null}
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border border-transparent dark:border-gray-700">
          <h2 className="text-lg font-semibold text-secondary-900 dark:text-white mb-3">Run-by-Run Records</h2>

          {error ? <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p> : null}
          {loading ? <p className="text-sm text-secondary-600 dark:text-gray-300">Loading usage records...</p> : null}
          {!loading && !rows.length ? <p className="text-sm text-secondary-600 dark:text-gray-300">No usage records yet.</p> : null}

          {!loading && rows.length ? (
            <div className="overflow-x-auto rounded-lg border border-secondary-200 dark:border-gray-700">
              <table className="min-w-[640px] w-full text-sm">
                <thead className="bg-secondary-100 dark:bg-gray-900 text-secondary-700 dark:text-gray-200">
                  <tr>
                    <th className="text-left px-3 py-2 whitespace-nowrap">Time</th>
                    <th className="text-left px-3 py-2 whitespace-nowrap hidden sm:table-cell">Model</th>
                    <th className="text-left px-3 py-2">Query</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Calls</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap hidden md:table-cell">Prompt</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap hidden md:table-cell">Output</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Tokens</th>
                    <th className="text-right px-3 py-2 whitespace-nowrap">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const u = row?.llm_usage || {};
                    return (
                      <tr key={row.run_id} className="border-t border-secondary-200 dark:border-gray-700 text-secondary-800 dark:text-gray-200">
                        <td className="px-3 py-2 whitespace-nowrap text-xs">{new Date(row.generated_at).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs hidden sm:table-cell">{u.model || 'N/A'}</td>
                        <td className="px-3 py-2 max-w-[160px] sm:max-w-[220px] truncate">{row.query}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(u.calls)}</td>
                        <td className="px-3 py-2 text-right hidden md:table-cell">{fmtInt(u.prompt_tokens)}</td>
                        <td className="px-3 py-2 text-right hidden md:table-cell">{fmtInt(u.output_tokens)}</td>
                        <td className="px-3 py-2 text-right">{fmtInt(u.total_tokens)}</td>
                        <td className="px-3 py-2 text-right">{fmtUsd(u.estimated_cost_usd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
