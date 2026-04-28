import React from 'react';
import { formatTimeAgo, CATEGORIES, SUBCATEGORY_LABELS } from '@/utils/helpers';

const DOMAIN_CSS = {
  POL: 'var(--domain-policy)',
  ECO: 'var(--domain-econ)',
  BUS: 'var(--domain-biz)',
  TEC: 'var(--domain-tech)',
  OTH: 'var(--domain-others)',
};

export default function NewsCard({ article }) {
  const category = CATEGORIES.find((c) => c.id === article.category);
  const subcategoryLabel = SUBCATEGORY_LABELS[article.subcategory] || article.subcategory;
  const accentColor = DOMAIN_CSS[article.category] || DOMAIN_CSS.OTH;

  return (
    <div className="card" style={{ cursor: 'default', gap: 10 }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
        <span style={{ fontSize: 'var(--t-meta)', fontWeight: 500, color: accentColor }}>
          {category?.name || article.category}
        </span>
        {article.subcategory && article.subcategory !== 'OTH' && (
          <span className="tag" style={{ fontSize: 'var(--t-micro)' }}>{subcategoryLabel}</span>
        )}
        {article.country && <span className="meta">{article.country}</span>}
        <span className="meta" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="M6 3 V6 L8 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          {formatTimeAgo(article.published_at)}
        </span>
      </div>

      {/* Title */}
      <h3 style={{ fontSize: 'var(--t-body)', fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.4, margin: 0,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{article.title}</h3>

      {/* Summary */}
      {article.summary && (
        <p style={{
          fontSize: 'var(--t-meta)', color: 'var(--fg-2)', lineHeight: 1.55, margin: 0,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{article.summary}</p>
      )}

      {/* Footer */}
      <footer className="card__foot">
        {article.dna_code && (
          <span className="tag tag--code" style={{ fontSize: 'var(--t-micro)' }}>{article.dna_code}</span>
        )}
        <span style={{ flex: 1 }} />
        {article.thread_id && (
          <span className="meta" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M6 2 V10 M3 5 L6 2 L9 5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Thread
          </span>
        )}
        {article.source_url && (
          <a href={article.source_url} target="_blank" rel="noopener noreferrer"
            style={{ color: 'var(--accent)', fontSize: 'var(--t-meta)', fontWeight: 500, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={(e) => e.stopPropagation()}>
            Source
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M4 10 L10 4 M10 4 H5.5 M10 4 V8.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </a>
        )}
      </footer>
    </div>
  );
}
