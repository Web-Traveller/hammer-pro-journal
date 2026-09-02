import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://qvzttflsjcgndjusvykq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_it9ewmvzIJ60G2eAXlC6hg_lDA6x6eu';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

/**
 * Fetch dynamic configuration from Supabase app_config table
 * Allows updating the updater URL or storage endpoints dynamically without recompiling!
 */
export async function fetchAppConfig(key) {
  try {
    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', key)
      .single();
    if (error || !data) return null;
    return data.value;
  } catch (e) {
    return null;
  }
}
