import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.warn('[server] Missing SUPABASE_SERVICE_ROLE_KEY / VITE_SUPABASE_URL — purge will no-op.');
}

export const adminSupabase = createClient(url || 'http://localhost', serviceKey || 'missing', {
  auth: { persistSession: false },
});
