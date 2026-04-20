import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import FeedCard from '@/components/FeedCard';
import { feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Globe2, LogIn, Plus, RefreshCw, Sparkles, TrendingUp, Users, ChevronDown, ChevronRight } from 'lucide-react';
import { cn, CATEGORIES, SUBCATEGORY_LABELS } from '@/utils/helpers';

const TABS = [
  { id: 'global', label: 'Global Feed', icon: <Globe2 className="h-4 w-4" /> },
  { id: 'your',   label: 'Your Feed',   icon: <Sparkles className="h-4 w-4" /> },
];

const DOMAIN_COLORS_SIDEBAR = {
  POL: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  ECO: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  BUS: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300', dot: 'bg-violet-500' },
  TEC: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  OTH: { bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' },
};

function TrendingSidebar({ trending }) {
  const navigate = useNavigate();
  const [openDomains, setOpenDomains] = useState({});

  const toggleDomain = (d) => setOpenDomains((prev) => ({ ...prev, [d]: !prev[d] }));

  const domainOrder = ['TEC', 'ECO', 'POL', 'BUS', 'OTH'];
  const sortedDomains = Object.keys(trending).sort(
    (a, b) => domainOrder.indexOf(a) - domainOrder.indexOf(b),
  );

  if (sortedDomains.length === 0) {
    return (
      <div className="text-xs text-gray-400 dark:text-gray-500 text-center py-6">No trending data yet.</div>
    );
  }

  return (
    <div className="space-y-1">
      {sortedDomains.map((domain) => {
        const catInfo = CATEGORIES.find((c) => c.id === domain);
        const colors = DOMAIN_COLORS_SIDEBAR[domain] || DOMAIN_COLORS_SIDEBAR.OTH;
        const subdomains = trending[domain];
        const isOpen = openDomains[domain] !== false; // open by default

        return (
          <div key={domain}>
            <button
              onClick={() => toggleDomain(domain)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold transition-all',
                colors.bg, colors.text,
              )}
            >
              <span className="flex items-center gap-1.5">
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', colors.dot)} />
                {catInfo ? `${catInfo.icon} ${catInfo.name}` : domain}
              </span>
              {isOpen ? <ChevronDown className="h-3 w-3 opacity-60" /> : <ChevronRight className="h-3 w-3 opacity-60" />}
            </button>

            {isOpen && (
              <div className="ml-2 mt-0.5 space-y-2 pb-1">
                {Object.entries(subdomains).map(([subdomain, cards]) => (
                  <div key={subdomain} className="pl-2 border-l-2 border-gray-200 dark:border-gray-700">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1 px-1">
                      {SUBCATEGORY_LABELS[subdomain] || subdomain}
                    </p>
                    {cards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => navigate(`/feed/${card.id}`)}
                        className="w-full text-left px-2 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors group"
                      >
                        <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2 leading-snug group-hover:text-primary-600 dark:group-hover:text-primary-400">
                          {card.title}
                        </p>
                        {card.pinned_count > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                            <Users className="h-2.5 w-2.5" /> {card.pinned_count}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ message, action }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 text-center gap-4">
      <div className="text-5xl opacity-40">📭</div>
      <p className="text-secondary-500 dark:text-gray-400 text-sm max-w-xs leading-relaxed">{message}</p>
      {action}
    </div>
  );
}

function LoginPrompt() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-20 gap-5 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
        <LogIn className="h-7 w-7 text-primary-600 dark:text-primary-400" />
      </div>
      <div>
        <p className="text-secondary-800 dark:text-gray-200 font-semibold text-base">Sign in to your feed</p>
        <p className="text-sm text-secondary-500 dark:text-gray-400 mt-1 max-w-xs">
          Save cards from the Global Feed and create custom research cards.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link to="/login" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition-colors">
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
        <Link to="/register" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-secondary-200 dark:border-gray-600 text-secondary-700 dark:text-gray-300 text-sm font-semibold hover:bg-secondary-50 dark:hover:bg-gray-700 transition-colors">
          Create account
        </Link>
      </div>
    </div>
  );
}

function FeedGrid({ cards, myPins, onPin, onUnpin }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {cards.map((card) => {
        const pinned = myPins.some((p) => p.card_id === card.id);
        return (
          <FeedCard
            key={card.id}
            card={card}
            isPinned={pinned}
            onPin={onPin}
            onUnpin={onUnpin}
          />
        );
      })}
    </div>
  );
}

export default function HomePage({ isDark, toggleDark }) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('global');
  const [domain, setDomain] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [hoursBack, setHoursBack] = useState('24');

  const [globalCards, setGlobalCards] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const [myPins, setMyPins] = useState([]);
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState('');

  const [trending, setTrending] = useState({});
  const [trendingLoading, setTrendingLoading] = useState(false);

  const loadGlobal = useCallback(async () => {
    setGlobalLoading(true);
    setGlobalError('');
    try {
      const params = { limit: 100 };
      if (domain) params.domain = domain;
      if (subdomain) params.subdomain = subdomain;
      const res = await feedCardsApi.getGlobal(params);
      setGlobalCards(res.cards || []);
    } catch {
      setGlobalError('Failed to load global feed.');
    } finally {
      setGlobalLoading(false);
    }
  }, [domain, subdomain]);

  const loadMyFeed = useCallback(async () => {
    if (!isAuthenticated) return;
    setMyLoading(true);
    setMyError('');
    try {
      const pins = await feedCardsApi.getMyFeed();
      setMyPins(pins || []);
    } catch {
      setMyError('Failed to load your feed.');
    } finally {
      setMyLoading(false);
    }
  }, [isAuthenticated]);

  const loadTrending = useCallback(async () => {
    setTrendingLoading(true);
    try {
      const res = await feedCardsApi.getTrending({ limit_per_subdomain: 3 });
      setTrending(res.trending || {});
    } catch {
      // silent — sidebar is non-critical
    } finally {
      setTrendingLoading(false);
    }
  }, []);

  useEffect(() => { loadGlobal(); }, [loadGlobal]);
  useEffect(() => { loadTrending(); }, [loadTrending]);
  useEffect(() => { if (activeTab === 'your') loadMyFeed(); }, [activeTab, loadMyFeed]);

  const handlePin = () => loadMyFeed();
  const handleUnpin = (cardId) => setMyPins((prev) => prev.filter((p) => p.card_id !== cardId));

  const myCards = myPins.map((p) => p.card).filter(Boolean);
  const filteredMyCards = myCards.filter((c) => {
    if (domain && c.domain !== domain) return false;
    if (subdomain && c.subdomain !== subdomain) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">Intelligence Feed</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Global news & research, structured by domain</p>
          </div>
          <Link
            to="/custom/browser"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" /> New Research Card
          </Link>
        </div>

        <div className="flex gap-5">
          {/* Left sidebar — Trending */}
          <aside className="hidden lg:flex flex-col w-60 xl:w-64 flex-shrink-0 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden sticky top-4">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                <span className="flex items-center gap-1.5 text-xs font-bold text-gray-700 dark:text-gray-300">
                  <TrendingUp className="h-3.5 w-3.5 text-primary-500" /> Trending
                </span>
                {trendingLoading && (
                  <div className="w-3 h-3 border border-gray-300 border-t-transparent rounded-full animate-spin" />
                )}
              </div>
              <div className="p-3 max-h-[calc(100vh-140px)] overflow-y-auto">
                <TrendingSidebar trending={trending} />
              </div>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0 space-y-5">
            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 w-fit shadow-sm">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                    activeTab === tab.id
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                  )}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Filter bar */}
            <FilterBar
              domain={domain} setDomain={setDomain}
              subdomain={subdomain} setSubdomain={setSubdomain}
              hoursBack={hoursBack} setHoursBack={setHoursBack}
            />

            {/* Global feed */}
            {activeTab === 'global' && (
              <section>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                    {globalCards.length} cards
                  </span>
                  <button
                    onClick={loadGlobal}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    title="Refresh"
                  >
                    <RefreshCw className={cn('h-4 w-4 text-gray-400', globalLoading && 'animate-spin')} />
                  </button>
                </div>

                {globalError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{globalError}</p>}

                {globalLoading && !globalCards.length ? (
                  <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : globalCards.length === 0 ? (
                  <EmptyState
                    message="No global feed cards yet. Admins can seed domain cards from the Admin panel."
                    action={
                      <Link to="/custom/browser" className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                        Create a research card →
                      </Link>
                    }
                  />
                ) : (
                  <FeedGrid cards={globalCards} myPins={myPins} onPin={handlePin} onUnpin={handleUnpin} />
                )}
              </section>
            )}

            {/* Your feed */}
            {activeTab === 'your' && (
              <section>
                {!isAuthenticated ? (
                  <LoginPrompt />
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-xs font-medium text-gray-400 dark:text-gray-500">
                        {filteredMyCards.length} saved cards
                      </span>
                      <button
                        onClick={loadMyFeed}
                        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw className={cn('h-4 w-4 text-gray-400', myLoading && 'animate-spin')} />
                      </button>
                    </div>

                    {myError && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{myError}</p>}

                    {myLoading && !myCards.length ? (
                      <div className="flex justify-center py-20">
                        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    ) : filteredMyCards.length === 0 ? (
                      <EmptyState
                        message="Your feed is empty. Add cards from the Global Feed to see them here."
                        action={
                          <button onClick={() => setActiveTab('global')} className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                            Browse global feed →
                          </button>
                        }
                      />
                    ) : (
                      <FeedGrid cards={filteredMyCards} myPins={myPins} onPin={handlePin} onUnpin={handleUnpin} />
                    )}
                  </>
                )}
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
