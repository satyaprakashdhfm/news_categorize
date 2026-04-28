import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage({ isDark, toggleDark }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ color: 'var(--accent)', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 32 32" width="48" height="48">
              <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2.5 16 H29.5 M16 2.5 V29.5 M5 8 Q16 14 27 8 M5 24 Q16 18 27 24" fill="none" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="16" cy="16" r="2.2" fill="currentColor"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Welcome back</h1>
          <p className="meta" style={{ marginTop: 6 }}>Sign in to your Curio account</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="field">
            <label className="field__label">Email</label>
            <div className="field__input">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>
          <div className="field">
            <label className="field__label">Password</label>
            <div className="field__input">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          {error && <p style={{ fontSize: 'var(--t-meta)', color: 'var(--signal-critical)', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 0', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
          <p className="meta" style={{ textAlign: 'center' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Create one</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
