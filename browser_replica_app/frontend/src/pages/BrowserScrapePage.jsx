import React, { useMemo, useState } from 'react';
import Header from '@/components/Header';
import { browserScrapeApi } from '@/services/api';

function parseRedditDeepText(text) {
  const lines = String(text || '').split('\n');
  const communities = [];
  const fillPosts = [];
  let currentCommunity = null;
  let currentPost = null;
  let targetLine = '';
  let collectedLine = '';
  let fillNote = '';
  let inFillSection = false;

  const commitPost = () => {
    if (currentCommunity && currentPost) {
      currentCommunity.posts.push(currentPost);
      currentPost = null;
    }
  };

  const commitCommunity = () => {
    if (currentCommunity) {
      commitPost();
      communities.push(currentCommunity);
      currentCommunity = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    if (line.startsWith('Target: ')) {
      targetLine = line;
      continue;
    }

    if (line.startsWith('Collected posts: ')) {
      collectedLine = line;
      continue;
    }

    const communityMatch = line.match(/^Community\s+(\d+):\s+r\/([^|]+)\|\s*search_hits=(\d+)\s*\|\s*subscribers=(\d+)/i);
    if (communityMatch) {
      commitCommunity();
      currentCommunity = {
        index: Number(communityMatch[1]),
        name: communityMatch[2].trim(),
        searchHits: Number(communityMatch[3]),
        subscribers: Number(communityMatch[4]),
        posts: [],
        note: '',
      };
      continue;
    }

    if (line.toLowerCase().startsWith('global fill for missing posts:')) {
      commitCommunity();
      inFillSection = true;
      fillNote = line;
      continue;
    }

    const postMatch = line.match(/^(\d+)\.\s+score=(\d+)\s+comments=(\d+)\s+author=(.+)$/i);
    if (postMatch && currentCommunity) {
      commitPost();
      currentPost = {
        rank: postMatch[1],
        score: Number(postMatch[2]),
        comments: Number(postMatch[3]),
        author: postMatch[4].trim(),
        title: '',
        summary: '',
        url: '',
      };
      continue;
    }

    const fillMatch = line.match(/^F(\d+)\.\s+r\/([^|]+)\|\s*score=(\d+)\s+comments=(\d+)\s+author=(.+)$/i);
    if (fillMatch && inFillSection) {
      fillPosts.push({
        rank: `F${fillMatch[1]}`,
        subreddit: fillMatch[2].trim(),
        score: Number(fillMatch[3]),
        comments: Number(fillMatch[4]),
        author: fillMatch[5].trim(),
        title: '',
        summary: '',
        url: '',
      });
      continue;
    }

    if (line.startsWith('Title: ') && currentPost) {
      currentPost.title = line.replace('Title: ', '').trim();
      continue;
    }

    if (line.startsWith('Title: ') && inFillSection && fillPosts.length) {
      fillPosts[fillPosts.length - 1].title = line.replace('Title: ', '').trim();
      continue;
    }

    if (line.startsWith('Summary: ') && currentPost) {
      currentPost.summary = line.replace('Summary: ', '').trim();
      continue;
    }

    if (line.startsWith('Summary: ') && inFillSection && fillPosts.length) {
      fillPosts[fillPosts.length - 1].summary = line.replace('Summary: ', '').trim();
      continue;
    }

    if (line.startsWith('URL: ') && currentPost) {
      currentPost.url = line.replace('URL: ', '').trim();
      continue;
    }

    if (line.startsWith('URL: ') && inFillSection && fillPosts.length) {
      fillPosts[fillPosts.length - 1].url = line.replace('URL: ', '').trim();
      continue;
    }

    if (line.toLowerCase().startsWith('no relevant posts found') && currentCommunity) {
      currentCommunity.note = line;
    }
  }

  commitCommunity();

  const totalPosts = communities.reduce((acc, c) => acc + c.posts.length, 0);

  return {
    targetLine,
    collectedLine,
    totalPosts,
    communities,
    fillNote,
    fillPosts,
  };
}

export default function BrowserScrapePage({ isDark, toggleDark }) {
  const [query, setQuery] = useState('US AI startup funding and open source models');
  const [format, setFormat] = useState('text');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [activeSource, setActiveSource] = useState('news');

  const sourceCards = useMemo(() => {
    const sources = result?.sources || [];
    return sources.map((item) => {
      const maxPreview = item.source === 'reddit' ? 120000 : 8000;
      const preview = (item.text || '').length > maxPreview ? `${item.text.slice(0, maxPreview)}...` : item.text;
      const parsedReddit = item.source === 'reddit' ? parseRedditDeepText(item.text) : null;
      return { ...item, preview, parsedReddit };
    });
  }, [result]);

  const activeItem = useMemo(
    () => sourceCards.find((s) => s.source === activeSource) || sourceCards[0] || null,
    [sourceCards, activeSource],
  );

  const copyCurrentSource = async () => {
    if (!activeItem?.text) {
      return;
    }
    try {
      await navigator.clipboard.writeText(activeItem.text);
    } catch {
      // Ignore copy failures silently.
    }
  };

  const runResearch = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await browserScrapeApi.research({
        query,
        format,
        max_chars_per_source: 150000,
      });
      setResult(response);
      if (response?.sources?.length) {
        setActiveSource(response.sources[0].source);
      }
    } catch (err) {
      setError(err?.message || 'Research run failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-transparent dark:border-gray-700">
          <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Browser Research Replica</h1>
          <p className="text-sm text-secondary-600 dark:text-gray-300 mt-2">
            Enter one query to gather browser-based research from News, YouTube, and Reddit in a single run.
          </p>
        </div>

        <form onSubmit={runResearch} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-transparent dark:border-gray-700 space-y-4">
          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-gray-300 mb-2">Research Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              required
              minLength={3}
              className="w-full rounded-lg border border-secondary-200 dark:border-gray-600 px-4 py-3 bg-white dark:bg-gray-700 text-secondary-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-secondary-700 dark:text-gray-300 mb-2">Output Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="rounded-lg border border-secondary-200 dark:border-gray-600 px-4 py-2 bg-white dark:bg-gray-700 text-secondary-900 dark:text-gray-100"
            >
              <option value="text">text</option>
              <option value="markdown">markdown</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-lg font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60"
          >
            {loading ? 'Researching...' : 'Run Browser Research'}
          </button>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        </form>

        {result?.sources?.length ? (
          <section className="space-y-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-transparent dark:border-gray-700">
              <h2 className="text-xl font-semibold text-secondary-900 dark:text-white">Run Summary</h2>
              <p className="text-sm text-secondary-600 dark:text-gray-300 mt-2">Query: {result.query}</p>
              <p className="text-sm text-secondary-600 dark:text-gray-300">Sources scraped: {result.sources.length}</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-transparent dark:border-gray-700">
              <div className="flex flex-wrap items-center gap-2">
                {sourceCards.map((item) => (
                  <button
                    key={item.source}
                    onClick={() => setActiveSource(item.source)}
                    className={`px-3 py-2 rounded-lg text-sm font-semibold uppercase transition-all ${
                      activeSource === item.source
                        ? 'bg-primary-600 text-white shadow'
                        : 'bg-secondary-100 dark:bg-gray-700 text-secondary-700 dark:text-gray-200 hover:bg-secondary-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    {item.source}
                  </button>
                ))}
              </div>
            </div>

            {activeItem ? (
              <article className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-transparent dark:border-gray-700 space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-secondary-900 dark:text-white">{activeItem.title || 'Untitled'}</h3>
                    <p className="text-sm text-secondary-600 dark:text-gray-300 mt-1">Requested: {activeItem.requested_url}</p>
                    <p className="text-sm text-secondary-600 dark:text-gray-300">Final: {activeItem.final_url}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={activeItem.final_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      Open Source
                    </a>
                    <button
                      onClick={copyCurrentSource}
                      className="px-3 py-2 rounded-lg text-sm font-semibold bg-secondary-200 dark:bg-gray-700 hover:bg-secondary-300 dark:hover:bg-gray-600 text-secondary-900 dark:text-gray-100"
                    >
                      Copy Text
                    </button>
                  </div>
                </div>

                {activeItem.source === 'reddit' && activeItem.parsedReddit?.communities?.length ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="rounded-lg bg-secondary-50 dark:bg-gray-900 p-3">
                        <p className="text-xs text-secondary-500 dark:text-gray-400">Target</p>
                        <p className="text-sm font-semibold text-secondary-900 dark:text-white">{activeItem.parsedReddit.targetLine || 'N/A'}</p>
                      </div>
                      <div className="rounded-lg bg-secondary-50 dark:bg-gray-900 p-3">
                        <p className="text-xs text-secondary-500 dark:text-gray-400">Collected</p>
                        <p className="text-sm font-semibold text-secondary-900 dark:text-white">{activeItem.parsedReddit.collectedLine || `Collected posts: ${activeItem.parsedReddit.totalPosts}`}</p>
                      </div>
                      <div className="rounded-lg bg-secondary-50 dark:bg-gray-900 p-3">
                        <p className="text-xs text-secondary-500 dark:text-gray-400">Communities</p>
                        <p className="text-sm font-semibold text-secondary-900 dark:text-white">{activeItem.parsedReddit.communities.length}</p>
                      </div>
                    </div>

                    {activeItem.parsedReddit.fillNote ? (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 p-3">
                        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">{activeItem.parsedReddit.fillNote}</p>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">Fallback posts filled from global topic search.</p>
                      </div>
                    ) : null}

                    <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
                      {activeItem.parsedReddit.communities.map((community) => (
                        <details key={`${community.name}-${community.index}`} className="rounded-lg border border-secondary-200 dark:border-gray-700 bg-secondary-50 dark:bg-gray-900 p-3">
                          <summary className="cursor-pointer font-semibold text-secondary-900 dark:text-white">
                            r/{community.name} | posts {community.posts.length} | hits {community.searchHits}
                          </summary>
                          {community.note ? (
                            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{community.note}</p>
                          ) : null}
                          <div className="mt-3 space-y-3">
                            {community.posts.map((post) => (
                              <div key={`${community.name}-${post.rank}-${post.url || post.title}`} className="rounded-lg bg-white dark:bg-gray-800 p-3 border border-secondary-200 dark:border-gray-700">
                                <p className="text-xs text-secondary-500 dark:text-gray-400">
                                  {post.rank}. score {post.score} | comments {post.comments} | u/{post.author}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-secondary-900 dark:text-white">{post.title}</p>
                                <p className="mt-1 text-sm text-secondary-700 dark:text-gray-300">{post.summary}</p>
                                {post.url ? (
                                  <a href={post.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline">
                                    Open post
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </details>
                      ))}

                      {activeItem.parsedReddit.fillPosts?.length ? (
                        <details className="rounded-lg border border-secondary-200 dark:border-gray-700 bg-secondary-50 dark:bg-gray-900 p-3">
                          <summary className="cursor-pointer font-semibold text-secondary-900 dark:text-white">
                            Global Fill Posts: {activeItem.parsedReddit.fillPosts.length}
                          </summary>
                          <div className="mt-3 space-y-3">
                            {activeItem.parsedReddit.fillPosts.map((post) => (
                              <div key={`${post.rank}-${post.url || post.title}`} className="rounded-lg bg-white dark:bg-gray-800 p-3 border border-secondary-200 dark:border-gray-700">
                                <p className="text-xs text-secondary-500 dark:text-gray-400">
                                  {post.rank}. r/{post.subreddit} | score {post.score} | comments {post.comments} | u/{post.author}
                                </p>
                                <p className="mt-1 text-sm font-semibold text-secondary-900 dark:text-white">{post.title}</p>
                                <p className="mt-1 text-sm text-secondary-700 dark:text-gray-300">{post.summary}</p>
                                {post.url ? (
                                  <a href={post.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-primary-700 dark:text-primary-300 hover:underline">
                                    Open post
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <pre className="text-sm whitespace-pre-wrap bg-secondary-50 dark:bg-gray-900 rounded-lg p-4 text-secondary-800 dark:text-gray-100 max-h-[65vh] overflow-auto leading-relaxed">
                    {activeItem.preview || 'No text extracted'}
                  </pre>
                )}
              </article>
            ) : null}
          </section>
        ) : null}
      </main>
    </div>
  );
}
