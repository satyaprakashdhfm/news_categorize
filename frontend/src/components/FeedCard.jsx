import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { feedCardsApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';
import { CATEGORIES, DOMAIN_COLORS, SUBCATEGORY_LABELS, formatTimeAgo } from '@/utils/helpers';

const DOMAIN_CSS = {
  POL: 'var(--domain-policy)',
  ECO: 'var(--domain-econ)',
  BUS: 'var(--domain-biz)',
  TEC: 'var(--domain-tech)',
  OTH: 'var(--domain-others)',
};

function ConfidenceBar({ value = 60 }) {
  const filled = Math.round((value || 60) / 20);
  return (
    <div className="conf" title={`Signal strength ${value}`}>
      {[...Array(5)].map((_, i) => (
        <span key={i} className={`conf__tick ${i < filled ? 'is-on' : ''}`} />
      ))}
    </div>
  );
}

function SourcePips({ sources = [] }) {
  const items = sources.slice(0, 4);
  return (
    <div className="pips">
      {items.map((s, i) => (
        <span className="pip" key={i} title={s}>{(s || '').slice(0, 2)}</span>
      ))}
      {sources.length > 4 && <span className="pip pip--more">+{sources.length - 4}</span>}
    </div>
  );
}

export default function FeedCard({ card, isPinned = false, onPin, onUnpin, reason }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [pinning, setPinning] = useState(false);

  const category = CATEGORIES.find((c) => c.id === card.domain);
  const accentColor = DOMAIN_CSS[card.domain] || DOMAIN_CSS.OTH;

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

  const isDomain = card.type === 'domain';

  return (
    <article
      onClick={() => navigate(`/feed/${card.id}`)}
      className={`card ${isDomain ? 'card--domain' : 'card--research'}`}
      style={{ '--cardAccent': accentColor }}
    >
      <div className="card__spine" />

      {/* Recommendation reason badge */}
      {reason && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 4,
          fontSize: 'var(--t-micro)', color: 'var(--accent)', fontWeight: 500,
          marginBottom: 4,
        }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M6 1 L7.5 4.5 L11 5 L8.5 7.5 L9 11 L6 9.5 L3 11 L3.5 7.5 L1 5 L4.5 4.5Z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
          </svg>
          {reason}
        </div>
      )}

      {/* Header */}
      <header className="card__head">
        <span className="card__kind">
          {isDomain ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1.5" y="1.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.2"/><path d="M3.5 5 h3 M3.5 7 h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="4" cy="4" r="2.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6 6 L8.5 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          )}
          {isDomain ? 'Domain' : 'Research'}
        </span>
        {dnaCode && <span className="tag tag--code">{dnaCode}</span>}
        {card.is_global && !card.created_by && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            fontSize: 'var(--t-micro)', fontWeight: 600,
            color: '#f0c060',
            background: 'rgba(240,192,96,0.12)',
            border: '1px solid rgba(240,192,96,0.25)',
            borderRadius: 4,
            padding: '1px 6px',
            letterSpacing: '0.02em',
          }}>
            <svg width="9" height="9" viewBox="0 0 12 12" fill="none">
              <path d="M6 1L7.2 4.2H10.5L7.9 6.3L8.9 9.5L6 7.5L3.1 9.5L4.1 6.3L1.5 4.2H4.8Z" fill="#f0c060"/>
            </svg>
            Official
          </span>
        )}
      </header>

      {/* Title */}
      <h3 className="card__title" style={{ fontSize: 'var(--t-body)', lineHeight: 1.4 }}>
        {card.title}
      </h3>

      {/* Summary */}
      {card.description && (
        <p className="card__summary" style={{ fontSize: 'var(--t-meta)' }}>
          {card.description}
        </p>
      )}

      {/* Domain chip */}
      {category && (
        <div className="card__chips">
          <span className="chip chip--tiny" style={{ '--chipColor': accentColor }}>
            <span className="chip__dot" />
            {category.name}
          </span>
        </div>
      )}

      {/* Footer */}
      <footer className="card__foot">
        <SourcePips sources={card.sources || (card.source ? [card.source] : ['web'])} />
        <span className="card__meta">
          <ConfidenceBar value={card.signal_strength || 60} />
          <time className="meta">{card.created_at ? formatTimeAgo(card.created_at) : ''}</time>
          {card.pinned_count > 0 && (
            <span className="meta" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M3 1.5 H9 Q10.5 1.5 10.5 3 V10.5 L6 8 L1.5 10.5 V3 Q1.5 1.5 3 1.5Z" stroke="currentColor" strokeWidth="1.3" fill="none"/>
              </svg>
              {card.pinned_count}
            </span>
          )}
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          {isAuthenticated && (
            <button
              onClick={handlePin}
              disabled={pinning}
              className="btn"
              style={{
                padding: '3px 10px',
                fontSize: 'var(--t-micro)',
                ...(isPinned ? {
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  borderColor: 'rgba(127,212,209,0.2)',
                } : {})
              }}
            >
              {pinning ? '...' : isPinned ? 'Saved' : '+ Save'}
            </button>
          )}
          <button className="card__go" aria-label="Open card">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 10 L10 4 M10 4 H5.5 M10 4 V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </footer>
    </article>
  );
}
