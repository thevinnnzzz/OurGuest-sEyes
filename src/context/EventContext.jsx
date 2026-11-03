import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase.js';
import {
  clearStoredSession,
  readLastEvent,
  readStoredSession,
  rememberEvent,
  writeStoredSession,
} from '../lib/guestSession.js';

const EventContext = createContext(null);

/** Turns PostgREST/RPC failures into something a guest can act on. */
function friendlyAuthError(error) {
  const code = error?.code || '';
  if (code === 'PGRST202' || code === '42883') {
    return 'Guest passcodes are not switched on for this gallery yet. Please ask the couple to update the app.';
  }
  if (code === 'P0001') return error.message;
  if (code === '42501') return 'This gallery is not accepting check-ins right now.';
  if (code === '23505') return 'Someone just checked in with that name. Please try again.';
  return error?.message || 'Could not check you in — try again.';
}

export function EventProvider({ children }) {
  const [wedding, setWedding] = useState(null);
  const [session, setSession] = useState(null);
  const [lastEvent, setLastEvent] = useState(null);
  const [error, setError] = useState(null);

  // The remembered event powers the root page's "return to your gallery" card
  // and the installed-app launch redirect.
  useEffect(() => {
    let alive = true;
    readLastEvent().then((slug) => {
      if (alive) setLastEvent(slug);
    });
    return () => {
      alive = false;
    };
  }, []);

  const persist = useCallback(async (payload) => {
    setSession(payload);
    setLastEvent(payload.slug);
    await writeStoredSession(payload);
    await rememberEvent(payload.slug);
  }, []);

  /**
   * Name + passcode check-in. A matching pair restores the guest row (and every
   * memory already attached to it); a wrong passcode is refused outright so a
   * name cannot be borrowed.
   */
  const loginGuest = useCallback(async (slug, fullName, passcode) => {
    setError(null);
    const cleanSlug = String(slug || '').trim();
    const name = String(fullName || '').trim();
    const pin = String(passcode || '').trim();

    if (!cleanSlug) throw new Error('That gallery link is missing its event name.');
    if (name.length < 2) throw new Error('Please enter your full name.');
    if (!/^[A-Za-z0-9]{4,12}$/.test(pin)) {
      throw new Error('Passcodes are 4 to 12 letters or digits, with no spaces.');
    }

    const { data, error: rpcError } = await supabase.rpc('guest_checkin', {
      p_slug: cleanSlug,
      p_name: name,
      p_passcode: pin,
    });
    if (rpcError) throw new Error(friendlyAuthError(rpcError));

    const row = Array.isArray(data) ? data[0] : data;
    if (!row?.session_token) throw new Error('Could not check you in — try again.');

    const canonicalSlug = row.wedding_slug || cleanSlug;
    const payload = {
      slug: canonicalSlug,
      token: row.session_token,
      guestId: row.guest_uuid,
      weddingId: row.wedding_uuid,
      fullName: row.guest_name,
    };

    const { data: weddingRow } = await supabase
      .from('weddings')
      .select('*')
      .eq('slug', canonicalSlug)
      .maybeSingle();

    if (weddingRow) setWedding(weddingRow);
    await persist(payload);
    return { ...payload, status: row.status };
  }, [persist]);

  /**
   * Validates the stored token for this slug. Resolves null when the guest has
   * to re-authenticate (new device, cleared storage, expired gallery).
   */
  const checkExistingSession = useCallback(async (slug) => {
    if (!supabaseReady) return null;
    const wanted = String(slug || '').trim().toLowerCase();
    const stored = await readStoredSession();
    if (!stored || !stored.token) return null;
    if (String(stored.slug || '').toLowerCase() !== wanted) return null;

    const { data: sessionRow, error: err } = await supabase
      .from('guest_sessions')
      .select('token, guest_id, wedding_id, guests!inner(full_name), weddings!inner(slug, expires_at)')
      .eq('token', stored.token)
      .maybeSingle();

    // A transport/RLS error is not proof the token is dead — keep it so the next
    // boot can retry. Only a definite "no such session" clears the device.
    if (err) return null;
    if (!sessionRow) {
      // The token is gone (gallery purged or guest deleted). Keep the last
      // event slug so the prompt can offer it back, but drop the dead token.
      await clearStoredSession();
      return null;
    }
    if (new Date(sessionRow.weddings.expires_at) <= new Date()) return null;

    const payload = {
      slug: sessionRow.weddings.slug,
      token: sessionRow.token,
      guestId: sessionRow.guest_id,
      weddingId: sessionRow.wedding_id,
      fullName: sessionRow.guests?.full_name || stored.fullName || null,
    };
    setSession(payload);
    await writeStoredSession(payload);

    const { data: weddingRow } = await supabase
      .from('weddings')
      .select('*')
      .eq('slug', sessionRow.weddings.slug)
      .maybeSingle();
    if (weddingRow) setWedding(weddingRow);
    return payload;
  }, []);

  const clearSession = useCallback(async () => {
    setSession(null);
    await clearStoredSession();
  }, []);

  const value = useMemo(
    () => ({
      wedding,
      setWedding,
      session,
      lastEvent,
      error,
      loginGuest,
      checkExistingSession,
      clearSession,
    }),
    [wedding, session, lastEvent, error, loginGuest, checkExistingSession, clearSession],
  );

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error('useEvent must be used inside EventProvider');
  return ctx;
}
