import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import NewsCard from '@/components/NewsCard';
import { articlesApi, browserResearchApi, feedCardsApi } from '@/services/api';
import { CATEGORIES, COUNTRIES, DOMAIN_COLORS, SUBCATEGORY_LABELS, formatTimeAgo } from '@/utils/helpers';
import { cn } from '@/utils/helpers';
import { ArrowLeft, ExternalLink, MessageSquare, RefreshCw, ThumbsUp, Users } from 'lucide-react';

const PAGE_SIZE = 15;

const SOURCE_CONFIG = {
  reddit:  { label: 'Reddit',  cls: 'bg-orange-500',  text: 'text-white' },
  youtube: { label: 'YouTube', cls: 'bg-red-600',     text: 'text-white' },
  news:    { label: 'News',    cls: 'bg-blue-600',    text: 'text-white' },
};

function todayParam() {
  return new Date().toISOString().split('T')[0]; // YYYY-MM-DD
}

function BrowserItem({ item }) {
  const [open, setOpen] = useState(false);
  const src = SOURCE_CONFIG[item.source] || { label: item.source, cls: 'bg-gray-500', text: 'text-white' };

  return (
    <article className="group px-5 py-4 border-b border-gray-100 dark:border-gray-700/60 last:border-0 hover:bg-gray-50/60 dark:hover:bg-gray-700/20 transition-colors">
      <div className="flex items-start gap-3">
        <div className={cn('mt-1 w-2 h-2 rounded-full flex-shrink-0', src.cls)} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide', src.cls, src.text)}>
              {src.label}
            </span>
            {item.community && (
              <span className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold">r/{item.community}</span>
            )}
            {item.channel && (
              <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold">{item.channel}</span>
            )}
            {item.published_at && (
              <span className="text-[11px] text-gray-400 dark:text-gray-500">{formatTimeAgo(item.published_at)}</span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {item.title}
          </h3>
          {item.summary && (
            <p className={cn('text-xs text-gray-500 dark:text-gray-400 leading-relaxed', open ? '' : 'line-clamp-2')}>
              {item.summary}
            </p>
          )}
          <div className="flex items-center gap-4 pt-0.5">
            {item.score != null && item.score > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <ThumbsUp className="h-3 w-3" /> {item.score.toLocaleString()}
              </span>
            )}
            {item.comments != null && item.comments > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                <MessageSquare className="h-3 w-3" /> {item.comments.toLocaleString()}
              </span>
            )}
            {item.summary && item.summary.length > 120 && (
              <button
                onClick={() => setOpen((o) => !o)}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                {open ? 'Show less' : 'Read more'}
              </button>
            )}
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Open <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function FeedCardDetailPage({ isDark, toggleDark }) {
  const { cardId } = useParams();
  const navigate = useNavigate();

  const [card, setCard] = useState(null);
  const [items, setItems] = useState([]);
  const [cardLoading, setCardLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [itemType, setItemType] = useState('article');
  const [country, setCountry] = useState('');
  // 'today' uses day=YYYY-MM-DD; numeric strings use hours_back
  const [timeFilter, setTimeFilter] = useState('today');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [textSearch, setTextSearch] = useState('');

  useEffect(() => {
    feedCardsApi.getCard(cardId)
      .then(setCard)
      .catch(() => setError('Card not found.'))
      .finally(() => setCardLoading(false));
  }, [cardId]);

  const loadItems = useCallback(async () => {
    if (!card) return;
    setLoading(true);
    setError('');
    setVisibleCount(PAGE_SIZE);
    try {
      if (card.type === 'domain') {
        const params = { limit: 60 };
        if (card.domain) params.categories = card.domain;
        if (card.subdomain && card.subdomain !== 'OTH') params.subcategory = card.subdomain;
        if (country) params.country = country;
        if (timeFilter === 'today') {
          params.day = todayParam();
        } else {
          params.hours_back = parseInt(timeFilter);
        }
        const res = await articlesApi.getArticles(params);
        const articles = res.articles || [];
        if (articles.length > 0) {
          setItems(articles);
          setItemType('article');
        } else if (card.run_id) {
          const runData = await browserResearchApi.getRun(card.run_id);
          setItems(runData.blogs || []);
          setItemType('browser');
        } else {
          setItems([]);
          setItemType('article');
        }
      } else if (card.run_id) {
        const res = await browserResearchApi.getRun(card.run_id);
        setItems(res.blogs || []);
        setItemType('browser');
      } else {
        setItems([]);
        setItemType('browser');
      }
    } catch {
      setError('Failed to load items.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [card, timeFilter, country]);

  useEffect(() => { if (card) loadItems(); }, [card, loadItems]);

  // Apply source filter + text search
  const filteredItems = items.filter((i) => {
    if (card?.type === 'custom' && sourceFilter !== 'all' && i.source !== sourceFilter) return false;
    if (textSearch) {
      const q = textSearch.toLowerCase();
      const title = (i.title || i.headline || '').toLowerCase();
      const summary = (i.summary || i.content || '').toLowerCase();
      if (!title.includes(q) && !summary.includes(q)) return false;
    }
    return true;
  });

  const visibleItems = filteredItems.slice(0, visibleCount);
  const hasMore = filteredItems.length > visibleCount;

  const colors = DOMAIN_COLORS[card?.domain] || DOMAIN_COLORS.OTH;
  const category = CATEGORIES.find((c) => c.id === card?.domain);
  const subcategoryLabel = SUBCATEGORY_LABELS[card?.subdomain] || card?.subdomain;

  const dnaCode = card?.domain
    ? card?.subdomain && card?.subdomain !== 'OTH'
      ? `${card.domain}·${card.subdomain}`
      : card?.domain
    : null;

  const sourceCounts = items.reduce((acc, i) => {
    acc[i.source] = (acc[i.source] || 0) + 1;
    return acc;
  }, {});

  if (cardLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <Header isDark={isDark} toggleDark={toggleDark} />
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-5">

        {/* Back nav */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Card hero */}
        {card && (
          <div className={cn('bg-white dark:bg-gray-800 rounded-2xl border overflow-hidden shadow-sm', colors.border)}>
            <div className={cn('h-1 w-full', {
              POL: 'bg-blue-500', ECO: 'bg-emerald-500',
              BUS: 'bg-violet-500', TEC: 'bg-orange-500',
            }[card.domain] || 'bg-gray-400')} />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  {dnaCode && (
                    <span className={cn('inline-block font-mono text-xs font-bold px-2 py-0.5 rounded mb-2', colors.bg, colors.text)}>
                      {dnaCode}
                    </span>
                  )}
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white leading-snug">
                    {card.title}
                  </h1>
                  {card.description && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{card.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                  {category && (
                    <span className={cn('text-xs font-semibold px-2.5 py-1 rounded-full', colors.bg, colors.text)}>
                      {category.icon} {category.name}
                    </span>
                  )}
                  {subcategoryLabel && card.subdomain !== 'OTH' && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 font-medium">
                      {subcategoryLabel}
                    </span>
                  )}
                  {card.pinned_count > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 px-2 py-1 rounded-full bg-gray-50 dark:bg-gray-700/60">
                      <Users className="h-3 w-3" /> {card.pinned_count} following
                    </span>
                  )}
                </div>
              </div>
              {card.created_at && (
                <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                  Last updated {formatTimeAgo(card.created_at)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Single-line filter bar */}
        {card && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 px-3 py-2.5 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Text search */}
              <input
                type="text"
                value={textSearch}
                onChange={(e) => setTextSearch(e.target.value)}
                placeholder="Search within feed…"
                className="flex-1 min-w-[120px] rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-1.5 text-xs text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-400"
              />

              {/* Time filter — domain cards */}
              {card.type === 'domain' && itemType === 'article' && (
                <div className="flex gap-1 flex-wrap flex-shrink-0">
                  {[['today', 'Today'], ['24', '24h'], ['48', '48h'], ['168', '7d']].map(([v, l]) => (
                    <button
                      key={v}
                      onClick={() => setTimeFilter(v)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
                        timeFilter === v
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              )}

              {/* Country — domain cards */}
              {card.type === 'domain' && itemType === 'article' && (
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1.5 text-xs text-gray-800 dark:text-white flex-shrink-0"
                >
                  <option value="">All countries</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
              )}

              {/* Source filter — custom/browser cards */}
              {(card.type === 'custom' || itemType === 'browser') && (
                <div className="flex gap-1 flex-shrink-0">
                  {['all', 'reddit', 'youtube', 'news'].map((src) => {
                    const count = src === 'all' ? items.length : (sourceCounts[src] || 0);
                    return (
                      <button
                        key={src}
                        onClick={() => setSourceFilter(src)}
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all capitalize',
                          sourceFilter === src
                            ? 'bg-primary-600 text-white shadow-sm'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600',
                        )}
                      >
                        {src}
                        {count > 0 && (
                          <span className={cn('text-[10px] px-1 rounded-full font-bold',
                            sourceFilter === src ? 'bg-white/20 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-500 dark:text-gray-400')}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Count + Refresh */}
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto flex-shrink-0">{filteredItems.length}</span>
              <button onClick={loadItems} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0">
                <RefreshCw className={cn('h-3.5 w-3.5 text-gray-400', loading && 'animate-spin')} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500 text-sm space-y-2">
            <p>No items for the selected filters.</p>
            {timeFilter === 'today' && card?.type === 'domain' && (
              <button
                onClick={() => setTimeFilter('24')}
                className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:underline"
              >
                Try last 24h instead →
              </button>
            )}
          </div>
        ) : itemType === 'article' ? (
          <div className="space-y-3">
            {visibleItems.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
            {hasMore && (
              <button
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                See more ({filteredItems.length - visibleCount} remaining)
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {visibleItems.map((item, idx) => (
              <BrowserItem key={`${item.url}-${idx}`} item={item} />
            ))}
            {hasMore && (
              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="w-full py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  See more ({filteredItems.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
