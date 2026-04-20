import React from 'react';
import { Clock3 } from 'lucide-react';
import { CATEGORIES, DOMAIN_COLORS } from '@/utils/helpers';
import { cn } from '@/utils/helpers';

const TIME_OPTIONS = [
  { value: '6', label: '6h' },
  { value: '24', label: '24h' },
  { value: '48', label: '48h' },
  { value: '72', label: '72h' },
  { value: '168', label: '7d' },
  { value: '', label: 'All' },
];

export default function FilterBar({ domain, setDomain, hoursBack, setHoursBack }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-3 px-4 bg-white dark:bg-gray-800 rounded-xl border border-secondary-100 dark:border-gray-700 shadow-sm">
      {/* Domain pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button
          onClick={() => setDomain('')}
          className={cn(
            'px-3 py-1 rounded-full text-xs font-semibold transition-all',
            !domain
              ? 'bg-secondary-900 dark:bg-white text-white dark:text-gray-900'
              : 'bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'
          )}
        >
          All
        </button>
        {CATEGORIES.map((cat) => {
          const colors = DOMAIN_COLORS[cat.id];
          const active = domain === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setDomain(active ? '' : cat.id)}
              className={cn(
                'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                active ? `${colors.bg} ${colors.text}` : 'bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'
              )}
            >
              {cat.icon} {cat.name}
            </button>
          );
        })}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px h-5 bg-secondary-200 dark:bg-gray-600 mx-1" />

      {/* Time window pills */}
      <div className="flex items-center gap-1.5">
        <Clock3 className="h-3.5 w-3.5 text-secondary-400 dark:text-gray-500 flex-shrink-0" />
        {TIME_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setHoursBack(opt.value)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
              hoursBack === opt.value
                ? 'bg-secondary-900 dark:bg-white text-white dark:text-gray-900'
                : 'bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
