import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '@/services/api';
import { useAuth } from '@/context/AuthContext';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', interests: [] });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.register(form);
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-0)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ color: 'var(--accent)', marginBottom: 16, display: 'flex', justifyContent: 'center' }}>
            <svg viewBox="0 0 32 32" width="48" height="48">
              <circle cx="16" cy="16" r="14" fill="none" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M2.5 16 H29.5 M16 2.5 V29.5 M5 8 Q16 14 27 8 M5 24 Q16 18 27 24" fill="none" stroke="currentColor" strokeWidth="1.2"/>
              <circle cx="16" cy="16" r="2.2" fill="currentColor"/>
            </svg>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--t-h2)', fontWeight: 700, color: 'var(--fg-1)', margin: 0 }}>Create account</h1>
          <p className="meta" style={{ marginTop: 6 }}>Join Curio to build your feed</p>
        </div>

        <form onSubmit={handleSubmit} className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Name', field: 'name', type: 'text', placeholder: 'Your name' },
            { label: 'Email', field: 'email', type: 'email', placeholder: 'you@example.com' },
            { label: 'Password', field: 'password', type: 'password', placeholder: '' },
          ].map(({ label, field, type, placeholder }) => (
            <div key={field} className="field">
              <label className="field__label">{label}</label>
              <div className="field__input">
                <input
                  type={type}
                  required
                  value={form[field]}
                  onChange={set(field)}
                  placeholder={placeholder}
                />
              </div>
            </div>
          ))}

          {/* Domain Interests */}
          <div className="field">
            <label className="field__label">Interested domains</label>
            <p style={{ fontSize: 'var(--t-micro)', color: 'var(--fg-3)', margin: '0 0 8px' }}>
              Select domains to get personalized recommendations
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { id: 'POL', name: 'Policy & Governance', icon: '🏛', color: 'var(--domain-policy)' },
                { id: 'ECO', name: 'Economy', icon: '📊', color: 'var(--domain-econ)' },
                { id: 'BUS', name: 'Business', icon: '💼', color: 'var(--domain-biz)' },
                { id: 'TEC', name: 'Science & Tech', icon: '⚡', color: 'var(--domain-tech)' },
                { id: 'OTH', name: 'Others', icon: '🌐', color: 'var(--domain-others)' },
              ].map(d => {
                const selected = form.interests.includes(d.id);
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setForm(f => ({
                      ...f,
                      interests: selected
                        ? f.interests.filter(x => x !== d.id)
                        : [...f.interests, d.id]
                    }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 'var(--r-md)',
                      border: `1.5px solid ${selected ? d.color : 'var(--line-1)'}`,
                      background: selected ? `${d.color}15` : 'var(--bg-2)',
                      color: selected ? d.color : 'var(--fg-3)',
                      cursor: 'pointer', fontSize: 'var(--t-meta)', fontWeight: 500,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>{d.icon}</span>
                    <span>{d.name}</span>
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6 L5 8.5 L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p style={{ fontSize: 'var(--t-meta)', color: 'var(--signal-critical)', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn btn--primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 0', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
          <p className="meta" style={{ textAlign: 'center' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--accent)', fontWeight: 500, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
