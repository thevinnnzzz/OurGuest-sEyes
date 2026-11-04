// Guest profile writes.
//
// Media, notes, likes and comments are attached to the guest id, so changing the
// passcode never detaches a guest from what they already shared. Both calls go
// through SECURITY DEFINER RPCs that take the device session token — the PIN
// hash is never readable from the browser.
import { supabase } from './supabase.js';

const PASSCODE_PATTERN = /^[A-Za-z0-9]{4,12}$/;

/** PostgREST/RPC failures turned into one readable sentence. */
function friendlyProfileError(error) {
  const code = error?.code || '';
  if (code === 'PGRST202' || code === '42883') {
    return 'Profile settings are not switched on for this gallery yet. Please ask the couple to update the app.';
  }
  if (code === 'P0001') return error.message;
  if (code === '42501') return 'This gallery is not accepting changes right now.';
  return error?.message || 'Something went wrong — please try again.';
}

export function isPasscodeValid(value) {
  return PASSCODE_PATTERN.test(String(value || '').trim());
}

/** Replaces the passcode after checking the current one. */
export async function updateGuestPasscode({ token, current, next }) {
  const cleanNext = String(next || '').trim();
  const cleanCurrent = String(current || '').trim();

  if (!token) throw new Error('Your session has expired. Please check in again.');
  if (!isPasscodeValid(cleanNext)) {
    throw new Error('Passcodes are 4 to 12 letters or digits, with no spaces.');
  }
  if (cleanCurrent === cleanNext) {
    throw new Error('That is already your passcode — choose a different one.');
  }

  const { error } = await supabase.rpc('guest_change_passcode', {
    p_token: token,
    p_current: cleanCurrent,
    p_new: cleanNext,
  });
  if (error) throw new Error(friendlyProfileError(error));
}

/**
 * Ends this device's session. The local token is cleared by the caller even if
 * the network call fails, so "Log out" always works offline.
 */
export async function signOutGuest({ token }) {
  if (!token) return;
  const { error } = await supabase.rpc('guest_sign_out', { p_token: token });
  // A dead or already-deleted session is not an error the guest should see.
  if (error && !/expired|not found/i.test(error.message || '')) {
    console.warn('Could not end the guest session on the server:', error.message);
  }
}
