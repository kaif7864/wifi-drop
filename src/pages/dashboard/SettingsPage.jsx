/**
 * client/src/pages/dashboard/SettingsPage.jsx
 * Page: Shop Settings — Shop Info, Printer Config, Nickname, App Settings
 * Connected to Backend Settings API
 */

import { useState, useEffect } from 'react';
import axios from 'axios';
import { config } from '../../config';

export function SettingsPage({ shop, sessionId }) {
  const [shopName, setShopName] = useState(shop?.shopName || '');
  const [shopNickname, setShopNickname] = useState(shop?.nickname || localStorage.getItem('wifidrop_shop_nickname') || '');
  const [ownerName, setOwnerName] = useState(shop?.ownerName || '');
  const [phone, setPhone] = useState(shop?.phone || '');
  const [address, setAddress] = useState(shop?.address || '');
  const [upiId, setUpiId] = useState(shop?.upiId || '');

  const [defaultPrinter, setDefaultPrinter] = useState('HP LaserJet Pro M404n');
  const [paperSize, setPaperSize] = useState('A4');
  const [colorMode, setColorMode] = useState('Auto');
  const [autoMarkPrinted, setAutoMarkPrinted] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [theme, setTheme] = useState('light');
  const [language, setLanguage] = useState('en');

  const [savedMsg, setSavedMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const shopId = shop?.shopId || 'default';

  // Load existing settings from backend on mount
  useEffect(() => {
    fetchSettings();
  }, [shopId]);

  async function fetchSettings() {
    try {
      const res = await axios.get(`${config.serverUrl}/api/settings?shopId=${shopId}`);
      if (res.data.success && res.data.settings) {
        const s = res.data.settings;
        if (s.shopName) setShopName(s.shopName);
        if (s.nickname) setShopNickname(s.nickname);
        if (s.ownerName) setOwnerName(s.ownerName);
        if (s.phone) setPhone(s.phone);
        if (s.address) setAddress(s.address);
        if (s.upiId) setUpiId(s.upiId);
        if (s.defaultPrinter) setDefaultPrinter(s.defaultPrinter);
        if (s.paperSize) setPaperSize(s.paperSize);
        if (s.colorMode) setColorMode(s.colorMode);
        if (s.theme) {
          setTheme(s.theme);
          document.documentElement.setAttribute('data-theme', s.theme);
        }
        if (s.language) setLanguage(s.language);
        if (s.autoMarkPrinted !== undefined) setAutoMarkPrinted(s.autoMarkPrinted);
        if (s.notifEnabled !== undefined) setNotifEnabled(s.notifEnabled);
        if (s.soundEnabled !== undefined) setSoundEnabled(s.soundEnabled);
      }
    } catch {}
  }

  async function handleSaveShop() {
    setSaving(true);
    try {
      localStorage.setItem('wifidrop_shop_nickname', shopNickname);
      localStorage.setItem('wifidrop_lang', language);
      localStorage.setItem('wifidrop_theme', theme);
      document.documentElement.setAttribute('data-theme', theme);

      await axios.put(`${config.serverUrl}/api/settings`, {
        shopId,
        shopName,
        nickname: shopNickname,
        ownerName,
        phone,
        address,
        upiId,
        defaultPrinter,
        paperSize,
        colorMode,
        autoMarkPrinted,
        notifEnabled,
        soundEnabled,
        theme,
        language,
      });

      setSavedMsg('✅ All settings saved to backend successfully!');
      setTimeout(() => setSavedMsg(''), 3000);
    } catch (err) {
      alert('Failed to save settings: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page">
      {savedMsg && (
        <div className="save-toast">{savedMsg}</div>
      )}

      <div className="settings-grid">
        {/* Shop Information */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-icon">🏪</span>
            <div>
              <h3 className="settings-card-title">Shop Information</h3>
              <p className="settings-card-sub">Your shop's public details and branding</p>
            </div>
          </div>

          <div className="settings-form">
            <div className="form-group">
              <label className="form-label">Shop Name</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Ramesh Print & Copy"
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Your Nickname <span className="form-optional">(optional — shown to customers)</span></label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Bhai, Boss, Ramesh bhai"
                value={shopNickname}
                onChange={(e) => setShopNickname(e.target.value)}
              />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Owner Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Owner's full name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+91 XXXXX XXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Shop Address</label>
              <textarea
                className="input textarea"
                rows={3}
                placeholder="Full address, city, PIN code"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">UPI ID <span className="form-optional">(for payment QR)</span></label>
              <input
                type="text"
                className="input"
                placeholder="e.g. ramesh@paytm"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* App Preferences */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-icon">⚙️</span>
            <div>
              <h3 className="settings-card-title">App Preferences</h3>
              <p className="settings-card-sub">Dashboard behavior and notifications</p>
            </div>
          </div>

          <div className="settings-form">
            <div className="toggle-setting">
              <div>
                <div className="toggle-setting-name">🖨️ Auto-Mark Files as Printed</div>
                <div className="toggle-setting-sub">Automatically mark files printed when opened</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={autoMarkPrinted} onChange={(e) => setAutoMarkPrinted(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="toggle-setting">
              <div>
                <div className="toggle-setting-name">🔔 Desktop Notifications</div>
                <div className="toggle-setting-sub">Show alerts when new files arrive</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={notifEnabled} onChange={(e) => setNotifEnabled(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="toggle-setting">
              <div>
                <div className="toggle-setting-name">🔊 Sound Alerts</div>
                <div className="toggle-setting-sub">Play sound when file received</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={soundEnabled} onChange={(e) => setSoundEnabled(e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="form-group" style={{ marginTop: '0.75rem' }}>
              <label className="form-label">Theme</label>
              <select className="input" value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="light">☀️ Light Mode</option>
                <option value="dark">🌙 Dark Mode (Coming Soon)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Language</label>
              <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="en">🇬🇧 English</option>
                <option value="hi">🇮🇳 Hindi (Coming Soon)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Account & Session Info */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-icon">🔑</span>
            <div>
              <h3 className="settings-card-title">Account & Session</h3>
              <p className="settings-card-sub">Your session and account details</p>
            </div>
          </div>

          <div className="info-rows">
            {[
              { label: 'Session ID', value: sessionId },
              { label: 'Shop ID', value: shop?.shopId || 'Not registered' },
              { label: 'Account Status', value: shop ? '✅ Registered Shop' : '🔓 Guest Mode' },
              { label: 'App Version', value: 'WiFi Drop v2.0' },
            ].map((row) => (
              <div key={row.label} className="info-row">
                <span className="info-label">{row.label}</span>
                <span className="info-val">{row.value}</span>
              </div>
            ))}
          </div>

          {!shop && (
            <div className="register-cta">
              <p style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: '0.75rem' }}>
                Register your shop to unlock all features and keep your data safe.
              </p>
              <div className="flex items-center gap-2">
                <a href="/register" className="btn btn-primary btn-sm">🏪 Register Shop</a>
                <a href="/login" className="btn btn-secondary btn-sm">🔑 Shop Login</a>
              </div>
            </div>
          )}
        </div>

        {/* Printer Settings */}
        <div className="settings-card">
          <div className="settings-card-header">
            <span className="settings-icon">🖨️</span>
            <div>
              <h3 className="settings-card-title">Printer Settings</h3>
              <p className="settings-card-sub">Default printer and print preferences</p>
            </div>
          </div>

          <div className="settings-form">
            <div className="form-group">
              <label className="form-label">Default Printer</label>
              <select className="input" value={defaultPrinter} onChange={(e) => setDefaultPrinter(e.target.value)}>
                <option>HP LaserJet Pro M404n</option>
                <option>Canon PIXMA G4010</option>
                <option>Epson EcoTank L3150</option>
                <option>Brother DCP-L2531DW</option>
              </select>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Paper Size</label>
                <select className="input" value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                  <option>A4</option>
                  <option>A3</option>
                  <option>Letter</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Color Mode</label>
                <select className="input" value={colorMode} onChange={(e) => setColorMode(e.target.value)}>
                  <option>Auto</option>
                  <option>Color</option>
                  <option>B&W</option>
                </select>
              </div>
            </div>
            <div className="printer-status-row">
              <span className="dot dot-success" />
              <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>Printer Ready</span>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="settings-footer">
        <button className="btn btn-primary" onClick={handleSaveShop} disabled={saving}>
          {saving ? 'Saving...' : '💾 Save All Settings'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => fetchSettings()}>
          ↩ Discard Changes
        </button>
      </div>

      <style>{`
        .settings-page { display: flex; flex-direction: column; gap: 1.25rem; width: 100%; }
        .save-toast { position: fixed; top: 1rem; right: 1rem; background: #ECFDF5; color: #059669; border: 1px solid #D1FAE5; border-radius: 12px; padding: 12px 18px; font-size: 0.88rem; font-weight: 700; z-index: 999; box-shadow: 0 4px 12px rgba(0,0,0,0.1); animation: slideIn 0.2s ease; }
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .settings-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .settings-card { background: white; border: 1px solid #E2E8F0; border-radius: 18px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.04); }
        .settings-card-header { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 1.25rem; padding-bottom: 1.25rem; border-bottom: 1px solid #F1F5F9; }
        .settings-icon { font-size: 1.8rem; background: #F8FAFC; padding: 8px; border-radius: 12px; border: 1px solid #E2E8F0; }
        .settings-card-title { font-size: 0.95rem; font-weight: 800; color: #0F172A; }
        .settings-card-sub { font-size: 0.78rem; color: #94A3B8; margin-top: 2px; }
        .settings-form { display: flex; flex-direction: column; gap: 0.875rem; }
        .form-group { display: flex; flex-direction: column; gap: 5px; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
        .form-label { font-size: 0.8rem; font-weight: 700; color: #374151; }
        .form-optional { font-size: 0.7rem; color: #94A3B8; font-weight: 500; }
        .textarea { resize: vertical; min-height: 72px; }
        .toggle-setting { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: 12px 14px; background: #F8FAFC; border-radius: 10px; border: 1px solid #F1F5F9; }
        .toggle-setting-name { font-size: 0.84rem; font-weight: 700; color: #0F172A; }
        .toggle-setting-sub { font-size: 0.72rem; color: #94A3B8; margin-top: 2px; }
        .toggle-switch { position: relative; width: 44px; height: 24px; flex-shrink: 0; cursor: pointer; }
        .toggle-switch input { opacity: 0; width: 0; height: 0; }
        .toggle-slider { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: #CBD5E1; border-radius: 999px; transition: 0.2s; }
        .toggle-slider::before { content: ''; position: absolute; width: 18px; height: 18px; left: 3px; top: 3px; background: white; border-radius: 50%; transition: 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
        .toggle-switch input:checked + .toggle-slider { background: #4F46E5; }
        .toggle-switch input:checked + .toggle-slider::before { transform: translateX(20px); }
        .info-rows { display: flex; flex-direction: column; gap: 6px; }
        .info-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: #F8FAFC; border-radius: 10px; border: 1px solid #F1F5F9; }
        .info-label { font-size: 0.8rem; font-weight: 700; color: #64748B; }
        .settings-footer { display: flex; align-items: center; gap: 0.75rem; padding: 1.25rem 1.5rem; background: white; border: 1px solid #E2E8F0; border-radius: 16px; }

        /* ── Mobile Responsive Breakpoints ── */
        @media (max-width: 1024px) {
          .settings-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 768px) {
          .settings-page {
            gap: 1rem;
          }

          .settings-card {
            padding: 1.15rem;
            border-radius: 16px;
          }

          .form-row {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }

          .settings-footer {
            flex-direction: column;
            gap: 0.5rem;
            padding: 1rem;
          }

          .settings-footer .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
