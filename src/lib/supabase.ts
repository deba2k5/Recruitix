import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** False when VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY aren't set — auth/exam features will fail until they are. */
export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    'Supabase is not configured (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing) — the site will render, but sign-up, enrollment, and exam features will not work until they are set.',
  );
}

// Falls back to a harmless placeholder so the app can still render (marketing page, etc.)
// without real credentials — actual Supabase calls will simply fail rather than crash on load.
export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key');
