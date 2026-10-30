import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase.js';

const EventContext = createContext(null);

const STORAGE_KEY = 'oge_session';

export function EventProvider({ children }) {
  const [wedding, setWedding] = useState(null);
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  // Session persistence token: { slug, token, guestId, fullName }
  const persistSession = useCallback((data) => {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setSession(data);
  }, []);

  const clearSession = useCallback((slug) => {
    window.sessionStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(STORAGE_KEY);
    setSession(null);
    void slug;
  }, []);

  const registerGuest = useCallback(async (slug, fullName) => {
    setError(null);
    const name = fullName.trim();

    // 1. Find live wedding by slug
    const { data: weddingRow, error: weddingErr } = await supabase
      .from('weddings')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (weddingErr) throw weddingErr;
    if (!weddingRow) throw new Error('Wedding not found or no longer active.');
    if (new Date(weddingRow.expires_at) <= new Date()) {
      throw new Error('This gallery has expired. Thank you for celebrating with us!');
    }

    // 2. Duplicate-name check (case-insensitive, trimmed)
    const { data: existing, error: dupErr } = await supabase
      .from('guests')
      .select('id, full_name')
      .eq('wedding_id', weddingRow.id)
      .ilike('full_name', name)
      .maybeSingle();

    if (dupErr && dupErr.code !== 'PGRST116') throw dupErr;

    let guest = existing;
    if (guest) {
      throw new Error(`Someone named "${guest.full_name}" already checked in with this name. Please use your full name (add a last name or initial) so your memories can be told apart.`);
    }

    const { data: newGuest, error: guestErr } = await supabase
      .from('guests')
      .insert({ wedding_id: weddingRow.id, full_name: name })
      .select()
      .single();
    if (guestErr) throw guestErr;
    guest = newGuest;

    // 3. Issue session token
    const { data: sessionRow, error: sessErr } = await supabase
      .from('guest_sessions')
      .insert({ guest_id: guest.id, wedding_id: weddingRow.id })
      .select()
      .single();
    if (sessErr) throw sessErr;

    setWedding(weddingRow);
    const payload = {
      slug,
      token: sessionRow.token,
      guestId: guest.id,
      weddingId: weddingRow.id,
      fullName: guest.full_name,
    };
    persistSession(payload);
    return payload;
  }, [persistSession]);

  // If a session token exists for the given slug, skip registration.
  const checkExistingSession = useCallback(async (slug) => {
    if (!supabaseReady) return null;
    let stored = null;
    try {
      stored = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      stored = null;
    }
    if (!stored || stored.slug !== slug || !stored.token) return null;

    const { data: sessionRow, error: err } = await supabase
      .from('guest_sessions')
      .select('token, guest_id, wedding_id, weddings!inner(slug, expires_at)')
      .eq('token', stored.token)
      .maybeSingle();

    if (err || !sessionRow) return null;
    if (new Date(sessionRow.weddings.expires_at) <= new Date()) return null;

    const payload = {
      slug: sessionRow.weddings.slug,
      token: sessionRow.token,
      guestId: sessionRow.guest_id,
      weddingId: sessionRow.wedding_id,
      fullName: stored.fullName,
    };
    setSession(payload);

    const { data: weddingRow } = await supabase
      .from('weddings')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (weddingRow) setWedding(weddingRow);
    return payload;
  }, []);

  const value = useMemo(
    () => ({
      wedding, setWedding,
      session,
      error,
      registerGuest,
      checkExistingSession,
      clearSession,
    }),
    [wedding, session, error, registerGuest, checkExistingSession, clearSession],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEvent must be used inside EventProvider');
  return ctx;
}
