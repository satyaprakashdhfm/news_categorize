import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '@/components/Header';
import NewsCard from '@/components/NewsCard';
import { articlesApi, browserResearchApi, feedCardsApi } from '@/services/api';
import { CATEGORIES, COUNTRIES, DOMAIN_COLORS, SUBCATEGORY_LABELS } from '@/utils/helpers';
import { cn } from '@/utils/helpers';
import { ArrowLeft, ExternalLink, RefreshCw } from 'lucide-react';

const SOURCE_BADGE = {
  reddit: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  youtube: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  news: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

function BrowserItem({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-secondary-100 dark:border-gray-700 last:border-0 py-3 px-4">
      <div className="flex items-start gap-2">
        <span className={cn('mt-0.5 px-1.5 py-0.5 rounded text-xs font-bold uppercase flex-shrink-0', SOURCE_BADGE[item.source] || 'bg-gray-100 text-gray-600')}>
          {item.source}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-secondary-900 dark:text-white leading-snug">{item.title}</p>
          {item.summary && (
            <p className={cn('mt-1 text-xs text-secondary-600 dark:text-gray-400', open ? '' : 'line-clamp-3')}>
              {item.summary}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-3 flex-wrap">
            {item.community && <span className="text-xs text-secondary-400 dark:text-gray-500">r/{item.community}</span>}
            {item.channel && <span className="text-xs text-secondary-400 dark:text-gray-500">{item.channel}</span>}
            {item.url && (
              <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-0.5">
                Open <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {item.summary && item.summary.length > 150 && (
              <button onClick={() => setOpen((o) => !o)} className="text-xs text-secondary-400 hover:text-secondary-600 dark:hover:text-gray-300">
                {open ? 'less' : 'more'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
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

  // Filters
  const [country, setCountry] = useState('');
  const [hoursBack, setHoursBack] = useState('24');
  const [sourceFilter, setSourceFilter] = useState('all');

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
    try {
      if (card.type === 'domain') {
        const params = { limit: 50 };
        if (card.domain) params.categories = card.domain;
        if (card.subdomain && card.subdomain !== 'OTH') params.subcategory = card.subdomain;
        if (hoursBack) params.hours_back = parseInt(hoursBack);
        if (country) params.country = country;
        const res = await articlesApi.getArticles(params);
        setItems(res.articles || []);
      } else if (card.run_id) {
        const res = await browserResearchApi.getRun(card.run_id);
        setItems(res.blogs || []);
      } else {
        setItems([]);
      }
    } catch {
      setError('Failed to load items.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [card, hoursBack, country]);

  useEffect(() => {
    if (card) loadItems();
  }, [card, loadItems]);

  const filteredItems = card?.type === 'custom' && sourceFilter !== 'all'
    ? items.filter((i) => i.source === sourceFilter)
    : items;

  const colors = DOMAIN_COLORS[card?.domain] || DOMAIN_COLORS.OTH;
  const category = CATEGORIES.find((c) => c.id === card?.domain);
  const subcategoryLabel = SUBCATEGORY_LABELS[card?.subdomain] || card?.subdomain;

  if (cardLoading) {
    return (
      <div className="min-h-screen bg-secondary-50 dark:bg-gray-900">
        <Header isDark={isDark} toggleDark={toggleDark} />
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />
      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-4">

        {/* Back + title */}
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-secondary-500 dark:text-gray-400" />
          </button>
          {card && (
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-secondary-900 dark:text-white">{card.title}</h1>
              {card.domain && (
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold', colors.text, colors.bg)}>
                  {category?.icon} {card.domain}
                </span>
              )}
              {card.subdomain && card.subdomain !== 'OTH' && (
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colors.text, colors.bg)}>
                  {subcategoryLabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Filters */}
        {card && (
          <div className="flex items-center gap-2 flex-wrap bg-white dark:bg-gray-800 rounded-xl border border-secondary-100 dark:border-gray-700 px-4 py-3 shadow-sm">
            {card.type === 'domain' ? (
              <>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="rounded-lg border border-secondary-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-secondary-800 dark:text-white"
                >
                  <option value="">All countries</option>
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
                  ))}
                </select>
                <select
                  value={hoursBack}
                  onChange={(e) => setHoursBack(e.target.value)}
                  className="rounded-lg border border-secondary-200 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1.5 text-sm text-secondary-800 dark:text-white"
                >
                  <option value="6">6h</option>
                  <option value="24">24h</option>
                  <option value="48">48h</option>
                  <option value="72">72h</option>
                  <option value="168">7d</option>
                </select>
              </>
            ) : (
              <div className="flex gap-1 flex-wrap">
                {['all', 'reddit', 'youtube', 'news'].map((src) => (
                  <button
                    key={src}
                    onClick={() => setSourceFilter(src)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize',
                      sourceFilter === src
                        ? 'bg-primary-600 text-white'
                        : 'bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600',
                    )}
                  >
                    {src}
                  </button>
                ))}
              </div>
            )}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-secondary-500 dark:text-gray-400">{filteredItems.length} items</span>
              <button
                onClick={loadItems}
                className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className={cn('h-4 w-4 text-secondary-400', loading && 'animate-spin')} />
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
          <div className="text-center py-16 text-secondary-500 dark:text-gray-400 text-sm">
            No items found for the selected filters.
          </div>
        ) : card?.type === 'domain' ? (
          <div className="space-y-3">
            {filteredItems.map((article) => (
              <NewsCard key={article.id} article={article} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-secondary-100 dark:border-gray-700 shadow-sm overflow-hidden">
            {filteredItems.map((item, idx) => (
              <BrowserItem key={`${item.url}-${idx}`} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
