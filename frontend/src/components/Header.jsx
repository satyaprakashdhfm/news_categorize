import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

function GlobeSvg() {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2.5 16 H29.5 M16 2.5 V29.5 M5 8 Q16 14 27 8 M5 24 Q16 18 27 24"
            fill="none" stroke="currentColor" strokeWidth="1.2"/>
      <circle cx="16" cy="16" r="2.2" fill="currentColor"/>
    </svg>
  );
}

export default function Header({ isDark, toggleDark }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const path = location.pathname;
  const activeTab = path === '/' ? 'home'
    : path.startsWith('/custom') ? 'custom'
    : path.startsWith('/llm-usage') ? 'usage'
    : path.startsWith('/help') ? 'help'
    : path.startsWith('/sources') ? 'sources'
    : '';

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate('/');
  };

  return (
    <header className="topbar">
      {/* Brand */}
      <Link to="/" className="brand">
        <span className="brand__mark" aria-hidden>
          <GlobeSvg />
        </span>
        <span className="brand__text">
          <span className="brand__name">Curio</span>
          <span className="brand__tag">News Intelligence</span>
        </span>
      </Link>

      {/* Desktop nav */}
      <nav className="topbar__nav" role="navigation">
        {/* Theme toggle */}
        <button className="navbtn" title="Toggle theme" onClick={toggleDark}>
          {isDark ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1 1M10.2 10.2l1 1M2.8 11.2l1-1M10.2 3.8l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1C4 1 1 4 1 7s3 6 6 6c1.5 0 2.8-.5 3.8-1.5C9 12 7.5 10 7.5 7.5S9 3 11 2.5C10 1.5 8.5 1 7 1z" stroke="currentColor" strokeWidth="1.4"/></svg>
          )}
        </button>

        <Link to="/" className={`navbtn ${activeTab === 'home' ? 'is-active' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7 L7 2 L12 7 V12 H2 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
          <span className="hidden sm:inline">Home</span>
        </Link>

        <Link to="/custom" className={`navbtn ${activeTab === 'custom' ? 'is-active' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="5" cy="5" r="2" stroke="currentColor" strokeWidth="1.4"/><circle cx="10" cy="10" r="2" stroke="currentColor" strokeWidth="1.4"/><path d="M5 7 V9 M7 5 H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          <span className="hidden sm:inline">Custom</span>
        </Link>

        <Link to="/llm-usage" className={`navbtn ${activeTab === 'usage' ? 'is-active' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 12 V6 M5 12 V3 M8 12 V8 M11 12 V5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          <span className="hidden sm:inline">LLM Usage</span>
        </Link>

        <Link to="/help" className={`navbtn ${activeTab === 'help' ? 'is-active' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.4"/><path d="M5.5 5.5 Q5.5 3.5 7 3.5 Q8.5 3.5 8.5 5.5 Q8.5 6.5 7 7 V8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/><circle cx="7" cy="10" r="0.6" fill="currentColor"/></svg>
          <span className="hidden sm:inline">Help</span>
        </Link>

        <Link to="/sources" className={`navbtn ${activeTab === 'sources' ? 'is-active' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="1.5" y="3" width="11" height="8" rx="1" stroke="currentColor" strokeWidth="1.4"/><path d="M4 6h6M4 8.5h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          <span className="hidden sm:inline">Sources</span>
        </Link>

        <div className="topbar__sep hidden sm:block" />

        {isAuthenticated ? (
          <>
            <Link to="/profile" className="navbtn">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.4"/><path d="M2.5 12 Q2.5 9 7 9 Q11.5 9 11.5 12" stroke="currentColor" strokeWidth="1.4"/></svg>
              <span className="hidden sm:inline max-w-[80px] truncate">{user?.name}</span>
              {user?.role === 'admin' && (
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                  padding: '1px 6px', borderRadius: 'var(--r-sm)',
                  background: 'rgba(232,182,92,0.15)', color: 'var(--signal-warn)'
                }}>Admin</span>
              )}
            </Link>
            <button onClick={handleLogout} className="navbtn" title="Sign out">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 4 L12 7 L9 10 M12 7 H5 M6 2 H3 V12 H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        ) : (
          <Link to="/login" className="btn btn--primary">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2V10 M2 6H10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            Sign in
          </Link>
        )}

        {/* Mobile hamburger */}
        <button
          className="navbtn sm:hidden"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menu"
        >
          {menuOpen ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 3 L11 11 M11 3 L3 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4 H12 M2 7 H12 M2 10 H12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          )}
        </button>
      </nav>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: 56, left: 0, right: 0,
          background: 'var(--bg-1)', borderBottom: '1px solid var(--line-1)',
          padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4, zIndex: 99
        }}>
          <Link to="/" onClick={() => setMenuOpen(false)} className={`navbtn ${activeTab === 'home' ? 'is-active' : ''}`}>Home</Link>
          <Link to="/custom" onClick={() => setMenuOpen(false)} className={`navbtn ${activeTab === 'custom' ? 'is-active' : ''}`}>Custom</Link>
          <Link to="/llm-usage" onClick={() => setMenuOpen(false)} className={`navbtn ${activeTab === 'usage' ? 'is-active' : ''}`}>LLM Usage</Link>
          <Link to="/help" onClick={() => setMenuOpen(false)} className={`navbtn ${activeTab === 'help' ? 'is-active' : ''}`}>Help</Link>
          <Link to="/sources" onClick={() => setMenuOpen(false)} className={`navbtn ${activeTab === 'sources' ? 'is-active' : ''}`}>Sources</Link>
          <div style={{ height: 1, background: 'var(--line-1)', margin: '4px 0' }} />
          {isAuthenticated ? (
            <>
              <Link to="/profile" onClick={() => setMenuOpen(false)} className="navbtn">{user?.name}</Link>
              <button onClick={handleLogout} className="navbtn">Sign out</button>
            </>
          ) : (
            <Link to="/login" onClick={() => setMenuOpen(false)} className="btn btn--primary" style={{ justifyContent: 'center' }}>Sign in</Link>
          )}
        </div>
      )}
    </header>
  );
}
