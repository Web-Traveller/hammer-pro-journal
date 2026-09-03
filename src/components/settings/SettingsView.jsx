import React from 'react';
import { RefreshCw, Download, Upload, User, Cloud, ShieldCheck, Key } from 'lucide-react';
import { APP_VERSION, APP_NAME, APP_FULL_NAME } from '../../version';

export function SettingsView({
  settings,
  availableMonths = [],
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

  function formatMonthName(monthStr) {
    if (!monthStr || monthStr.length < 7) return monthStr;
    const [year, month] = monthStr.split('-');
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const mIndex = parseInt(month, 10) - 1;
    return `${monthNames[mIndex] || month} ${year}`;
  }

  const isMonthBilled = (mStr) => {
    if (!settings.enableMonthlyPlatformFee) return false;
    if (settings.platformFeeMonths && settings.platformFeeMonths[mStr] !== undefined) {
      const val = settings.platformFeeMonths[mStr];
      if (typeof val === 'boolean') return val;
      if (typeof val === 'number') return val > 0;
      if (typeof val === 'object' && val !== null) return !!val.enabled;
    }
    if (settings.platformFeeStartMonth) {
      return mStr >= settings.platformFeeStartMonth;
    }
    return true; // default enabled if no custom override
  };

  const getMonthFeeAmount = (mStr) => {
    const defaultFee = settings.monthlyPlatformFee !== undefined ? settings.monthlyPlatformFee : 120;
    if (settings.platformFeeMonths && settings.platformFeeMonths[mStr] !== undefined) {
      const val = settings.platformFeeMonths[mStr];
      if (typeof val === 'number') return val;
      if (typeof val === 'object' && val !== null && val.fee !== undefined) return val.fee;
    }
    return defaultFee;
  };

  const toggleMonthBilling = (mStr, enabled) => {
    const currentFee = getMonthFeeAmount(mStr);
    const updated = {
      ...(settings.platformFeeMonths || {}),
      [mStr]: { enabled, fee: currentFee }
    };
    onSaveSettings({ ...settings, platformFeeMonths: updated });
  };

  const updateMonthFeeAmount = (mStr, fee) => {
    const enabled = isMonthBilled(mStr);
    const updated = {
      ...(settings.platformFeeMonths || {}),
      [mStr]: { enabled, fee: parseFloat(fee) || 0 }
    };
    onSaveSettings({ ...settings, platformFeeMonths: updated });
  };

  const setAllMonthsBilling = (enabled) => {
    const updated = {};
    (availableMonths || []).forEach(mStr => {
      updated[mStr] = { enabled, fee: getMonthFeeAmount(mStr) };
    });
    onSaveSettings({ ...settings, platformFeeMonths: updated, platformFeeStartMonth: null });
  };

  const setStartFromMonth = (startMonth) => {
    const updated = {};
    (availableMonths || []).forEach(mStr => {
      updated[mStr] = { enabled: mStr >= startMonth, fee: getMonthFeeAmount(mStr) };
    });
    onSaveSettings({ ...settings, platformFeeMonths: updated, platformFeeStartMonth: startMonth });
  };

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
                {userProfile ? (userProfile.canCloudSync ? `${userProfile.email} • Cloud Sync Active` : `${userProfile.email} • Local Storage Mode`) : 'Sign in to access your account.'}
              </div>
            </div>
          </div>

          <button className="btn" onClick={onOpenAuthModal} style={{ fontSize: '0.82rem', padding: '0.5rem 1rem' }}>
            <User size={15} /> {userProfile ? 'Manage Account' : 'Sign In'}
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
          <label className="form-label">Top Best &amp; Worst Trades Shown in Journal</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '320px' }}>
            <input
              type="number"
              min="1"
              max="10"
              className="form-input"
              value={settings.journalTopTradesCount !== undefined ? settings.journalTopTradesCount : 2}
              onChange={(e) => {
                let val = parseInt(e.target.value, 10);
                if (isNaN(val)) val = 2;
                val = Math.max(1, Math.min(10, val));
                onSaveSettings({ ...settings, journalTopTradesCount: val, enableJournal: true });
              }}
              style={{ width: '90px' }}
            />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>trades per category (1 – 10, default 2)</span>
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
            Controls how many top winning trades and worst losing trades are highlighted in the Session Journal tab.
          </span>
        </div>
      </div>

      {/* SECTION 4: BROKERAGE & PLATFORM COST ENGINE */}
      <div className="settings-section">
        <div className="settings-title">Brokerage &amp; Platform Cost Engine</div>
        <div className="settings-desc">Calculate true net profits by factoring in per-share brokerage fees and fixed monthly software / market data subscriptions.</div>

        {/* 1. Per-Share Execution Brokerage Fees */}
        <div style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '0.75rem', marginBottom: '1rem', backgroundColor: 'var(--bg-main, #ffffff)' }}>
          <div className="form-group" style={{ marginBottom: settings.enableFees ? '0.75rem' : 0 }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                className="toggle-checkbox"
                checked={settings.enableFees}
                onChange={(e) => onSaveSettings({ ...settings, enableFees: e.target.checked })}
                style={{ display: 'none' }}
              />
              <span className="toggle-slider"></span>
              <span className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                Deduct Broker Execution Fees (Per-Share)
              </span>
            </label>
          </div>

          {settings.enableFees && (
            <div className="form-group" style={{ marginBottom: 0, marginTop: '0.75rem', paddingLeft: '2.75rem' }}>
              <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Fee Rate Per Round-Trip Share ($)</label>
              <input
                type="number"
                step="0.001"
                min="0"
                className="form-input"
                value={settings.feePerShare}
                onChange={(e) => onSaveSettings({ ...settings, feePerShare: parseFloat(e.target.value) || 0 })}
                style={{ maxWidth: '240px' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                Example: $0.005 / share (1,000 round-trip shares = $5.00 execution fee)
              </span>
            </div>
          )}
        </div>

        {/* 2. Fixed Monthly Platform & Market Data Subscription Fees */}
        <div style={{ padding: '1rem', border: '1px solid var(--border-light)', borderRadius: '0.75rem', backgroundColor: 'var(--bg-main, #ffffff)' }}>
          <div className="form-group" style={{ marginBottom: settings.enableMonthlyPlatformFee ? '1rem' : 0 }}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                className="toggle-checkbox"
                checked={!!settings.enableMonthlyPlatformFee}
                onChange={(e) => onSaveSettings({ ...settings, enableMonthlyPlatformFee: e.target.checked })}
                style={{ display: 'none' }}
              />
              <span className="toggle-slider"></span>
              <span className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                Deduct Monthly Platform &amp; Market Data Charges
              </span>
            </label>
          </div>

          {settings.enableMonthlyPlatformFee && (
            <div style={{ paddingLeft: '2.75rem' }}>
              {/* Default Fee Rate Input */}
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Default Monthly Platform / Data Fee ($)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    className="form-input"
                    placeholder="e.g. 100, 120, 150"
                    value={settings.monthlyPlatformFee !== undefined ? settings.monthlyPlatformFee : 120}
                    onChange={(e) => {
                      const newDef = parseFloat(e.target.value) || 0;
                      onSaveSettings({ ...settings, monthlyPlatformFee: newDef });
                    }}
                    style={{ maxWidth: '200px' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Standard charge applied per active billing month
                  </span>
                </div>
              </div>

              {/* Per-Month Fee Management Box */}
              <div style={{
                marginTop: '1.25rem',
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-light)',
                borderRadius: '0.75rem',
                padding: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      Select Billing Months
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Choose which months you paid platform &amp; data charges (unselected months are free / $0 deduction).
                    </div>
                  </div>

                  {/* Quick Action Shortcuts */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                      onClick={() => setAllMonthsBilling(true)}
                    >
                      Bill All Months
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ fontSize: '0.72rem', padding: '0.25rem 0.55rem' }}
                      onClick={() => setAllMonthsBilling(false)}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                {/* Quick Start Dropdown */}
                {availableMonths && availableMonths.length > 0 && (
                  <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)' }}>Quick Rule:</span>
                    <select
                      className="form-select"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.6rem', maxWidth: '260px' }}
                      value={settings.platformFeeStartMonth || ''}
                      onChange={(e) => {
                        const start = e.target.value;
                        if (start) setStartFromMonth(start);
                        else setAllMonthsBilling(true);
                      }}
                    >
                      <option value="">Custom per-month selection...</option>
                      {availableMonths.map(m => (
                        <option key={m} value={m}>Bill from {formatMonthName(m)} onwards</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* List / Grid of Months */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.65rem' }}>
                  {availableMonths && availableMonths.length > 0 ? (
                    availableMonths.map(mStr => {
                      const isBilled = isMonthBilled(mStr);
                      const feeVal = getMonthFeeAmount(mStr);

                      return (
                        <div
                          key={mStr}
                          style={{
                            padding: '0.75rem',
                            borderRadius: '0.6rem',
                            border: `1.5px solid ${isBilled ? 'var(--hero-green)' : 'var(--border-light)'}`,
                            backgroundColor: isBilled ? '#f0fdf4' : '#ffffff',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', margin: 0 }}>
                              <input
                                type="checkbox"
                                checked={isBilled}
                                onChange={(e) => toggleMonthBilling(mStr, e.target.checked)}
                                style={{ accentColor: 'var(--hero-green)', cursor: 'pointer', width: '15px', height: '15px' }}
                              />
                              <span style={{ fontWeight: 800, fontSize: '0.84rem', color: isBilled ? '#166534' : 'var(--text-main)' }}>
                                {formatMonthName(mStr)}
                              </span>
                            </label>
                            <span
                              className={`badge ${isBilled ? 'badge-profit' : ''}`}
                              style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem', backgroundColor: isBilled ? '#dcfce7' : '#f3f4f6', color: isBilled ? '#15803d' : '#6b7280' }}
                            >
                              {isBilled ? `-$${Number(feeVal).toFixed(0)}` : 'Free ($0)'}
                            </span>
                          </div>

                          {isBilled && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                              <span style={{ fontSize: '0.72rem', color: '#166534', fontWeight: 600 }}>Fee ($):</span>
                              <input
                                type="number"
                                step="1"
                                min="0"
                                className="form-input"
                                value={feeVal}
                                onChange={(e) => updateMonthFeeAmount(mStr, e.target.value)}
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.78rem', height: '26px', width: '80px', fontWeight: 700 }}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ gridColumn: '1 / -1', color: 'var(--text-muted)', fontSize: '0.8rem', fontStyle: 'italic', padding: '0.5rem 0' }}>
                      Import sessions to see your trading months listed here for individual billing selection.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
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
