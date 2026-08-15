import React, { useState } from 'react';
import { Zap, Lock, Mail, User, ShieldCheck, ArrowRight, Loader } from 'lucide-react';
import { signInUser, signUpUser } from '../../services/authService';

export function MobileAuthScreen({ onLoginSuccess, onToast }) {
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }
    if (authMode === 'signup' && !name) {
      setErrorMsg('Please enter your trader name.');
      return;
    }

    setLoading(true);
    setErrorMsg('');

    try {
      if (authMode === 'signin') {
        const res = await signInUser(email, password);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to sign in. Please verify your credentials.');
          if (onToast) onToast(res.error || 'Sign in failed', 'error');
        } else {
          if (onToast) onToast('Signed in successfully! Loading cloud trades...', 'success');
          if (onLoginSuccess) onLoginSuccess(res.profile);
        }
      } else {
        const res = await signUpUser(email, password, name);
        if (!res.success) {
          setErrorMsg(res.error || 'Failed to create account.');
          if (onToast) onToast(res.error || 'Sign up failed', 'error');
        } else {
          if (onToast) onToast('Account created! Signed in.', 'success');
          if (onLoginSuccess) onLoginSuccess(res.profile);
        }
      }
    } catch (err) {
      setErrorMsg(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        width: '100%',
        backgroundColor: '#f4f5f7',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 'calc(1.5rem + env(safe-area-inset-top, 0px))',
        paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'calc(1.5rem + env(safe-area-inset-left, 0px))',
        paddingRight: 'calc(1.5rem + env(safe-area-inset-right, 0px))',
        boxSizing: 'border-box',
        fontFamily: "'Plus Jakarta Sans', 'Inter', sans-serif"
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#ffffff',
          borderRadius: '1.5rem',
          padding: '2rem 1.5rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 8px 30px rgba(0, 0, 0, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          boxSizing: 'border-box'
        }}
      >
        {/* LOGO & TITLE */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.4rem' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '14px',
              backgroundColor: 'rgba(6, 78, 59, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '0.25rem'
            }}
          >
            <Zap size={26} color="#064e3b" />
          </div>
          <div style={{ fontSize: '1.35rem', fontWeight: 900, color: '#064e3b', letterSpacing: '-0.02em' }}>
            Hammer Pro Mobile
          </div>
          <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>
            {authMode === 'signin'
              ? 'Sign in to access and review your live cloud journal.'
              : 'Create an account to sync trades across all your devices.'}
          </div>
        </div>

        {/* ERROR MESSAGE BANNER */}
        {errorMsg && (
          <div
            style={{
              backgroundColor: '#ffe4e6',
              border: '1px solid #fecdd3',
              borderRadius: '0.75rem',
              padding: '0.65rem 0.85rem',
              color: '#9f1239',
              fontSize: '0.78rem',
              fontWeight: 600
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {authMode === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>
                Trader Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '13px' }} />
                <input
                  type="text"
                  placeholder="e.g. Alex"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem 0.75rem 0.75rem 2.35rem',
                    borderRadius: '0.85rem',
                    border: '1px solid #e5e7eb',
                    fontSize: '0.9rem',
                    boxSizing: 'border-box',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.35rem',
                  borderRadius: '0.85rem',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#374151', textTransform: 'uppercase' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="#9ca3af" style={{ position: 'absolute', left: '12px', top: '13px' }} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.75rem 0.75rem 0.75rem 2.35rem',
                  borderRadius: '0.85rem',
                  border: '1px solid #e5e7eb',
                  fontSize: '0.9rem',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              backgroundColor: '#064e3b',
              border: 'none',
              borderRadius: '0.85rem',
              color: '#ffffff',
              padding: '0.85rem',
              fontWeight: 800,
              fontSize: '0.92rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(6, 78, 59, 0.25)',
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? (
              <Loader size={18} className="anim-spin" />
            ) : (
              <>
                <span>{authMode === 'signin' ? 'Sign In & Access Cloud' : 'Create Account'}</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* TOGGLE SIGN IN / SIGN UP */}
        <div style={{ textAlign: 'center', paddingTop: '0.25rem' }}>
          <button
            type="button"
            onClick={() => {
              setAuthMode(authMode === 'signin' ? 'signup' : 'signin');
              setErrorMsg('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#064e3b',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {authMode === 'signin'
              ? "Don't have an account? Sign Up"
              : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
