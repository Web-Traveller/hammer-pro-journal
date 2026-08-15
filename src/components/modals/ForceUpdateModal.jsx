import React from 'react';
import { AlertTriangle, Download, ExternalLink, ShieldAlert, Mail } from 'lucide-react';

export function ForceUpdateModal({ versionStatus }) {
  if (!versionStatus || !versionStatus.forceUpdate) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#ffffff',
          borderRadius: '1.5rem',
          padding: '2.25rem 2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.25rem',
          border: '1px solid #e2e8f0'
        }}
      >
        {/* ICON */}
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

        {/* TITLE */}
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            Critical Update Required
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem', lineHeight: '1.45' }}>
            {versionStatus.message ||
              `A mandatory update (v${versionStatus.latestVersion}) is required to continue using Hammer Pro Journal.`}
          </div>
        </div>

        {/* VERSION COMPARISON BADGES */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backgroundColor: '#f8fafc',
            padding: '0.75rem 1.25rem',
            borderRadius: '0.85rem',
            border: '1px solid #e2e8f0',
            width: '100%',
            justifyContent: 'space-around',
            boxSizing: 'border-box'
          }}
        >
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Your Version
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#dc2626' }}>
              v{versionStatus.currentVersion}
            </div>
          </div>

          <div style={{ color: '#cbd5e1', fontSize: '1.2rem' }}>➔</div>

          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>
              Required Version
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: '#059669' }}>
              v{versionStatus.latestVersion}
            </div>
          </div>
        </div>

        {/* ACTION BUTTON */}
        <a
          href={versionStatus.downloadUrl || 'https://github.com/Web-Traveller/hammer-pro-journal/releases'}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            width: '100%',
            backgroundColor: '#064e3b',
            color: '#ffffff',
            padding: '0.9rem',
            borderRadius: '0.85rem',
            fontWeight: 800,
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            textDecoration: 'none',
            boxShadow: '0 4px 14px rgba(6, 78, 59, 0.3)',
            boxSizing: 'border-box'
          }}
        >
          <Download size={18} />
          <span>Download Update Now</span>
        </a>

        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          Need help? Contact the developer for assistance.
        </div>
      </div>
    </div>
  );
}
