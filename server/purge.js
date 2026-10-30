import { adminSupabase } from './supabase.js';
import { deleteManyCloudinaryAssets } from './cloudinary.js';

/**
 * Finds weddings past expires_at, deletes their media from Cloudinary
 * (photos + videos) and all dependent rows from Supabase via cascade
 * (wedding delete cascades to guests, media, likes, comments, messages).
 */
export async function purgeExpiredWeddings() {
  const { data: expired, error } = await adminSupabase.rpc('pending_expired_weddings');
  if (error) throw new Error(`supabase: ${error.message}`);
  if (!expired || expired.length === 0) return { purged: 0, details: [] };

  const details = [];
  for (const wedding of expired) {
    let photosDeleted = 0;
    let videosDeleted = 0;

    const { data: mediaRows, error: mediaErr } = await adminSupabase
      .from('media')
      .select('id, cloudinary_public_id, type')
      .eq('wedding_id', wedding.id);

    if (mediaErr) throw new Error(`supabase media fetch: ${mediaErr.message}`);

    if (mediaRows && mediaRows.length > 0) {
      const photoIds = mediaRows.filter((m) => m.type === 'photo').map((m) => m.cloudinary_public_id);
      const videoIds = mediaRows.filter((m) => m.type === 'video').map((m) => m.cloudinary_public_id);
      photosDeleted = await deleteManyCloudinaryAssets(photoIds, 'image');
      videosDeleted = await deleteManyCloudinaryAssets(videoIds, 'video');

      const { error: delWeddingErr } = await adminSupabase
        .from('weddings')
        .delete()
        .eq('id', wedding.id);
      if (delWeddingErr) throw new Error(`supabase delete wedding: ${delWeddingErr.message}`);
    } else {
      const { error: delWeddingErr } = await adminSupabase
        .from('weddings')
        .delete()
        .eq('id', wedding.id);
      if (delWeddingErr) throw new Error(`supabase delete wedding: ${delWeddingErr.message}`);
    }

    details.push({
      wedding: wedding.slug,
      id: wedding.id,
      mediaCount: mediaRows?.length || 0,
      photosDeleted,
      videosDeleted,
    });
  }

  return { purged: details.length, details };
}
