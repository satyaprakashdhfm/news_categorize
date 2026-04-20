import React from 'react';
import { Clock3 } from 'lucide-react';
import { CATEGORIES, DOMAIN_COLORS, SUBCATEGORY_CODES, SUBCATEGORY_LABELS } from '@/utils/helpers';
import { cn } from '@/utils/helpers';

const TIME_OPTIONS = [
  { value: '6', label: '6h' },
  { value: '24', label: '24h' },
  { value: '48', label: '48h' },
  { value: '72', label: '72h' },
  { value: '168', label: '7d' },
  { value: '', label: 'All' },
];

const DNA_BADGE = {
  POL: 'ring-blue-200 dark:ring-blue-700 bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  ECO: 'ring-emerald-200 dark:ring-emerald-700 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  BUS: 'ring-violet-200 dark:ring-violet-700 bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  TEC: 'ring-orange-200 dark:ring-orange-700 bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  OTH: 'ring-gray-200 dark:ring-gray-600 bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export default function FilterBar({ domain, setDomain, subdomain, setSubdomain, hoursBack, setHoursBack }) {
  const subcodes = domain ? (SUBCATEGORY_CODES[domain] || []) : [];

  return (
    <div className="space-y-2">
      {/* Row 1: Domain + time */}
      <div className="flex flex-wrap items-center gap-2 py-2.5 px-4 bg-white dark:bg-gray-800 rounded-xl border border-secondary-100 dark:border-gray-700 shadow-sm">
        {/* Domain pills */}
        <div className="flex items-center gap-1.5 flex-wrap flex-1">
          <button
            onClick={() => { setDomain(''); setSubdomain?.(''); }}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold transition-all',
              !domain
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                : 'bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600',
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
                onClick={() => { setDomain(active ? '' : cat.id); setSubdomain?.(''); }}
                className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold transition-all',
                  active
                    ? `${colors.bg} ${colors.text} shadow-sm`
                    : 'bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600',
                )}
              >
                {cat.icon} {cat.name}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-5 bg-secondary-200 dark:bg-gray-600 mx-1" />

        {/* Time window */}
        <div className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 text-secondary-400 dark:text-gray-500 flex-shrink-0" />
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setHoursBack(opt.value)}
              className={cn(
                'px-2.5 py-1 rounded-full text-xs font-semibold transition-all',
                hoursBack === opt.value
                  ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-sm'
                  : 'bg-secondary-100 dark:bg-gray-700 text-secondary-600 dark:text-gray-300 hover:bg-secondary-200 dark:hover:bg-gray-600',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 2: DNA subcategory pills (only when a domain is selected) */}
      {domain && subcodes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 bg-white/60 dark:bg-gray-800/60 rounded-xl border border-secondary-100 dark:border-gray-700/50">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mr-1">
            DNA
          </span>
          <button
            onClick={() => setSubdomain?.('')}
            className={cn(
              'px-2.5 py-0.5 rounded-md text-xs font-semibold transition-all',
              !subdomain
                ? `ring-1 font-mono ${DNA_BADGE[domain] || DNA_BADGE.OTH}`
                : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600',
            )}
          >
            All
          </button>
          {subcodes.map((code) => {
            const active = subdomain === code;
            return (
              <button
                key={code}
                onClick={() => setSubdomain?.(active ? '' : code)}
                className={cn(
                  'px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all ring-1',
                  active
                    ? DNA_BADGE[domain] || DNA_BADGE.OTH
                    : 'ring-gray-200 dark:ring-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:ring-current',
                )}
                title={SUBCATEGORY_LABELS[code]}
              >
                {domain}·{code}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
