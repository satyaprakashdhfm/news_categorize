import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Cpu, Globe, Pin, PinOff } from 'lucide-react';
import { feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES, DOMAIN_COLORS, SUBCATEGORY_LABELS } from '@/utils/helpers';
import { cn } from '@/utils/helpers';

export default function FeedCard({ card, isPinned = false, onPin, onUnpin }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [pinning, setPinning] = useState(false);

  const category = CATEGORIES.find((c) => c.id === card.domain);
  const colors = DOMAIN_COLORS[card.domain] || DOMAIN_COLORS.OTH;
  const subcategoryLabel = SUBCATEGORY_LABELS[card.subdomain] || card.subdomain;

  const handlePin = async (e) => {
    e.stopPropagation();
    if (!isAuthenticated || pinning) return;
    setPinning(true);
    try {
      if (isPinned) {
        await feedCardsApi.unpin(card.id);
        onUnpin?.(card.id);
      } else {
        await feedCardsApi.pin(card.id);
        onPin?.(card.id);
      }
    } catch {
      // silent
    } finally {
      setPinning(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 rounded-xl border shadow-sm overflow-hidden cursor-pointer',
        'hover:shadow-md hover:border-opacity-80 transition-all duration-150',
        colors.border,
      )}
      onClick={() => navigate(`/feed/${card.id}`)}
    >
      {/* Header */}
      <div className={cn('px-4 py-3 flex items-center justify-between gap-2', colors.bg)}>
        <div className="flex items-center gap-2 min-w-0">
          {card.type === 'custom'
            ? <Cpu className={cn('h-4 w-4 flex-shrink-0', colors.text)} />
            : <Globe className={cn('h-4 w-4 flex-shrink-0', colors.text)} />}
          <span className={cn('text-sm font-bold truncate', colors.text)}>{card.title}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {card.domain && (
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold bg-white/60 dark:bg-black/20', colors.text)}>
              {category?.icon} {card.domain}
            </span>
          )}
          {card.subdomain && card.subdomain !== 'OTH' && (
            <span className={cn('hidden sm:inline px-2 py-0.5 rounded-full text-xs font-medium bg-white/40 dark:bg-black/10', colors.text)}>
              {subcategoryLabel}
            </span>
          )}
          {isAuthenticated && (
            <button
              onClick={handlePin}
              disabled={pinning}
              title={isPinned ? 'Remove from My Feed' : 'Add to My Feed'}
              className={cn(
                'p-1 rounded-lg transition-all',
                isPinned ? 'text-primary-600 dark:text-primary-400' : 'text-secondary-400 hover:text-primary-600 dark:hover:text-primary-400',
              )}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Preview row */}
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <p className="text-xs text-secondary-500 dark:text-gray-400 line-clamp-2 flex-1">
          {card.description || (card.type === 'domain' ? 'Latest articles in this domain' : 'Browser research results')}
        </p>
        <ArrowRight className="h-4 w-4 text-secondary-400 dark:text-gray-500 flex-shrink-0" />
      </div>
    </div>
  );
}
