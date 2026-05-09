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
      if (!usage) continue;
      const model = usage.model || 'unknown';
      if (!map.has(model)) {
        map.set(model, { model, runs: 0, calls: 0, prompt_tokens: 0, output_tokens: 0, total_tokens: 0, estimated_cost_usd: 0 });
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
      setError(err?.response?.data?.detail || err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="main" style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px' }}>
        {/* Page header */}
        <div className="page">
          <div className="page__title">
            <h1 className="display">LLM<br/><em>Usage</em></h1>
            <p className="page__sub">Model-wise observability for each browser research run. Costs, tokens, and call volume — live.</p>
          </div>
          <div className="page__actions">
            <button className="btn" onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={loading ? { animation: 'spin 1s linear infinite' } : undefined}>
                <path d="M2 6 A4 4 0 0 1 10 6 M10 4 V6 H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M10 6 A4 4 0 0 1 2 6 M2 8 V6 H4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {/* KPI cards */}
        {totals && (
          <div className="kpis" style={{ marginBottom: 24 }}>
            <div className="kpi">
              <span className="eyebrow">Total cost · all-time</span>
              <span className="kpi__val mono">{fmtUsd(totals.estimated_cost_usd)}</span>
            </div>
            <div className="kpi">
              <span className="eyebrow">Total tokens</span>
              <span className="kpi__val mono">{fmtInt(totals.total_tokens)}</span>
            </div>
            <div className="kpi">
              <span className="eyebrow">Total calls</span>
              <span className="kpi__val mono">{fmtInt(totals.calls)}</span>
            </div>
            <div className="kpi">
              <span className="eyebrow">Runs</span>
              <span className="kpi__val mono">{fmtInt(rows.length)}</span>
            </div>
          </div>
        )}

        {/* Model summary */}
        <div className="panel" style={{ marginBottom: 24 }}>
          <header className="panel__head">
            <h2 className="panel__title">Model Summary</h2>
          </header>
          {!byModel.length ? (
            <div className="empty">
              <p className="empty__text">No model usage found yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {byModel.map((m) => (
                <div key={m.model} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
                  padding: '12px 0', borderBottom: '1px solid var(--line-1)',
                }}>
                  <div>
                    <p style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>{m.model}</p>
                    <p className="meta" style={{ marginTop: 2 }}>{fmtInt(m.runs)} runs · {fmtInt(m.calls)} calls</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--fg-1)', margin: 0, fontFamily: 'var(--font-mono)' }}>{fmtInt(m.total_tokens)} tkn</p>
                    <p className="meta" style={{ fontFamily: 'var(--font-mono)' }}>{fmtUsd(m.estimated_cost_usd)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Run-by-Run table */}
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--line-1)' }}>
            <h2 style={{ fontSize: 'var(--t-h3)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Run-by-Run Records</h2>
          </div>

          {error && <p style={{ padding: '12px 24px', color: 'var(--signal-critical)', fontSize: 'var(--t-meta)' }}>{error}</p>}

          {loading ? (
            <div className="empty"><p className="empty__text">Loading usage records...</p></div>
          ) : !rows.length ? (
            <div className="empty"><p className="empty__text">No usage records yet.</p></div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="dtable">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Model</th>
                    <th>Query</th>
                    <th style={{ textAlign: 'right' }}>Calls</th>
                    <th style={{ textAlign: 'right' }}>Prompt</th>
                    <th style={{ textAlign: 'right' }}>Output</th>
                    <th style={{ textAlign: 'right' }}>Tokens</th>
                    <th style={{ textAlign: 'right' }}>Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const u = row?.llm_usage || {};
                    return (
                      <tr key={row.run_id}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: 'var(--t-micro)' }}>{new Date(row.generated_at).toLocaleString()}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--t-micro)' }}>{u.model || 'N/A'}</td>
                        <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.query}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtInt(u.calls)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtInt(u.prompt_tokens)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtInt(u.output_tokens)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{fmtInt(u.total_tokens)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtUsd(u.estimated_cost_usd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
