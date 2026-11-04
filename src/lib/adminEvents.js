import { supabase } from './supabase.js';

// Same-origin by default (Vite proxies /api to the Express server in dev);
// set VITE_API_URL when that server is hosted somewhere else.
const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/**
 * Deletes a whole event through the server, which checks the owner's session,
 * destroys the event's Cloudinary files, then removes the wedding row and
 * everything that cascades from it. Throws a message safe to show in the UI.
 */
export async function deleteEvent(wedding) {
  if (!wedding?.id) throw new Error('This event is missing its id — reload the dashboard and try again.');

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error('Your session could not be checked — sign in again.');
  const token = data?.session?.access_token;
  if (!token) throw new Error('Your session expired — sign in again.');

  let res;
  try {
    res = await fetch(`${apiBase}/api/events/${wedding.id}`, {
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
    // A JSON body means our own route answered. Without one, a dev proxy or a
    // missing Netlify function returned its own 404/405 page instead.
    if (!payload) {
      throw new Error(
        `The delete service did not answer (HTTP ${res.status}). Run "npm run dev:server" locally, ` +
          'or redeploy the site so the event-delete function ships.',
      );
    }
    if (res.status === 404) throw new Error('This event was already deleted.');
    throw new Error(payload?.message || `Could not delete this event (HTTP ${res.status}). Try again.`);
  }

  return payload;
}
