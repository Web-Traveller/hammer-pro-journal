import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  User,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ArrowRight,
  Loader,
  ShieldCheck
} from 'lucide-react';
import {
  signInUser,
  signUpUser,
  getActiveUserProfile
} from '../../services/authService';
import { supabase } from '../../services/supabaseClient';

export function MandatoryAuthGateModal({ isOpen = false, onAuthenticated, onToast }) {
  if (!isOpen) return null;

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup' | 'forgot'
  const [loading, setLoading] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const clearMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    clearMessages();
    const cleanEmail = emailInput.trim();
    const cleanPassword = passwordInput.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const profile = await signInUser(cleanEmail, cleanPassword);
      if (profile) {
        if (profile.isBlocked) {
          setErrorMessage('This account has been suspended by the administrator.');
          setLoading(false);
          return;
        }
        setSuccessMessage('Signed in successfully! Loading your journal...');
        if (onToast) onToast(`Welcome back, ${profile.name}!`, 'success');
        setTimeout(() => {
          if (onAuthenticated) onAuthenticated(profile);
        }, 800);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to sign in. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    clearMessages();
    const cleanName = nameInput.trim();
    const cleanEmail = emailInput.trim();
    const cleanPassword = passwordInput.trim();
    const cleanConfirm = confirmPasswordInput.trim();

    if (!cleanName) {
      setErrorMessage('Please enter your name.');
      return;
    }
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (cleanPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (cleanPassword !== cleanConfirm) {
      setErrorMessage('Passwords do not match. Please re-check.');
      return;
    }

    setLoading(true);
    try {
      const profile = await signUpUser(cleanEmail, cleanPassword, cleanName);
      if (profile) {
        setSuccessMessage('Account created successfully! Loading your journal...');
        if (onToast) onToast(`Account created! Welcome, ${profile.name}`, 'success');
        setTimeout(() => {
          if (onAuthenticated) onAuthenticated(profile);
        }, 1000);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearMessages();
    const cleanEmail = emailInput.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter your registered email address.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: 'https://hammer-journal.webtraveller03.workers.dev/reset-password'
      });
      if (error) throw error;
      setSuccessMessage('Password reset email sent! Check your inbox for the link.');
    } catch (err) {
      setErrorMessage(err.message || 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.88)',
        backdropFilter: 'blur(12px)',
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
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          backgroundColor: '#ffffff',
          borderRadius: '1.5rem',
          padding: '2.5rem 2rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: '1.25rem',
          border: '1px solid #e2e8f0',
          boxSizing: 'border-box'
        }}
      >
        {/* Brand Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, #064e3b 0%, #047857 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            boxShadow: '0 10px 20px -5px rgba(6, 78, 59, 0.35)'
          }}
        >
          <Lock size={26} strokeWidth={2.2} />
        </div>

        {/* Header Title & Subtitle */}
        <div>
          <h2 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.02em' }}>
            {mode === 'signin' && 'Sign In to Hammer Pro'}
            {mode === 'signup' && 'Create Your Account'}
            {mode === 'forgot' && 'Reset Your Password'}
          </h2>
          <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.85rem', color: '#64748b', lineHeight: 1.45 }}>
            {mode === 'signin' && 'Enter your registered email and password to access your journal.'}
            {mode === 'signup' && 'Register your account to unlock your trading journal workspace.'}
            {mode === 'forgot' && 'Enter your email to receive a secure password reset link.'}
          </p>
        </div>

        {/* Safe Data Preservation Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.65rem 0.85rem',
            borderRadius: '0.75rem',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            fontSize: '0.76rem',
            color: '#166534',
            textAlign: 'left',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <ShieldCheck size={18} style={{ flexShrink: 0, color: '#16a34a' }} />
          <span>All your local trading logs and settings on this device remain safely preserved.</span>
        </div>

        {/* Error / Success Feedback */}
        {errorMessage && (
          <div
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.75rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textAlign: 'left',
              boxSizing: 'border-box'
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              borderRadius: '0.75rem',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textAlign: 'left',
              boxSizing: 'border-box'
            }}
          >
            <CheckCircle size={16} style={{ flexShrink: 0 }} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Main Form */}
        <form
          onSubmit={mode === 'signin' ? handleSignIn : mode === 'signup' ? handleSignUp : handleForgotPassword}
          style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}
        >
          {mode === 'signup' && (
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Full Name
              </label>
              <div style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  required
                  placeholder="e.g. Alex Trader"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.85rem 0.7rem 2.4rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#f8fafc'
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ textAlign: 'left' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
              <input
                type="email"
                required
                placeholder="trader@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.7rem 0.85rem 0.7rem 2.4rem',
                  borderRadius: '0.75rem',
                  border: '1px solid #cbd5e1',
                  fontSize: '0.85rem',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  backgroundColor: '#f8fafc'
                }}
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div style={{ textAlign: 'left' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                  Password
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => { clearMessages(); setMode('forgot'); }}
                    style={{ background: 'none', border: 'none', fontSize: '0.72rem', color: '#047857', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    Forgot Password?
                  </button>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem 2.5rem 0.7rem 2.4rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#f8fafc'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          {mode === 'signup' && (
            <div style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.3rem' }}>
                Confirm Password
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.7rem 2.5rem 0.7rem 2.4rem',
                    borderRadius: '0.75rem',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    backgroundColor: '#f8fafc'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex', alignItems: 'center' }}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '0.5rem',
              width: '100%',
              padding: '0.85rem 1rem',
              backgroundColor: '#064e3b',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.85rem',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              boxShadow: '0 4px 12px rgba(6, 78, 59, 0.25)',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.75 : 1
            }}
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>
                  {mode === 'signin' && 'Sign In to Journal'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot' && 'Send Reset Link'}
                </span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Toggle between Sign In / Sign Up / Forgot */}
        <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.85rem', width: '100%' }}>
          {mode === 'signin' && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              Don't have an account yet?{' '}
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('signup'); }}
                style={{ background: 'none', border: 'none', color: '#047857', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Create Account
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              Already registered?{' '}
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('signin'); }}
                style={{ background: 'none', border: 'none', color: '#047857', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Sign In
              </button>
            </p>
          )}

          {mode === 'forgot' && (
            <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
              Remember your password?{' '}
              <button
                type="button"
                onClick={() => { clearMessages(); setMode('signin'); }}
                style={{ background: 'none', border: 'none', color: '#047857', fontWeight: 700, cursor: 'pointer', padding: 0 }}
              >
                Back to Sign In
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
