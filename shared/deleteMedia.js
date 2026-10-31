import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class DeleteMediaError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'DeleteMediaError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Cloudinary signature: parameters sorted alphabetically, joined with `&`,
 * followed by the API secret, hashed with SHA-1. `api_key`, `file` and
 * `resource_type` are never part of the signed string.
 */
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
    throw new DeleteMediaError(
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

/**
 * Deletes one photo/video: verifies the caller's Supabase session, destroys the
 * Cloudinary asset, then removes the media row (likes and comments cascade).
 *
 * The asset is removed first on purpose: if Cloudinary refuses we keep the row
 * so the admin can retry instead of leaving a file nobody can reach. Retries
 * are safe because an already-missing asset counts as success.
 */
export async function deleteMediaById(id, accessToken) {
  if (!UUID_RE.test(id || '')) throw new DeleteMediaError(400, 'Invalid media id.', 'bad_id');
  if (!accessToken) throw new DeleteMediaError(401, 'Your session expired — sign in again.', 'unauthorized');

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new DeleteMediaError(
      500,
      'The delete API has no Supabase server credentials (SUPABASE_SERVICE_ROLE_KEY).',
      'not_configured',
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data: auth, error: authErr } = await supabase.auth.getUser(accessToken);
  if (authErr || !auth?.user) {
    throw new DeleteMediaError(401, 'Your session expired — sign in again.', 'unauthorized');
  }

  const { data: row, error: fetchErr } = await supabase
    .from('media')
    .select('id, wedding_id, cloudinary_public_id, type')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) throw new DeleteMediaError(500, 'Could not look up this item.', 'lookup_failed');
  if (!row) throw new DeleteMediaError(404, 'This item was already deleted.', 'not_found');

  let asset;
  try {
    asset = await destroyAsset(row.cloudinary_public_id, row.type === 'video' ? 'video' : 'image');
  } catch (err) {
    if (err instanceof DeleteMediaError) throw err;
    console.error('[media] cloudinary delete failed:', row.cloudinary_public_id, err?.message || err);
    throw new DeleteMediaError(
      502,
      'The file could not be removed from Cloudinary. Nothing was deleted — try again.',
      'cloudinary_failed',
    );
  }

  const { error: delErr } = await supabase.from('media').delete().eq('id', row.id);
  if (delErr) {
    console.error('[media] database delete failed:', delErr.message);
    throw new DeleteMediaError(
      500,
      'The file was removed but its gallery entry could not be deleted. Try again.',
      'delete_failed',
    );
  }

  console.log(`[media] deleted ${row.type} ${row.id} (${row.cloudinary_public_id}) — asset ${asset}`);
  return { id: row.id, asset };
}
