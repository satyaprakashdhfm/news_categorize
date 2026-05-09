import React from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/Header';

export default function CustomPage({ isDark, toggleDark }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)' }}>
      <Header isDark={isDark} toggleDark={toggleDark} />

      <main className="main" style={{ maxWidth: 1000, margin: '0 auto', padding: '0 24px' }}>
        {/* Page header */}
        <div className="page">
          <div className="page__title">
            <h1 className="display">Custom<br/><em>Cards</em></h1>
            <p className="page__sub">
              One integrated flow combines Reddit, YouTube, and Google News per run. Two backup scrapers remain available.
            </p>
          </div>
          <div className="page__actions">
            <div className="metric">
              <span className="eyebrow">Integrated runs</span>
              <span className="metric__val mono">--</span>
            </div>
            <div className="metric">
              <span className="eyebrow">Last run</span>
              <span className="metric__val mono">--</span>
            </div>
          </div>
        </div>

        {/* Hub layout */}
        <div className="hub">
          {/* Primary card */}
          <Link to="/custom/browser" className="hub__primary">
            <div className="hub__primaryHead">
              <span className="eyebrow" style={{ color: 'var(--accent)' }}>Primary flow</span>
              <span className="badge badge--info"><span className="badge__dot" />Recommended</span>
            </div>
            <h2 className="hub__primaryTitle">Integrated Browser Research</h2>
            <p className="hub__primaryBody">
              Dynamically discovers Reddit communities, searches YouTube, and scrapes Google News for any query. Each run produces one card with all three source streams and a grounded summary.
            </p>
            <div className="hub__primaryFoot">
              <div className="hub__sources">
                <span className="hub__src"><span className="src__glyph" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'rgba(127,212,209,0.15)' }}>R</span>Reddit</span>
                <span className="hub__src"><span className="src__glyph" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'rgba(127,212,209,0.15)' }}>Y</span>YouTube</span>
                <span className="hub__src"><span className="src__glyph" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', borderColor: 'rgba(127,212,209,0.15)' }}>G</span>Google News</span>
              </div>
              <span className="btn btn--primary">Open Integrated Browser Cards</span>
            </div>
          </Link>

          {/* Backups label */}
          <div className="hub__row">
            <div className="hub__label">
              <span className="eyebrow">Backups</span>
              <span className="meta">Legacy flows — kept for parity while migration completes</span>
            </div>
          </div>

          {/* Backup cards */}
          <div className="hub__backups">
            <Link to="/custom/youtube" className="hub__card hub__card--yt">
              <div className="hub__cardHead">
                <span className="src__glyph" style={{ background: 'rgba(227,93,93,0.12)', color: '#E35D5D', borderColor: 'rgba(227,93,93,0.15)' }}>Y</span>
                <span className="tag">BACKUP</span>
              </div>
              <h3 className="hub__cardTitle">YouTube Scraper</h3>
              <p className="hub__cardBody">Channel handles → latest 5 videos per channel → blog-style summaries.</p>
              <div className="hub__cardFoot">
                <span className="meta">Standalone flow</span>
                <span className="hub__go">→</span>
              </div>
            </Link>

            <Link to="/custom/reddit" className="hub__card hub__card--rd">
              <div className="hub__cardHead">
                <span className="src__glyph" style={{ background: 'rgba(232,145,60,0.12)', color: '#E8913C', borderColor: 'rgba(232,145,60,0.15)' }}>R</span>
                <span className="tag">BACKUP</span>
              </div>
              <h3 className="hub__cardTitle">Reddit Scraper</h3>
              <p className="hub__cardBody">Communities + mode (top / hot / new) → top 5 posts + full summaries.</p>
              <div className="hub__cardFoot">
                <span className="meta">Standalone flow</span>
                <span className="hub__go">→</span>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
