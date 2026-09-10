import React from 'react';
import { Download, ShieldAlert, Smartphone, Monitor } from 'lucide-react';

export function ForceUpdateModal({ versionStatus }) {
  if (!versionStatus || !versionStatus.forceUpdate) return null;

  const isMobile = versionStatus.isMobile || versionStatus.isAndroid;
  const targetVersion = versionStatus.latestVersion || 'latest';
  const downloadUrl = versionStatus.downloadUrl || (isMobile
    ? `https://github.com/Web-Traveller/hammer-pro-journal/releases/download/v${targetVersion}/HammerPro-Journal-v${targetVersion}-Android.apk`
    : `https://github.com/Web-Traveller/hammer-pro-journal/releases/download/v${targetVersion}/Hammer.Pro.Journal_${targetVersion}_x64-setup.exe`);

  const handleDownloadClick = async () => {
    try {
      if (typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ || window.__TAURI__)) {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        if (openUrl) {
          await openUrl(downloadUrl);
          return;
        }
      }
    } catch (err) {
      console.warn('Tauri openUrl error, falling back to window.open:', err);
    }
    if (typeof window !== 'undefined') {
      window.open(downloadUrl, '_blank');
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.25rem',
        fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, sans-serif"
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '1.5rem',
          padding: '2rem 1.75rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.15rem',
          border: '1px solid #e2e8f0',
          boxSizing: 'border-box'
        }}
      >
        {/* ICON WITH PLATFORM BADGE */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#dc2626'
            }}
          >
            <ShieldAlert size={34} />
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-4px',
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: '#064e3b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
            }}
          >
            {isMobile ? <Smartphone size={14} /> : <Monitor size={14} />}
          </div>
        </div>

        {/* TITLE & DESCRIPTION */}
        <div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {isMobile ? 'Android App Update' : 'Desktop App Update'}
          </div>
          <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.4rem', lineHeight: '1.45' }}>
            {versionStatus.message ||
              `A mandatory update (v${targetVersion}) is required to continue using Hammer Pro Journal.`}
          </div>
        </div>

        {/* VERSION COMPARISON BADGES */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            padding: '0.75rem 1rem',
            borderRadius: '0.85rem',
            border: '1px solid #e2e8f0',
            width: '100%',
            justifyContent: 'space-around',
            boxSizing: 'border-box'
          }}
        >
          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Your Version
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#dc2626' }}>
              v{versionStatus.currentVersion}
            </div>
          </div>

          <div style={{ color: '#cbd5e1', fontSize: '1.1rem' }}>➔</div>

          <div>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Latest Release
            </div>
            <div style={{ fontSize: '0.96rem', fontWeight: 800, color: '#059669' }}>
              v{targetVersion}
            </div>
          </div>
        </div>

        {/* 1-TAP DOWNLOAD BUTTON */}
        <button
          type="button"
          onClick={handleDownloadClick}
          style={{
            width: '100%',
            backgroundColor: isMobile ? '#059669' : '#064e3b',
            color: '#ffffff',
            padding: '0.9rem 1rem',
            borderRadius: '0.85rem',
            fontWeight: 800,
            fontSize: '0.92rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
            boxSizing: 'border-box',
            transition: 'transform 0.15s ease'
          }}
        >
          <Download size={18} />
          <span>{isMobile ? `Download Android APK (v${targetVersion})` : `Download Windows Update (v${targetVersion})`}</span>
        </button>

        {/* INSTRUCTIONS */}
        <div style={{ fontSize: '0.75rem', color: '#64748b', lineHeight: 1.4 }}>
          {isMobile ? (
            <span>
              💡 <strong>Android:</strong> Tap the button above to download the APK. Once downloaded, tap the file in your notification panel or Downloads folder to upgrade.
            </span>
          ) : (
            <span>
              💡 <strong>Windows:</strong> Download the installer to update your desktop setup.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
