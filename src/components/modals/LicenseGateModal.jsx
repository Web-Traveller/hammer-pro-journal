import React, { useState } from 'react';
import { Key, ShieldAlert, CheckCircle, ArrowRight, Loader, Lock, X } from 'lucide-react';
import { activateLicenseKey, activateTrialSkip } from '../../services/licenseService';

export function LicenseGateModal({ isOpen = false, licenseCheck, userProfile, onLicenseActivated, onClose }) {
  const isMandatoryLock = licenseCheck && !licenseCheck.allowed;
  const showModal = isMandatoryLock || isOpen;

  if (!showModal) return null;

  const [inputKey, setInputKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isBlocked = licenseCheck?.status === 'blocked';

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!inputKey.trim()) {
      setErrorMsg('Please enter your activation code.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await activateLicenseKey(inputKey, userProfile);
      if (!res.success) {
        setErrorMsg(res.error || 'Failed to activate code.');
      } else {
        setSuccessMsg('Activation successful! Unlocking Pro features...');
        setTimeout(() => {
          if (onLicenseActivated) onLicenseActivated();
          if (onClose) onClose();
        }, 1200);
      }
    } catch (err) {
      setErrorMsg(err.message || 'An error occurred during activation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(10px)',
        zIndex: 99998,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      }}
    >
      <div
        style={{
          position: 'relative',
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
          border: '1px solid #e2e8f0',
          boxSizing: 'border-box'
        }}
      >
        {!isMandatoryLock && onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b'
            }}
          >
            <X size={16} />
          </button>
        )}

        {/* ICON */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: isBlocked ? '#fee2e2' : 'rgba(6, 78, 59, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isBlocked ? '#dc2626' : '#064e3b'
          }}
        >
          {isBlocked ? <ShieldAlert size={34} /> : <Key size={32} />}
        </div>

        {/* TITLE */}
        <div>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {isBlocked ? 'Device Access Suspended' : 'Hammer Pro License Required'}
          </div>
          <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.35rem', lineHeight: '1.45' }}>
            {licenseCheck.message ||
              'This installation requires an authorized Hammer Pro License Key to unlock.'}
          </div>
        </div>

        {/* ERROR / SUCCESS NOTICES */}
        {errorMsg && (
          <div
            style={{
              width: '100%',
              backgroundColor: '#ffe4e6',
              border: '1px solid #fecdd3',
              borderRadius: '0.75rem',
              padding: '0.65rem 0.85rem',
              color: '#9f1239',
              fontSize: '0.8rem',
              fontWeight: 600,
              boxSizing: 'border-box'
            }}
          >
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              width: '100%',
              backgroundColor: '#d1fae5',
              border: '1px solid #a7f3d0',
              borderRadius: '0.75rem',
              padding: '0.65rem 0.85rem',
              color: '#065f46',
              fontSize: '0.8rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              boxSizing: 'border-box'
            }}
          >
            <CheckCircle size={16} color="#059669" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* IF BLOCKED: DISPLAY ADMIN NOTICE */}
        {isBlocked ? (
          <div
            style={{
              width: '100%',
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '0.85rem',
              padding: '1rem',
              fontSize: '0.82rem',
              color: '#64748b',
              boxSizing: 'border-box'
            }}
          >
            Your device access has been disabled remotely. Please contact the application administrator or developer to restore access.
          </div>
        ) : (
          /* LICENSE ACTIVATION FORM */
          <form onSubmit={handleActivate} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <Lock size={16} color="#94a3b8" style={{ position: 'absolute', left: '12px', top: '14px' }} />
              <input
                type="text"
                placeholder="HAMMER-PRO-XXXX-XXXX-XXXX"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value.toUpperCase())}
                style={{
                  width: '100%',
                  padding: '0.8rem 0.8rem 0.8rem 2.35rem',
                  borderRadius: '0.85rem',
                  border: '1.5px solid #cbd5e1',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  boxSizing: 'border-box',
                  outline: 'none',
                  textAlign: 'center'
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                backgroundColor: '#064e3b',
                color: '#ffffff',
                padding: '0.85rem',
                borderRadius: '0.85rem',
                fontWeight: 800,
                fontSize: '0.92rem',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(6, 78, 59, 0.3)',
                boxSizing: 'border-box'
              }}
            >
              {loading ? (
                <Loader size={18} className="anim-spin" />
              ) : (
                <>
                  <span>Activate Key &amp; Unlock</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {!licenseCheck.trialUsed && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const res = activateTrialSkip();
                  if (res.success && onLicenseActivated) {
                    onLicenseActivated();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.65rem',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  marginTop: '0.25rem',
                  color: '#475569'
                }}
              >
                Skip for 24-Hour Trial (Local Offline Only • 1-Time Use)
              </button>
            )}

            {licenseCheck.trialExpired && (
              <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 700, marginTop: '0.25rem' }}>
                Your 24-hour trial period has ended. Activation Code is required to proceed.
              </div>
            )}
          </form>
        )}

        <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
          Hammer Pro Protection Engine • Device ID Verified
        </div>
      </div>
    </div>
  );
}
