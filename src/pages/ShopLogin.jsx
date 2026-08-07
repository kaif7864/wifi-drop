/**
 * client/src/pages/ShopLogin.jsx
 * Shop Owner Login Page — Light Theme Clean SaaS UI
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function ShopLogin() {
  const { login } = useAuth();
  const [input, setInput] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(input, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-card">
        <div className="auth-header">
          <span className="auth-logo">📡</span>
          <h2 className="auth-title">Shop Owner Login</h2>
          <p className="auth-sub">Access your store transfer dashboard</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Shop ID or Email</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. kaif-print-hub"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Logging in…' : 'Login to Dashboard'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have a shop account? <a href="/register" className="auth-link">Register Shop</a></p>
        </div>
      </div>

      <style>{`
        .auth-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-primary);
          padding: var(--space-4);
        }
        .auth-card {
          width: 100%;
          max-width: 400px;
          padding: var(--space-8);
        }
        .auth-header {
          text-align: center;
          margin-bottom: var(--space-6);
        }
        .auth-logo { font-size: 2.5rem; }
        .auth-title {
          font-size: var(--font-size-xl);
          font-weight: 700;
          color: var(--text-primary);
          margin-top: var(--space-2);
        }
        .auth-sub {
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        .auth-form {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }
        .form-label {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--text-secondary);
        }
        .auth-footer {
          text-align: center;
          margin-top: var(--space-6);
          font-size: var(--font-size-xs);
          color: var(--text-muted);
        }
        .auth-link {
          color: var(--accent-primary);
          font-weight: 600;
          text-decoration: none;
        }
        .alert-error {
          background: #fef2f2;
          color: #991b1b;
          border: 1px solid #fecaca;
          padding: var(--space-3);
          border-radius: var(--radius-md);
          font-size: var(--font-size-xs);
          margin-bottom: var(--space-4);
        }
        .w-full { width: 100%; }
      `}</style>
    </div>
  );
}
