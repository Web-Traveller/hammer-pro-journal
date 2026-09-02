/**
 * Broadcast & User Communication Service
 * Allows administrator to push announcements, release news, or maintenance alerts
 * directly to desktop and mobile users via Supabase app_config.
 */

import { supabase } from './supabaseClient';

const DISMISSED_BROADCAST_KEY = 'hammer_dismissed_broadcast_id';

/**
 * Fetch active broadcast announcement for the current platform
 */
export async function fetchActiveBroadcast() {
  try {
    const isTauriDesktop = typeof window !== 'undefined' && (window.__TAURI_INTERNALS__ !== undefined || window.__TAURI__ !== undefined);
    const isMobile = typeof window !== 'undefined' && (/android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '') || window.Capacitor !== undefined) && !isTauriDesktop;
    const currentPlatform = isMobile ? 'mobile' : 'desktop';

    const { data: row, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'broadcast_announcement')
      .maybeSingle();

    if (error || !row || !row.value) return null;

    const broadcast = row.value;

    if (!broadcast.active) return null;

    // Platform targeting check ('all' | 'desktop' | 'mobile')
    if (broadcast.target && broadcast.target !== 'all' && broadcast.target !== currentPlatform) {
      return null;
    }

    // Check if previously dismissed by user
    const dismissedId = localStorage.getItem(DISMISSED_BROADCAST_KEY);
    if (broadcast.allow_dismiss !== false && dismissedId === broadcast.id) {
      return null;
    }

    return {
      id: broadcast.id || 'broadcast_default',
      title: broadcast.title || 'Announcement',
      message: broadcast.message || '',
      type: broadcast.type || 'info', // 'info' | 'warning' | 'success' | 'critical'
      linkUrl: broadcast.link_url || broadcast.linkUrl || '',
      linkText: broadcast.link_text || broadcast.linkText || 'Learn More',
      allowDismiss: broadcast.allow_dismiss !== false
    };
  } catch (err) {
    console.warn('Broadcast check note:', err);
    return null;
  }
}

/**
 * Mark a broadcast as dismissed in localStorage
 */
export function dismissBroadcast(broadcastId) {
  if (!broadcastId) return;
  try {
    localStorage.setItem(DISMISSED_BROADCAST_KEY, broadcastId);
  } catch (e) {}
}
