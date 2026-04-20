import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Cpu, Globe2, Pin, PinOff } from 'lucide-react';
import { feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES, DOMAIN_COLORS, SUBCATEGORY_LABELS, formatTimeAgo } from '@/utils/helpers';
import { cn } from '@/utils/helpers';

const ACCENT_TOP = {
  POL: 'bg-blue-500',
  ECO: 'bg-emerald-500',
  BUS: 'bg-violet-500',
  TEC: 'bg-orange-500',
  OTH: 'bg-gray-400',
};

const DNA_BADGE = {
  POL: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:ring-blue-700',
  ECO: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:ring-emerald-700',
  BUS: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:ring-violet-700',
  TEC: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-900/40 dark:text-orange-300 dark:ring-orange-700',
  OTH: 'bg-gray-50 text-gray-600 ring-1 ring-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600',
};

const TYPE_BADGE = {
  domain: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  custom: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300',
};

export default function FeedCard({ card, isPinned = false, onPin, onUnpin }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [pinning, setPinning] = useState(false);

  const colors = DOMAIN_COLORS[card.domain] || DOMAIN_COLORS.OTH;
  const category = CATEGORIES.find((c) => c.id === card.domain);
  const subcategoryLabel = SUBCATEGORY_LABELS[card.subdomain] || card.subdomain;

  const dnaCode = card.domain
    ? card.subdomain && card.subdomain !== 'OTH'
      ? `${card.domain}·${card.subdomain}`
      : card.domain
    : null;

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
      onClick={() => navigate(`/feed/${card.id}`)}
      className={cn(
        'group relative bg-white dark:bg-gray-800 rounded-2xl overflow-hidden cursor-pointer',
        'border border-gray-100 dark:border-gray-700/80',
        'shadow-sm hover:shadow-xl hover:-translate-y-0.5',
        'transition-all duration-200 ease-out flex flex-col',
      )}
    >
      {/* Domain color accent bar */}
      <div className={cn('h-[3px] w-full flex-shrink-0', ACCENT_TOP[card.domain] || 'bg-gray-300 dark:bg-gray-600')} />

      <div className="p-4 flex flex-col flex-1 gap-2.5">
        {/* Top row: type badge + DNA code */}
        <div className="flex items-center justify-between gap-2">
          <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide', TYPE_BADGE[card.type] || TYPE_BADGE.custom)}>
            {card.type === 'domain'
              ? <><Globe2 className="h-3 w-3" /> Domain</>
              : <><Cpu className="h-3 w-3" /> Research</>}
          </span>
          {dnaCode && (
            <span className={cn('font-mono text-[11px] font-bold px-2 py-0.5 rounded-md', DNA_BADGE[card.domain] || DNA_BADGE.OTH)}>
              {dnaCode}
            </span>
          )}
        </div>

        {/* Title */}
        <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
          {card.title}
        </h3>

        {/* Description */}
        {card.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
            {card.description}
          </p>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 dark:border-gray-700/60">
          <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
            {category && (
              <span className={cn('font-semibold', colors.text)}>
                {category.icon} {category.name}
              </span>
            )}
            {card.created_at && (
              <>
                <span className="text-gray-300 dark:text-gray-600">·</span>
                <span>{formatTimeAgo(card.created_at)}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isAuthenticated && (
              <button
                onClick={handlePin}
                disabled={pinning}
                title={isPinned ? 'Remove from My Feed' : 'Save to My Feed'}
                className={cn(
                  'p-1.5 rounded-lg transition-all',
                  isPinned
                    ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                    : 'text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}
              >
                {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              </button>
            )}
            <span className="p-1.5 rounded-lg text-gray-300 dark:text-gray-600 group-hover:text-primary-500 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-all">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
