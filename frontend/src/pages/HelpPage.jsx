import { useState, useEffect } from "react";
import axios from "axios";
import Header from "@/components/Header";

export default function HelpPage({ isDark, toggleDark }) {
  const [proxyUrl, setProxyUrl] = useState("");
  const [proxyConfigured, setProxyConfigured] = useState(null);

  useEffect(() => {
    axios.get("/api/debug/proxy-config").then(({ data }) => {
      setProxyConfigured(data.configured);
      if (data.masked_url) setProxyUrl(data.masked_url);
    }).catch(() => setProxyConfigured(false));
  }, []);

  const [subreddit, setSubreddit] = useState("technology");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [noProxyLoading, setNoProxyLoading] = useState(false);
  const [noProxyResult, setNoProxyResult] = useState(null);

  async function runTest(useProxy, setLoad, setRes) {
    setLoad(true);
    setRes(null);
    try {
      const { data } = await axios.post("/api/debug/test-reddit", {
        use_configured_proxy: useProxy,
        subreddit: subreddit.trim(),
      });
      setRes(data);
    } catch (e) {
      setRes({ ok: false, error: e.message, posts: [], elapsed_ms: null });
    } finally {
      setLoad(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="main" style={{ maxWidth: 720, margin: '0 auto', padding: '0 24px' }}>
        <div className="page">
          <div className="page__title">
            <h1 className="display">Help &<br/><em>Diagnostics</em></h1>
            <p className="page__sub">Test Reddit connectivity and proxy settings from the VM directly.</p>
          </div>
        </div>

        {/* Proxy Tester */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <header className="panel__head">
            <div>
              <h2 className="panel__title">Reddit Proxy Tester</h2>
              <p className="panel__sub">
                {proxyConfigured === null && 'Loading proxy status...'}
                {proxyConfigured === true && 'Proxy is configured and ready.'}
                {proxyConfigured === false && 'No proxy configured.'}
              </p>
            </div>
            {proxyConfigured === true && <span className="badge badge--live"><span className="badge__dot" />Configured</span>}
            {proxyConfigured === false && <span className="badge" style={{ background: 'rgba(240,110,110,0.12)', color: 'var(--signal-critical)' }}><span className="badge__dot" />No proxy</span>}
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="field">
              <label className="field__label">Proxy URL (password masked)</label>
              <div className="field__input">
                <input type="text" value={proxyUrl} readOnly placeholder="Not configured" style={{ cursor: 'default' }} />
              </div>
            </div>
            <div className="field">
              <label className="field__label">Subreddit to test</label>
              <div className="field__input">
                <input type="text" value={subreddit} onChange={e => setSubreddit(e.target.value)} placeholder="technology" />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button className="btn btn--primary" onClick={() => runTest(true, setLoading, setResult)} disabled={loading}
              style={{ opacity: loading ? 0.6 : 1 }}>
              {loading ? "Testing..." : "Test with Proxy"}
            </button>
            <button className="btn" onClick={() => runTest(false, setNoProxyLoading, setNoProxyResult)} disabled={noProxyLoading}
              style={{ opacity: noProxyLoading ? 0.6 : 1 }}>
              {noProxyLoading ? "Testing..." : "Test without Proxy"}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
            <ResultCard label="With Proxy" result={result} loading={loading} />
            <ResultCard label="Without Proxy" result={noProxyResult} loading={noProxyLoading} />
          </div>
        </div>

        {/* Info Card */}
        <div className="panel">
          <h2 className="panel__title" style={{ marginBottom: 12 }}>Proxy Info</h2>
          <div style={{ fontSize: 'var(--t-meta)', color: 'var(--fg-2)', lineHeight: 1.8 }}>
            <p style={{ margin: 0 }}><strong style={{ color: 'var(--fg-1)' }}>Provider:</strong> Webshare.io (residential free tier)</p>
            <p style={{ margin: 0 }}><strong style={{ color: 'var(--fg-1)' }}>Monthly bandwidth:</strong> 1 GB</p>
            <p style={{ margin: 0 }}><strong style={{ color: 'var(--fg-1)' }}>Usage estimate:</strong> ~3 MB per scrape · ~18 MB per browser session</p>
            <p style={{ margin: 0 }}><strong style={{ color: 'var(--fg-1)' }}>Budget:</strong> ~300 scrape calls OR ~55 browser research sessions/month</p>
            <p className="meta" style={{ marginTop: 8 }}>To rotate: update REDDIT_PROXY_URL in deploy_vm.sh and redeploy.</p>
          </div>
        </div>
      </main>
    </div>
  );
}

function diagnose(result) {
  if (!result) return null;
  if (result.ok) return { label: "Working fine", color: "positive", hint: null };
  const err = (result.error || "").toLowerCase();
  const status = result.status;
  if (err.includes("quota") || err.includes("bandwidth") || err.includes("exceeded") || status === 509)
    return { label: "Quota exceeded", color: "critical", hint: "1 GB monthly limit hit — rotate to a new proxy." };
  if (status === 407 || err.includes("407") || err.includes("proxy auth") || err.includes("credentials"))
    return { label: "Proxy auth failed", color: "critical", hint: "Wrong username/password in proxy URL." };
  if (err.includes("cannot connect to host") && err.includes("6754"))
    return { label: "Proxy unreachable", color: "critical", hint: "Proxy server is down or IP/port is wrong." };
  if (err.includes("connect") || err.includes("timeout") || err.includes("timed out"))
    return { label: "Connection timeout", color: "warn", hint: "Proxy not responding — may be overloaded or dead." };
  if (status === 403)
    return { label: "Reddit blocked this IP", color: "critical", hint: "This proxy IP is blocked by Reddit — not residential enough." };
  if (status === 429)
    return { label: "Rate limited by Reddit", color: "warn", hint: "Too many requests — wait a minute and retry." };
  if (status === 200 && !result.ok)
    return { label: "Unexpected response", color: "warn", hint: "Got 200 but no posts — Reddit may have changed its format." };
  return { label: `HTTP ${status || "error"}`, color: "critical", hint: result.error };
}

const diagStyles = {
  positive: { background: 'rgba(139,196,138,0.12)', color: 'var(--signal-positive)' },
  critical: { background: 'rgba(240,110,110,0.12)', color: 'var(--signal-critical)' },
  warn: { background: 'rgba(232,182,92,0.12)', color: 'var(--signal-warn)' },
};

function ResultCard({ label, result, loading }) {
  if (loading) {
    return (
      <div style={{
        padding: 16, borderRadius: 'var(--r-lg)', border: '1px solid var(--line-1)',
        fontSize: 'var(--t-meta)', color: 'var(--fg-3)',
      }}>
        {label}: connecting...
      </div>
    );
  }
  if (!result) return null;
  const diag = diagnose(result);
  const borderColor = result.ok ? 'rgba(139,196,138,0.3)' : 'rgba(240,110,110,0.3)';

  return (
    <div style={{
      padding: 16, borderRadius: 'var(--r-lg)',
      border: `1px solid ${borderColor}`,
      background: result.ok ? 'rgba(139,196,138,0.06)' : 'rgba(240,110,110,0.06)',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 'var(--t-body)', color: result.ok ? 'var(--signal-positive)' : 'var(--signal-critical)' }}>
          {result.ok ? "✓" : "✗"} {label}
        </span>
        {diag && (
          <span style={{
            ...diagStyles[diag.color],
            padding: '2px 10px', borderRadius: 'var(--r-pill)',
            fontSize: 'var(--t-micro)', fontWeight: 600,
          }}>{diag.label}</span>
        )}
        {result.elapsed_ms != null && (
          <span className="meta mono" style={{ marginLeft: 'auto' }}>{result.elapsed_ms} ms</span>
        )}
      </div>
      {diag?.hint && !result.ok && (
        <p className="meta">{diag.hint}</p>
      )}
      {result.posts?.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {result.posts.map((p, i) => (
            <li key={i} style={{ fontSize: 'var(--t-meta)', color: 'var(--fg-2)' }}>
              <span className="meta" style={{ marginRight: 4 }}>↑{p.score}</span>{p.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
