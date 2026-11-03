import { deleteEventById } from '../../shared/deleteEvent.js';

const HEADERS = { 'content-type': 'application/json', 'cache-control': 'no-store' };

function json(statusCode, payload) {
  return { statusCode, headers: HEADERS, body: JSON.stringify(payload) };
}

function bearerToken(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  return header.replace(/^Bearer\s+/i, '').trim();
}

/** netlify.toml rewrites /api/events/<id> here; rawUrl keeps the original path. */
function eventId(event) {
  const paths = [];
  if (event.rawUrl) {
    try {
      paths.push(new URL(event.rawUrl).pathname);
    } catch {
      // Malformed rawUrl — fall through to event.path.
    }
  }
  if (event.path) paths.push(event.path);

  for (const pathname of paths) {
    const match = pathname.match(/\/api\/events\/([^/]+)\/?$/);
    if (match) return decodeURIComponent(match[1]);
  }

  return event.queryStringParameters?.id || null;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: HEADERS };
  if (event.httpMethod !== 'DELETE') {
    return json(405, { error: 'method_not_allowed', message: 'Use DELETE for this endpoint.' });
  }

  const token = bearerToken(event);
  if (!token) return json(401, { error: 'unauthorized', message: 'Your session expired — sign in again.' });

  const id = eventId(event);
  if (!id) return json(400, { error: 'bad_id', message: 'Invalid event id.' });

  try {
    const result = await deleteEventById(id, token);
    return json(200, { ok: true, ...result });
  } catch (err) {
    if ((err.status || 500) >= 500) console.error('[event] delete failed:', err.message);
    return json(err.status || 500, {
      error: err.code || 'delete_failed',
      message: err.message || 'Could not delete this event.',
    });
  }
};
