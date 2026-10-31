import { supabase } from './supabase.js';

// Same-origin by default (Vite proxies /api to the Express server in dev);
// set VITE_API_URL when that server is hosted somewhere else.
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Deletes one photo/video through the server, which verifies the owner's
 * session, destroys the Cloudinary asset, then removes the media row.
 * Throws a message safe to show in the admin UI.
 */
export async function deleteMediaFile(media) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Your session could not be checked — sign in again.');
  const token = data?.session?.access_token;
  if (!token) throw new Error('Your session expired — sign in again.');

  let res;
  try {
    res = await fetch(`${apiBase}/api/media/${media.id}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let payload = null;
  if ((res.headers.get('content-type') || '').includes('application/json')) {
    try {
      payload = await res.json();
    } catch {
      // Truncated body — fall through to the status-based message.
    }
  }

  if (!res.ok) {
    if (res.status === 401) throw new Error('Your session expired — sign in again.');
    if (res.status === 404) throw new Error('This item was already deleted.');
    if (res.status >= 500 && !payload) {
      // No JSON body means the request never reached the API (dev proxy or host).
      throw new Error('The media server is not reachable. Start it with "npm run dev:server" and try again.');
    }
    throw new Error(payload?.message || `Could not delete this item (HTTP ${res.status}). Try again.`);
  }

  return payload;
}