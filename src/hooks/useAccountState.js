import { useState, useEffect, useCallback } from 'react';
import { retrieveAccountsConfig, persistAccountsConfig } from '../services/storageService';

const ACCOUNTS_STORAGE_KEY = 'hammer_user_accounts';
const ACTIVE_ACCOUNT_STORAGE_KEY = 'hammer_active_account_id';

export const DEFAULT_ACCOUNTS = [
  { id: 'default', name: 'Main Account', color: '#10b981', broker: 'Alaric', notes: 'Market Hours' }
];

export function useAccountState(showToast) {
  const [accounts, setAccounts] = useState(() => {
    try {
      const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return DEFAULT_ACCOUNTS;
  });

  // Load from disk if available
  useEffect(() => {
    async function loadDiskAccounts() {
      try {
        const diskAccounts = await retrieveAccountsConfig();
        if (diskAccounts && Array.isArray(diskAccounts) && diskAccounts.length > 0) {
          setAccounts(diskAccounts);
        }
      } catch (e) {}
    }
    loadDiskAccounts();
  }, []);

  const [activeAccountId, setActiveAccountId] = useState(() => {
    try {
      const stored = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
      if (stored) return stored;
    } catch (e) {}
    return 'default';
  });

  const [showAccountsModal, setShowAccountsModal] = useState(false);

  // Sync accounts to storage
  const saveAccounts = useCallback((newAccounts) => {
    setAccounts(newAccounts);
    persistAccountsConfig(newAccounts);
  }, []);

  const handleSwitchAccount = useCallback((accountId) => {
    const acc = accounts.find(a => a.id === accountId);
    if (!acc) return;
    setActiveAccountId(accountId);
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, accountId);
    } catch (e) {}
    if (showToast) {
      showToast(`Switched to account: ${acc.name}`, 'info');
    }
  }, [accounts, showToast]);

  const handleCreateAccount = useCallback((name, color = '#3b82f6', broker = '', notes = '') => {
    const cleanName = (name || '').trim();
    if (!cleanName) {
      if (showToast) showToast('Account name is required.', 'error');
      return null;
    }
    const newAcc = {
      id: `acc_${Date.now()}`,
      name: cleanName,
      color: color || '#3b82f6',
      broker: (broker || '').trim(),
      notes: (notes || '').trim(),
      createdAt: new Date().toISOString()
    };
    const updated = [...accounts, newAcc];
    saveAccounts(updated);
    setActiveAccountId(newAcc.id);
    try {
      localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, newAcc.id);
    } catch (e) {}
    if (showToast) {
      showToast(`Created new account: ${newAcc.name}!`, 'success');
    }
    return newAcc;
  }, [accounts, saveAccounts, showToast]);

  const handleUpdateAccount = useCallback((accountId, updates) => {
    const updated = accounts.map(a => {
      if (a.id === accountId) {
        return { ...a, ...updates, updatedAt: new Date().toISOString() };
      }
      return a;
    });
    saveAccounts(updated);
    if (showToast) {
      showToast('Account updated!', 'success');
    }
  }, [accounts, saveAccounts, showToast]);

  const handleDeleteAccount = useCallback((accountId) => {
    if (accountId === 'default') {
      if (showToast) showToast('Default Main Account cannot be deleted.', 'error');
      return;
    }
    const updated = accounts.filter(a => a.id !== accountId);
    saveAccounts(updated);
    if (activeAccountId === accountId) {
      setActiveAccountId('default');
      try {
        localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, 'default');
      } catch (e) {}
    }
    if (showToast) {
      showToast('Account deleted.', 'info');
    }
  }, [accounts, activeAccountId, saveAccounts, showToast]);

  const activeAccount = accounts.find(a => a.id === activeAccountId) || accounts[0] || DEFAULT_ACCOUNTS[0];

  return {
    accounts,
    activeAccountId,
    activeAccount,
    showAccountsModal,
    setShowAccountsModal,
    handleSwitchAccount,
    handleCreateAccount,
    handleUpdateAccount,
    handleDeleteAccount
  };
}
