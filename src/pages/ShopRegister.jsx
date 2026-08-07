/**
 * client/src/pages/ShopRegister.jsx
 * Shop Owner Registration Page — Light Theme Clean SaaS UI
 */

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function ShopRegister() {
  const { register } = useAuth();
  
  const [shopName, setShopName] = useState('');
  const [shopId, setShopId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-generate shopId slug from shopName
  const handleNameChange = (e) => {
    const val = e.target.value;
    setShopName(val);
    if (!shopId || shopId === shopName.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      setShopId(val.toLowerCase().trim().replace(/[^a-z0-9]/g, '-'));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({
        shopName,
        shopId,
        email,
        password,
        city,
      });
      window.location.href = '/';
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card glass-card">
        <div className="auth-header">
          <span className="auth-logo">🏪</span>
          <h2 className="auth-title">Register Your Shop</h2>
          <p className="auth-sub">Get your unique shop QR standee in 1 minute</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Shop Name</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Kaif Print Hub"
              value={shopName}
              onChange={handleNameChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Shop ID / Handle (URL Slug)</label>
            <input
              type="text"
              className="input"
              placeholder="kaif-print-hub"
              value={shopId}
              onChange={(e) => setShopId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              required
            />
            <span className="form-hint">Mobile URL: wifi-drop.com/mobile?shop={shopId || 'your-shop-id'}</span>
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              className="input"
              placeholder="owner@kaifprinthub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
            {loading ? 'Creating Shop Account…' : 'Create Shop Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have a shop account? <a href="/login" className="auth-link">Login</a></p>
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
          max-width: 440px;
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
          gap: var(--space-1);
        }
        .form-label {
          font-size: var(--font-size-xs);
          font-weight: 600;
          color: var(--text-secondary);
        }
        .form-hint {
          font-size: 10px;
          color: var(--text-muted);
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
