import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONCURRENCY = 6;

export class DeleteEventError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'DeleteEventError';
    this.status = status;
    this.code = code;
  }
}

/** Cloudinary parameters sorted, joined with `&`, then SHA-1 signed with the API secret. */
function cloudinarySignature(params, apiSecret) {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join('&');
  return crypto.createHash('sha1').update(`${toSign}${apiSecret}`).digest('hex');
}

async function destroyAsset(publicId, resourceType) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.VITE_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new DeleteEventError(
      500,
      'The delete API has no Cloudinary credentials (CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET).',
      'not_configured',
    );
  }

  const timestamp = Math.round(Date.now() / 1000);
  const signed = { invalidate: 'true', public_id: publicId, timestamp: String(timestamp) };
  const body = new URLSearchParams({
    ...signed,
    api_key: apiKey,
    signature: cloudinarySignature(signed, apiSecret),
  });

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.error?.message || `Cloudinary HTTP ${res.status}`);
  if (json?.result === 'ok') return 'deleted';
  if (json?.result === 'not found') return 'missing';
  throw new Error(`Cloudinary returned ${json?.result || 'no result'}`);
}

/** Runs `jobs` a few at a time so a big gallery does not fire 300 requests at once. */
async function runPool(items, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

/**
 * Deletes a whole wedding: its photos and videos from Cloudinary first, then
 * the wedding row, whose cascade removes guests, guest sessions, passcodes,
 * media, likes, comments and guestbook letters.
 *
 * Caller must be a signed-in owner (Supabase access token). Assets go first so
 * a Cloudinary failure leaves the event intact and retryable instead of
 * orphaned files behind a deleted gallery.
 */
export async function deleteEventById(id, accessToken) {
  if (!UUID_RE.test(id || '')) throw new DeleteEventError(400, 'Invalid event id.', 'bad_id');
  if (!accessToken) throw new DeleteEventError(401, 'Your session expired — sign in again.', 'unauthorized');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new DeleteEventError(
      500,
      'The delete API has no Supabase server credentials (SUPABASE_SERVICE_ROLE_KEY).',
      'not_configured',
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: auth, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !auth?.user) {
    throw new DeleteEventError(401, 'Your session expired — sign in again.', 'unauthorized');
  }

  const { data: wedding, error: weddingErr } = await supabase
    .from('weddings')
    .select('id, slug, couple_name_1, couple_name_2')
    .eq('id', id)
    .maybeSingle();

  if (weddingErr) throw new DeleteEventError(500, 'Could not look up this event.', 'lookup_failed');
  if (!wedding) throw new DeleteEventError(404, 'This event was already deleted.', 'not_found');

  const { data: mediaRows, error: mediaErr } = await supabase
    .from('media')
    .select('id, cloudinary_public_id, type')
    .eq('wedding_id', id);

  if (mediaErr) throw new DeleteEventError(500, 'Could not list this event’s media.', 'lookup_failed');

  let deleted = 0;
  let missing = 0;
  try {
    const outcomes = await runPool(mediaRows || [], async (row) => {
      const resourceType = row.type === 'video' ? 'video' : 'image';
      return destroyAsset(row.cloudinary_public_id, resourceType);
    });
    outcomes.forEach((outcome) => {
      if (outcome === 'deleted') deleted += 1;
      else missing += 1;
    });
  } catch (err) {
    console.error('[event] cloudinary delete failed:', wedding.slug, err?.message || err);
    throw new DeleteEventError(
      502,
      'Some photos or videos could not be removed from Cloudinary. Nothing was deleted — try again.',
      'cloudinary_failed',
    );
  }

  const { error: delErr } = await supabase.from('weddings').delete().eq('id', wedding.id);
  if (delErr) {
    console.error('[event] database delete failed:', wedding.slug, delErr.message);
    throw new DeleteEventError(
      500,
      'The files were removed but the event could not be deleted. Try again.',
      'delete_failed',
    );
  }

  console.log(`[event] deleted ${wedding.slug} (${wedding.id}) — ${deleted} files, ${missing} already gone`);
  return {
    id: wedding.id,
    slug: wedding.slug,
    mediaDeleted: deleted,
    mediaMissing: missing,
  };
}
