import React, { useState } from 'react';
import {
  User,
  X,
  RefreshCw,
  LogOut,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  getActiveUserProfile,
  signUpUser,
  signInUser,
  signOutUser,
  executeTwoTierSync,
  updateUserProfile,
  refreshUserProfile
} from '../../services/authService';
import { supabase } from '../../services/supabaseClient';

export function AuthProfileModal({
  isOpen,
  onClose,
  onToast,
  dailyStatsMap = {},
  userProfile = null,
  onProfileUpdated,
  onSignOut
}) {
  const [profile, setProfile] = useState(() => userProfile || getActiveUserProfile());
  const [activeTab, setActiveTab] = useState(() => {
    const current = userProfile || getActiveUserProfile();
    return (current && current.id) ? 'profile' : 'signin';
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Form inputs
  const [nameInput, setNameInput] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Inline feedback messages
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const wasOpenRef = React.useRef(false);

  // Keep state synchronized ONLY when modal transitions from closed to open
  React.useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      wasOpenRef.current = true;
      const active = userProfile || getActiveUserProfile();
      setProfile(active);
      if (active && active.id) {
        setActiveTab('profile');
        // Refresh latest admin permissions once silently on open
        refreshUserProfile().then((refreshed) => {
          if (refreshed && refreshed.id) {
            setProfile(refreshed);
          }
        }).catch(() => {});
      } else {
        setActiveTab('signin');
      }
      setErrorMessage('');
      setSuccessMessage('');
    } else if (!isOpen) {
      wasOpenRef.current = false;
    }
  }, [isOpen]);

  // Listen for Supabase password recovery event
  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setActiveTab('update_password');
        setErrorMessage('');
        setSuccessMessage('Please enter your new password below.');
      }
    });
    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  if (!isOpen) return null;

  const clearFeedback = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const switchTab = (tab) => {
    clearFeedback();
    setActiveTab(tab);
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    clearFeedback();

    const cleanEmail = emailInput.trim();
    const cleanPassword = passwordInput.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setLoading(true);
    try {
      const user = await signInUser(cleanEmail, cleanPassword);
      setProfile(user);
      setActiveTab('profile');
      if (onProfileUpdated) onProfileUpdated(user);
      if (onToast) onToast(`Welcome back, ${user.name}!`, 'success');
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('invalid login credentials') || msg.toLowerCase().includes('invalid')) {
        setErrorMessage('Incorrect email or password. Please check your credentials and try again.');
      } else if (msg.toLowerCase().includes('email not confirmed')) {
        setErrorMessage('Your email address has not been confirmed yet. Please check your inbox.');
      } else if (msg.toLowerCase().includes('fetch') || msg.toLowerCase().includes('network')) {
        setErrorMessage('Unable to connect to the cloud server. Please check your internet connection.');
      } else {
        setErrorMessage(msg || 'Failed to sign in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    clearFeedback();

    const cleanEmail = emailInput.trim();
    const cleanPassword = passwordInput.trim();
    const cleanName = nameInput.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter an email address.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMessage('Please enter a valid email format (e.g. trader@example.com).');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      const user = await signUpUser(cleanName, cleanEmail, cleanPassword);
      setProfile(user);
      setActiveTab('profile');
      if (onProfileUpdated) onProfileUpdated(user);
      if (onToast) onToast(`Account created! Welcome, ${user.name}!`, 'success');
    } catch (err) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('email_address_invalid') || msg.toLowerCase().includes('is invalid')) {
        setErrorMessage('Please use a real email address from a recognized provider (e.g. @gmail.com, @outlook.com, @yahoo.com).');
      } else if (msg.toLowerCase().includes('user already registered') || msg.toLowerCase().includes('already exists')) {
        setErrorMessage('An account with this email already exists. Please sign in instead.');
      } else if (msg.toLowerCase().includes('password')) {
        setErrorMessage('Password is too weak. Please use at least 6 characters.');
      } else {
        setErrorMessage(msg || 'Failed to create account. Please check your details.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    clearFeedback();

    const cleanEmail = emailInput.trim();
    if (!cleanEmail) {
      setErrorMessage('Please enter your account email address.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail);
      if (error) throw new Error(error.message);
      setSuccessMessage(`Password reset link sent to ${cleanEmail}. Check your inbox!`);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    clearFeedback();

    const pass = newPasswordInput.trim();
    const confirm = confirmPasswordInput.trim();

    if (pass.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return;
    }
    if (pass !== confirm) {
      setErrorMessage('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pass });
      if (error) throw new Error(error.message);
      setSuccessMessage('Password updated successfully! You can now sign in.');
      setNewPasswordInput('');
      setConfirmPasswordInput('');
      setTimeout(() => {
        switchTab('signin');
      }, 1500);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to update password. Link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutUser();
    setProfile(null);
    setActiveTab('signin');
    clearFeedback();
    if (onSignOut) {
      onSignOut();
    }
    if (onToast) onToast('Signed out. Account sign-in required to continue.', 'info');
    onClose();
  };

  const handleTriggerManualSync = async () => {
    setSyncing(true);
    clearFeedback();
    try {
      const res = await executeTwoTierSync(dailyStatsMap);
      if (res.success) {
        const refreshed = getActiveUserProfile();
        setProfile(refreshed);
        if (onProfileUpdated) onProfileUpdated(refreshed);
        if (onToast) onToast('Cloud sync complete! All data up to date.', 'success');
      } else {
        setErrorMessage(res.error || 'Cloud sync failed.');
      }
    } catch (err) {
      setErrorMessage('Sync encountered an error.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div
        className="custom-modal-card"
        style={{ maxWidth: '490px', width: '92vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="custom-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontWeight: 800, fontSize: '1.05rem', color: 'var(--hero-green)' }}>
            <User size={20} />
            <span>{profile ? 'Account & Cloud Backup' : (activeTab === 'forgot' ? 'Reset Password' : 'Sign In or Create Account')}</span>
          </div>
          <button className="lightbox-close-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="custom-modal-body">
          {/* Tab Navigation for Unauthenticated */}
          {!profile && activeTab !== 'forgot' && (
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '999px', padding: '3px', marginBottom: '1.25rem', gap: '3px' }}>
              <button
                type="button"
                onClick={() => switchTab('signin')}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'signin' ? '#ffffff' : 'transparent',
                  color: activeTab === 'signin' ? 'var(--hero-green)' : 'var(--text-muted)',
                  boxShadow: activeTab === 'signin' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => switchTab('signup')}
                style={{
                  flex: 1,
                  padding: '0.45rem',
                  borderRadius: '999px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'signup' ? '#ffffff' : 'transparent',
                  color: activeTab === 'signup' ? 'var(--hero-green)' : 'var(--text-muted)',
                  boxShadow: activeTab === 'signup' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Create Account (Free)
              </button>
            </div>
          )}

          {/* INLINE ERROR ALERT BOX */}
          {errorMessage && (
            <div style={{
              backgroundColor: '#fff1f2',
              border: '1px solid #fecdd3',
              color: '#be123c',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              marginBottom: '1rem',
              lineHeight: '1.4'
            }}>
              <AlertCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* INLINE SUCCESS ALERT BOX */}
          {successMessage && (
            <div style={{
              backgroundColor: '#ecfdf5',
              border: '1px solid #a7f3d0',
              color: '#047857',
              borderRadius: '0.75rem',
              padding: '0.75rem 1rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              marginBottom: '1rem',
              lineHeight: '1.4'
            }}>
              <CheckCircle size={17} style={{ flexShrink: 0, marginTop: '1px' }} />
              <div>{successMessage}</div>
            </div>
          )}

          {/* VIEW 1: ACTIVE USER PROFILE */}
          {profile && activeTab === 'profile' && (
            <div>
              {/* Profile Card */}
              <div style={{
                background: 'linear-gradient(135deg, #064e3b 0%, #065f46 100%)',
                color: '#ffffff',
                borderRadius: '1rem',
                padding: '1.25rem',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                boxShadow: '0 8px 20px rgba(6, 78, 59, 0.2)'
              }}>
                <img
                  src={profile.avatarUrl}
                  alt={profile.name}
                  style={{ width: '54px', height: '54px', borderRadius: '50%', background: '#ffffff', padding: '2px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: 800 }}>{profile.name}</span>
                    <span style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                      fontSize: '0.68rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.5rem',
                      borderRadius: '999px',
                      textTransform: 'uppercase'
                    }}>
                      {profile.planTier === 'pro' ? '⚡ Pro Member' : '🌱 Free Plan'}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.82rem', opacity: 0.9, marginTop: '2px' }}>{profile.email}</div>
                </div>
              </div>

              {/* Account Entitlements & Storage Details (Admin-Managed) */}
              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.65rem' }}>
                  Account Entitlements &amp; Storage
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.75rem',
                  padding: '1rem'
                }}>
                  {/* Cloud Sync Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Cloud Sync &amp; Backup
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {profile.canCloudSync
                          ? 'Automatic cross-device sync & Cloudflare R2 backup enabled'
                          : '100% offline local storage mode (managed by administrator)'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.65rem',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                      backgroundColor: profile.canCloudSync ? '#dcfce7' : '#f1f5f9',
                      color: profile.canCloudSync ? 'var(--hero-green)' : '#64748b',
                      border: `1px solid ${profile.canCloudSync ? '#86efac' : '#cbd5e1'}`
                    }}>
                      {profile.canCloudSync ? '⚡ Active' : '💾 Local Only'}
                    </span>
                  </div>

                  <div style={{ height: '1px', backgroundColor: 'var(--border-light)' }} />

                  {/* Screenshot Allowance Status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div>
                      <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        Screenshot Sync Limit
                      </div>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {profile.canCloudSync
                          ? (profile.dailyImageLimit > 0
                              ? `Up to ${profile.dailyImageLimit} screenshots per session`
                              : 'Trade logs only (0 screenshots sync to cloud)')
                          : 'Local disk only (No cloud uploads)'}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      padding: '0.2rem 0.65rem',
                      borderRadius: '999px',
                      whiteSpace: 'nowrap',
                      backgroundColor: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #cbd5e1'
                    }}>
                      {profile.canCloudSync
                        ? (profile.dailyImageLimit > 0 ? `${profile.dailyImageLimit} / session` : 'Logs Only')
                        : 'Local Only'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync Actions Bar - Only shown if cloud sync is enabled */}
              {profile.canCloudSync ? (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.75rem',
                  padding: '0.85rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.25rem'
                }}>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    Last synced: {profile.lastSyncTimestamp ? new Date(profile.lastSyncTimestamp).toLocaleTimeString() : 'Just now'}
                  </span>
                  <button
                    className="btn"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.85rem' }}
                    onClick={handleTriggerManualSync}
                    disabled={syncing}
                  >
                    <RefreshCw size={13} className={syncing ? 'spin-animation' : ''} />
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </button>
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-light)',
                  borderRadius: '0.75rem',
                  padding: '0.75rem 1rem',
                  marginBottom: '1.25rem',
                  fontSize: '0.76rem',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', flexShrink: 0 }} />
                  <span>All sessions and accounts are saved locally on this machine.</span>
                </div>
              )}

              {/* Bottom Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: '1rem' }}>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: '0.78rem', padding: '0.4rem 0.8rem' }}
                  onClick={handleSignOut}
                >
                  <LogOut size={14} /> Sign Out
                </button>
                <button className="btn btn-secondary" style={{ fontSize: '0.78rem' }} onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: SIGN IN FORM */}
          {!profile && activeTab === 'signin' && (
            <form onSubmit={handleSignIn}>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="trader@example.com"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (errorMessage) clearFeedback();
                    }}
                    style={{ paddingLeft: '36px', width: '100%' }}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Password</label>
                  <button
                    type="button"
                    onClick={() => switchTab('forgot')}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '0.74rem',
                      color: 'var(--hero-green)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (errorMessage) clearFeedback();
                    }}
                    style={{ paddingLeft: '36px', paddingRight: '36px', width: '100%' }}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="submit"
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                  disabled={loading}
                >
                  <RefreshCw size={14} className={loading ? 'spin-animation' : ''} style={{ display: loading ? 'inline-block' : 'none' }} />
                  {loading ? 'Authenticating...' : 'Sign In & Sync'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
                  onClick={onClose}
                  disabled={loading}
                >
                  Continue in Offline Mode
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: SIGN UP FORM */}
          {!profile && activeTab === 'signup' && (
            <form onSubmit={handleSignUp}>
              <div style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Trader Name</label>
                <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <User size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Alex"
                    value={nameInput}
                    onChange={(e) => {
                      setNameInput(e.target.value);
                      if (errorMessage) clearFeedback();
                    }}
                    style={{ paddingLeft: '36px', width: '100%' }}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="trader@example.com"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (errorMessage) clearFeedback();
                    }}
                    style={{ paddingLeft: '36px', width: '100%' }}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Password (min 6 characters)</label>
                <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Create a strong password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      if (errorMessage) clearFeedback();
                    }}
                    style={{ paddingLeft: '36px', paddingRight: '36px', width: '100%' }}
                    disabled={loading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="submit"
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                  disabled={loading}
                >
                  <RefreshCw size={14} className={loading ? 'spin-animation' : ''} style={{ display: loading ? 'inline-block' : 'none' }} />
                  {loading ? 'Creating Account...' : 'Create Free Account'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem' }}
                  onClick={onClose}
                  disabled={loading}
                >
                  Continue in Offline Mode
                </button>
              </div>
            </form>
          )}

          {/* VIEW 4: FORGOT PASSWORD FORM */}
          {!profile && activeTab === 'forgot' && (
            <form onSubmit={handleForgotPassword}>
              <div style={{ marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Enter the email address associated with your Hammer Pro account and we'll send you a password reset link.
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Email Address</label>
                <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type="email"
                    className="form-input"
                    placeholder="trader@example.com"
                    value={emailInput}
                    onChange={(e) => {
                      setEmailInput(e.target.value);
                      if (errorMessage) clearFeedback();
                    }}
                    style={{ paddingLeft: '36px', width: '100%' }}
                    disabled={loading}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="submit"
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                  disabled={loading}
                >
                  {loading ? 'Sending Link...' : 'Send Reset Link'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={() => switchTab('signin')}
                  disabled={loading}
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* VIEW 5: IN-APP UPDATE PASSWORD FORM */}
          {activeTab === 'update_password' && (
            <form onSubmit={handleUpdatePassword}>
              <div style={{ marginBottom: '1rem', fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Create a new secure password for your Hammer Pro account.
              </div>

              <div style={{ marginBottom: '0.85rem' }}>
                <label className="form-label">New Password (min 6 characters)</label>
                <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    value={newPasswordInput}
                    onChange={(e) => {
                      setNewPasswordInput(e.target.value);
                      if (errorMessage) clearFeedback();
                    }}
                    style={{ paddingLeft: '36px', paddingRight: '36px', width: '100%' }}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label">Confirm New Password</label>
                <div style={{ position: 'relative', marginTop: '0.25rem' }}>
                  <Lock size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="••••••••"
                    value={confirmPasswordInput}
                    onChange={(e) => {
                      setConfirmPasswordInput(e.target.value);
                      if (errorMessage) clearFeedback();
                    }}
                    style={{ paddingLeft: '36px', paddingRight: '36px', width: '100%' }}
                    disabled={loading}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '10px',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <button
                  type="submit"
                  className="btn"
                  style={{ width: '100%', justifyContent: 'center', padding: '0.65rem' }}
                  disabled={loading}
                >
                  {loading ? 'Updating Password...' : 'Save New Password'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  onClick={() => switchTab('signin')}
                  disabled={loading}
                >
                  <ArrowLeft size={14} /> Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
