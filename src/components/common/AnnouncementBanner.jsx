import React from 'react';
import { Bell, Info, AlertTriangle, CheckCircle, AlertOctagon, X, ExternalLink } from 'lucide-react';

export function AnnouncementBanner({ broadcast, onDismiss }) {
  if (!broadcast || !broadcast.message) return null;

  const typeStyles = {
    info: {
      bg: '#eff6ff',
      border: '#bfdbfe',
      text: '#1e40af',
      icon: <Info size={16} color="#2563eb" />
    },
    warning: {
      bg: '#fffbeb',
      border: '#fde68a',
      text: '#92400e',
      icon: <AlertTriangle size={16} color="#d97706" />
    },
    success: {
      bg: '#f0fdf4',
      border: '#bbf7d0',
      text: '#166534',
      icon: <CheckCircle size={16} color="#16a34a" />
    },
    critical: {
      bg: '#fef2f2',
      border: '#fecaca',
      text: '#991b1b',
      icon: <AlertOctagon size={16} color="#dc2626" />
    }
  };

  const style = typeStyles[broadcast.type] || typeStyles.info;

  return (
    <div
      style={{
        backgroundColor: style.bg,
        borderBottom: `1px solid ${style.border}`,
        color: style.text,
        padding: '0.65rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.85rem',
        fontSize: '0.84rem',
        zIndex: 50,
        animation: 'fadeIn 0.25s ease-in-out'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {style.icon}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', minWidth: 0 }}>
          {broadcast.title && (
            <span style={{ fontWeight: 800, letterSpacing: '-0.01em' }}>
              {broadcast.title}:
            </span>
          )}
          <span style={{ fontWeight: 600 }}>
            {broadcast.message}
          </span>
          {broadcast.linkUrl && (
            <a
              href={broadcast.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: 'inherit',
                fontWeight: 700,
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                marginLeft: '4px'
              }}
            >
              {broadcast.linkText || 'Learn more'} <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {broadcast.allowDismiss && onDismiss && (
        <button
          onClick={onDismiss}
          title="Dismiss announcement"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.75,
            transition: 'opacity 0.15s ease'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.75'; }}
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
