import React from 'react';
import { CATEGORIES, SUBCATEGORY_CODES, SUBCATEGORY_LABELS, cn } from '@/utils/helpers';

const DOMAIN_COLORS = {
  POL: 'var(--domain-policy)',
  ECO: 'var(--domain-econ)',
  BUS: 'var(--domain-biz)',
  TEC: 'var(--domain-tech)',
  OTH: 'var(--domain-others)',
};

const TIME_OPTIONS = [
  { value: '6', label: '6h' },
  { value: '24', label: '24h' },
  { value: '48', label: '48h' },
  { value: '72', label: '72h' },
  { value: '168', label: '7d' },
  { value: '', label: 'All' },
];

export default function FilterBar({ domain, setDomain, subdomain, setSubdomain, hoursBack, setHoursBack }) {
  const subcodes = domain ? (SUBCATEGORY_CODES[domain] || []) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="filters">
        {/* Domain chips */}
        <div className="filters__chips">
          <button
            className={`fchip ${!domain ? 'is-on' : ''}`}
            onClick={() => { setDomain(''); setSubdomain?.(''); }}
          >
            All
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              className={`fchip ${domain === cat.id ? 'is-on' : ''}`}
              style={{ '--chipColor': DOMAIN_COLORS[cat.id] }}
              onClick={() => { setDomain(domain === cat.id ? '' : cat.id); setSubdomain?.(''); }}
            >
              <span className="fchip__dot" />
              {cat.name}
            </button>
          ))}
        </div>

        {/* Time pills */}
        <div className="filters__time">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--fg-3)' }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/>
            <path d="M6 3 V6 L8 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          {TIME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`tchip ${hoursBack === opt.value ? 'is-on' : ''}`}
              onClick={() => setHoursBack(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* DNA subcategory row */}
      {domain && subcodes.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          padding: '8px 0',
        }}>
          <span className="eyebrow" style={{ marginRight: 4 }}>DNA</span>
          <button
            className={`tchip ${!subdomain ? 'is-on' : ''}`}
            onClick={() => setSubdomain?.('')}
          >
            All
          </button>
          {subcodes.map((code) => (
            <button
              key={code}
              className={`tchip ${subdomain === code ? 'is-on' : ''}`}
              onClick={() => setSubdomain?.(subdomain === code ? '' : code)}
              title={SUBCATEGORY_LABELS[code]}
            >
              {domain}·{code}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
