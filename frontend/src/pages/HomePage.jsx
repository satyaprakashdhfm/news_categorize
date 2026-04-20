import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';
import FilterBar from '@/components/FilterBar';
import FeedCard from '@/components/FeedCard';
import { feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { Sparkles, Globe2, LogIn, Plus, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/helpers';

const TABS = [
  { id: 'your', label: 'Your Feed', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'global', label: 'Global Feed', icon: <Globe2 className="h-4 w-4" /> },
];

function EmptyState({ message, action }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-center gap-3">
      <div className="text-4xl">📭</div>
      <p className="text-secondary-600 dark:text-gray-400 text-sm max-w-xs">{message}</p>
      {action}
    </div>
  );
}

function LoginPrompt() {
  return (
    <div className="col-span-full flex flex-col items-center justify-center py-16 gap-4 text-center">
      <div className="text-5xl">🔐</div>
      <p className="text-secondary-700 dark:text-gray-300 font-medium">Sign in to see your personal feed</p>
      <p className="text-sm text-secondary-500 dark:text-gray-400 max-w-xs">
        Create an account to build and save your own custom feed cards from browser research.
      </p>
      <div className="flex items-center gap-3">
        <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
        <Link to="/register" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400 text-sm font-semibold hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
          Create account
        </Link>
      </div>
    </div>
  );
}

export default function HomePage({ isDark, toggleDark }) {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('global');
  const [domain, setDomain] = useState('');
  const [hoursBack, setHoursBack] = useState('24');

  // Global feed state
  const [globalCards, setGlobalCards] = useState([]);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalError, setGlobalError] = useState('');

  // My feed state
  const [myPins, setMyPins] = useState([]);  // UserFeedCard list
  const [myLoading, setMyLoading] = useState(false);
  const [myError, setMyError] = useState('');

  const loadGlobal = useCallback(async () => {
    setGlobalLoading(true);
    setGlobalError('');
    try {
      const params = { limit: 50 };
      if (domain) params.domain = domain;
      const res = await feedCardsApi.getGlobal(params);
      setGlobalCards(res.cards || []);
    } catch {
      setGlobalError('Failed to load global feed.');
    } finally {
      setGlobalLoading(false);
    }
  }, [domain]);

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

  useEffect(() => { loadGlobal(); }, [loadGlobal]);
  useEffect(() => { if (activeTab === 'your') loadMyFeed(); }, [activeTab, loadMyFeed]);

  const handlePin = (cardId) => {
    // Optimistically refresh my feed
    loadMyFeed();
  };

  const handleUnpin = (cardId) => {
    setMyPins((prev) => prev.filter((p) => p.card_id !== cardId));
  };

  const myCards = myPins.map((p) => p.card).filter(Boolean);
  const displayedGlobal = domain ? globalCards.filter((c) => !c.domain || c.domain === domain) : globalCards;

  return (
    <div className="min-h-screen bg-secondary-50 dark:bg-gray-900 transition-colors">
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="container mx-auto px-4 py-6 space-y-4">
        {/* Page header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-secondary-900 dark:text-white">Intelligence Feed</h1>
            <p className="text-sm text-secondary-500 dark:text-gray-400 mt-0.5">Domain-structured news & research cards</p>
          </div>
          <Link
            to="/custom/browser"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold shadow transition-colors"
          >
            <Plus className="h-4 w-4" /> Create Custom Card
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white dark:bg-gray-800 rounded-xl border border-secondary-100 dark:border-gray-700 w-fit shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all',
                activeTab === tab.id
                  ? 'bg-primary-600 text-white shadow'
                  : 'text-secondary-600 dark:text-gray-400 hover:text-secondary-900 dark:hover:text-white'
              )}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <FilterBar domain={domain} setDomain={setDomain} hoursBack={hoursBack} setHoursBack={setHoursBack} />

        {/* Feed content */}
        {activeTab === 'global' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-secondary-500 dark:text-gray-400">{displayedGlobal.length} cards</span>
              <button onClick={loadGlobal} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-gray-700 transition-colors" title="Refresh">
                <RefreshCw className={cn('h-4 w-4 text-secondary-400 dark:text-gray-500', globalLoading && 'animate-spin')} />
              </button>
            </div>
            {globalError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{globalError}</p>}
            {globalLoading && !globalCards.length ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {displayedGlobal.length === 0 ? (
                  <EmptyState
                    message="No global feed cards yet. Admins can create domain cards from the Admin panel."
                    action={
                      <Link to="/custom/browser" className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                        Create a custom card →
                      </Link>
                    }
                  />
                ) : (
                  displayedGlobal.map((card) => {
                    const pinned = myPins.some((p) => p.card_id === card.id);
                    return (
                      <FeedCard
                        key={card.id}
                        card={card}
                        isPinned={pinned}
                        onPin={handlePin}
                        onUnpin={handleUnpin}
                      />
                    );
                  })
                )}
              </div>
            )}
          </section>
        )}

        {activeTab === 'your' && (
          <section>
            {!isAuthenticated ? (
              <div className="grid grid-cols-1">
                <LoginPrompt />
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-secondary-500 dark:text-gray-400">{myCards.length} cards in your feed</span>
                  <button onClick={loadMyFeed} className="p-1.5 rounded-lg hover:bg-secondary-100 dark:hover:bg-gray-700 transition-colors" title="Refresh">
                    <RefreshCw className={cn('h-4 w-4 text-secondary-400 dark:text-gray-500', myLoading && 'animate-spin')} />
                  </button>
                </div>
                {myError && <p className="text-sm text-red-600 dark:text-red-400 mb-3">{myError}</p>}
                {myLoading && !myCards.length ? (
                  <div className="flex justify-center py-16">
                    <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {myCards.length === 0 ? (
                      <EmptyState
                        message="Your feed is empty. Pin cards from the Global Feed or create custom cards from browser research."
                        action={
                          <div className="flex items-center gap-3 flex-wrap justify-center">
                            <button onClick={() => setActiveTab('global')} className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                              Browse global feed →
                            </button>
                            <Link to="/custom/browser" className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:underline">
                              Create custom card →
                            </Link>
                          </div>
                        }
                      />
                    ) : (
                      myCards
                        .filter((card) => !domain || card.domain === domain)
                        .map((card) => (
                          <FeedCard
                            key={card.id}
                            card={card}
                            isPinned
                            onUnpin={handleUnpin}
                          />
                        ))
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
