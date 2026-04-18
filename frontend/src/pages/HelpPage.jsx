import { useState } from "react";
import axios from "axios";
import Header from "@/components/Header";

const DEFAULT_PROXY = "http://zsrszfvn:4idp4bt40aye@31.59.20.176:6754";

export default function HelpPage({ isDark, toggleDark }) {
  const [proxyUrl, setProxyUrl] = useState(DEFAULT_PROXY);
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
        proxy_url: useProxy ? proxyUrl.trim() : "",
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
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />
    <div className="px-4 py-8">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Help & Diagnostics</h1>
          <p className="text-secondary-500 dark:text-gray-400 text-sm mt-1">
            Test Reddit connectivity and proxy settings from the VM directly.
          </p>
        </div>

        {/* Proxy Tester Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-secondary-100 dark:border-gray-700 p-6 space-y-5">
          <h2 className="text-lg font-semibold text-secondary-800 dark:text-white">Reddit Proxy Tester</h2>

          {/* Inputs */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-gray-300 mb-1">
                Proxy URL <span className="text-secondary-400 font-normal">(format: http://user:pass@ip:port)</span>
              </label>
              <input
                type="text"
                value={proxyUrl}
                onChange={e => setProxyUrl(e.target.value)}
                placeholder="http://user:pass@ip:port"
                className="w-full px-3 py-2 rounded-lg border border-secondary-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-secondary-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-gray-300 mb-1">
                Subreddit to test
              </label>
              <input
                type="text"
                value={subreddit}
                onChange={e => setSubreddit(e.target.value)}
                placeholder="technology"
                className="w-full px-3 py-2 rounded-lg border border-secondary-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-secondary-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => runTest(true, setLoading, setResult)}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white font-semibold text-sm shadow transition-colors"
            >
              {loading ? "Testing…" : "Test with Proxy"}
            </button>
            <button
              onClick={() => runTest(false, setNoProxyLoading, setNoProxyResult)}
              disabled={noProxyLoading}
              className="px-5 py-2 rounded-xl bg-secondary-200 hover:bg-secondary-300 dark:bg-gray-700 dark:hover:bg-gray-600 disabled:opacity-50 text-secondary-800 dark:text-white font-semibold text-sm shadow transition-colors"
            >
              {noProxyLoading ? "Testing…" : "Test without Proxy"}
            </button>
          </div>

          {/* Results */}
          <div className="space-y-3">
            <ResultCard label="With Proxy" result={result} loading={loading} />
            <ResultCard label="Without Proxy" result={noProxyResult} loading={noProxyLoading} />
          </div>
        </div>

        {/* Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow border border-secondary-100 dark:border-gray-700 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-secondary-800 dark:text-white">Proxy Info</h2>
          <div className="text-sm text-secondary-600 dark:text-gray-300 space-y-1">
            <p><span className="font-medium">Provider:</span> Webshare.io (residential free tier)</p>
            <p><span className="font-medium">Monthly bandwidth:</span> 1 GB</p>
            <p><span className="font-medium">Usage estimate:</span> ~3 MB per scrape · ~18 MB per browser session</p>
            <p><span className="font-medium">Budget:</span> ~300 scrape calls OR ~55 browser research sessions/month</p>
            <p className="text-secondary-400 dark:text-gray-500 pt-1 text-xs">
              To rotate: update REDDIT_PROXY_URL in deploy_vm.sh and redeploy.
            </p>
          </div>
        </div>

      </div>
    </div>
    </div>
  );
}

function ResultCard({ label, result, loading }) {
  if (loading) {
    return (
      <div className="rounded-xl border border-secondary-100 dark:border-gray-600 p-4 text-sm text-secondary-500 dark:text-gray-400 animate-pulse">
        {label}: connecting…
      </div>
    );
  }
  if (!result) return null;

  return (
    <div className={`rounded-xl border p-4 text-sm space-y-2 ${
      result.ok
        ? "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
        : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
    }`}>
      <div className="flex items-center gap-2 font-semibold">
        <span className={result.ok ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
          {result.ok ? "✓" : "✗"} {label}
        </span>
        {result.elapsed_ms != null && (
          <span className="text-secondary-400 dark:text-gray-500 font-normal text-xs">{result.elapsed_ms} ms</span>
        )}
      </div>
      {result.error && (
        <p className="text-red-600 dark:text-red-400 font-mono text-xs break-all">{result.error}</p>
      )}
      {result.posts?.length > 0 && (
        <ul className="space-y-1">
          {result.posts.map((p, i) => (
            <li key={i} className="text-secondary-700 dark:text-gray-300 text-xs">
              <span className="text-secondary-400 dark:text-gray-500 mr-1">↑{p.score}</span>{p.title}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
