import React from 'react';
import { RefreshCw, Download, Upload, User, Cloud, ShieldCheck, Key } from 'lucide-react';
import { APP_VERSION, APP_NAME, APP_FULL_NAME } from '../../version';

export function SettingsView({
  settings,
  onSaveSettings,
  timezone = 'US_EASTERN',
  onTimezoneChange,
  updateStatus,
  checkingUpdate,
  onManualCheckUpdate,
  onExportBackup,
  onImportBackup,
  userProfile,
  onOpenAuthModal,
  licenseCheck
}) {
  const isPro = licenseCheck?.status === 'active' && licenseCheck?.features?.allow_cloud_sync;

  return (
    <div>
      {/* SECTION 1: USER ACCOUNT & CLOUD BACKUP */}
      <div className="settings-section">
        <div className="settings-title">User Account &amp; Cloud Backup</div>
        <div className="settings-desc">Manage your trader profile and choose your backup &amp; sync preference</div>

        <div style={{
          backgroundColor: '#f8fafc',
          border: '1px solid var(--border-light)',
          borderRadius: '0.85rem',
          padding: '1.25rem',
          marginBottom: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {userProfile ? (
              <img
                src={userProfile.avatarUrl}
                alt={userProfile.name}
                style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fff', border: '1px solid var(--border-light)' }}
              />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                <User size={24} />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>{userProfile ? userProfile.name : 'Guest User (Offline Local)'}</span>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 800,
                  backgroundColor: isPro ? '#dcfce7' : '#f1f5f9',
                  color: isPro ? '#15803d' : '#475569',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '999px',
                  border: `1px solid ${isPro ? '#86efac' : '#cbd5e1'}`
                }}>
                  {isPro ? 'PRO' : 'BASIC'}
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {userProfile ? userProfile.email : 'Your logs are currently stored locally on this machine.'}
              </div>
            </div>
          </div>

          <button className="btn" onClick={onOpenAuthModal} style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
            <User size={15} /> {userProfile ? 'Manage Account & Cloud Sync' : 'Sign In / Enable Cloud Sync'}
          </button>
        </div>
      </div>

      {/* SECTION 2: APP VERSION & AUTOMATIC UPDATES */}
      <div className="settings-section">
        <div className="settings-title">About {APP_NAME} &amp; Application Updates</div>
        <div className="settings-desc">Level 2 tape scalping analytics &amp; session journal for active US equity traders</div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', backgroundColor: '#f9fafb', border: '1px solid var(--border-light)', borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>{APP_FULL_NAME}</span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.3rem',
                background: '#ecfdf5',
                color: '#047857',
                border: '1px solid #a7f3d0',
                borderRadius: '999px',
                padding: '0.15rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 800
              }}>
                ● v{APP_VERSION}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {updateStatus || "Automatic background updates active. New releases download silently and apply on app restart."}
            </div>
          </div>

          <button
            className="btn btn-secondary"
            onClick={onManualCheckUpdate}
            disabled={checkingUpdate}
            style={{ fontSize: '0.8rem', padding: '0.45rem 0.9rem' }}
          >
            <RefreshCw size={14} className={checkingUpdate ? 'spin-animation' : ''} />
            {checkingUpdate ? "Checking..." : "Check for Updates Now"}
          </button>
        </div>
      </div>

      {/* SECTION 3: GENERAL PREFERENCES & DATE PARSING */}
      <div className="settings-section">
        <div className="settings-title">General Preferences &amp; Date Parsing</div>
        <div className="settings-desc">Configure default date format parsing, timezone, and display behavior</div>

        <div className="form-group">
          <label className="form-label">Default Date Parsing Format</label>
          <select
            value={settings.dateFormat}
            onChange={(e) => onSaveSettings({ ...settings, dateFormat: e.target.value })}
            className="form-select"
          >
            <option value="DD-MM-YY">DD-MM-YY / DD/MM/YYYY (Day First - Standard)</option>
            <option value="MM/DD/YY">MM/DD/YY / MM-DD-YYYY (US Month First)</option>
            <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Standard)</option>
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Defensive validation automatically prevents impossible months (e.g. 27-07-2026 is always parsed correctly).
          </span>
        </div>

        <div className="form-group">
          <label className="form-label">Display Timezone</label>
          <select
            value={timezone}
            onChange={(e) => onTimezoneChange && onTimezoneChange(e.target.value)}
            className="form-select"
          >
            <option value="US_EASTERN">🇺🇸 US Eastern Time (EDT/EST - Market Ground Truth)</option>
            <option value="INDIA_IST">🇮🇳 Indian Standard Time (IST - UTC+5:30)</option>
          </select>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Automatically converts all trade executions, time buckets, and chart axes to your chosen timezone.
          </span>
        </div>

        <div className="form-group">
          <label className="toggle-switch">
            <input
              type="checkbox"
              className="toggle-checkbox"
              checked={settings.enableJournal}
              onChange={(e) => onSaveSettings({ ...settings, enableJournal: e.target.checked })}
              style={{ display: 'none' }}
            />
            <span className="toggle-slider"></span>
            <span className="form-label" style={{ marginBottom: 0 }}>Enable Session Journaling Tab</span>
          </label>
        </div>
      </div>

      {/* SECTION 4: FEES ENGINE */}
      <div className="settings-section">
        <div className="settings-title">Fees Calculation Engine</div>
        <div className="settings-desc">Track net profits by automatically deducting broker execution fees per round-trip share</div>

        <div className="form-group">
          <label className="toggle-switch">
            <input
              type="checkbox"
              className="toggle-checkbox"
              checked={settings.enableFees}
              onChange={(e) => onSaveSettings({ ...settings, enableFees: e.target.checked })}
              style={{ display: 'none' }}
            />
            <span className="toggle-slider"></span>
            <span className="form-label" style={{ marginBottom: 0 }}>Enable Fees Deductions</span>
          </label>
        </div>

        {settings.enableFees && (
          <div className="form-group">
            <label className="form-label">Fee Rate Per Round-Trip Share ($)</label>
            <input
              type="number"
              step="0.005"
              className="form-input"
              value={settings.feePerShare}
              onChange={(e) => onSaveSettings({ ...settings, feePerShare: parseFloat(e.target.value) || 0 })}
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Example: $0.05 per round-trip share (100 shares bought &amp; sold = 100 × $0.05 = $5.00 fee)
            </span>
          </div>
        )}
      </div>

      {/* SECTION 5: LOCAL BACKUP ARCHIVES */}
      <div className="settings-section">
        <div className="settings-title">Local Backup Archives &amp; Restore</div>
        <div className="settings-desc">Export compressed journal snapshots or restore previous backups directly</div>

        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={onExportBackup}>
            <Download size={16} /> Export Full Journal Backup (.json)
          </button>
          <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={onImportBackup} />
            <Upload size={16} /> Restore Backup File
          </label>
        </div>
      </div>
    </div>
  );
}
