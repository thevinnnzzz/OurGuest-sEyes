import { v2 as cloudinary } from 'cloudinary';

const { CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME;

if (cloudName && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.warn('[server] Cloudinary credentials incomplete — media purge will skip cloud cleanup.');
}

export async function deleteCloudinaryAsset(publicId, resourceType = 'auto') {
  try {
    return await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  } catch (err) {
    if (err?.error?.http_code === 420) throw err;
    console.warn(`[cloudinary] could not delete ${publicId}:`, err?.message || err);
    return null;
  }
}

export async function deleteManyCloudinaryAssets(publicIds, resourceType = 'image') {
  if (publicIds.length === 0) return 0;
  try {
    const res = await cloudinary.api.delete_resources(publicIds, {
      resource_type: resourceType,
      invalidate: true,
    });
    return Object.values(res?.deleted || {}).filter((v) => v === 'deleted').length;
  } catch (err) {
    console.warn(`[cloudinary] bulk delete error (${resourceType}):`, err?.message || err);
    return 0;
  }
}

/**
 * Deletes one asset and reports the real outcome instead of swallowing errors,
 * so an admin delete can keep the database row when Cloudinary refuses.
 * @returns {Promise<'deleted'|'missing'>}
 */
export async function destroyCloudinaryAsset(publicId, resourceType = 'image') {
  const res = await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
    invalidate: true,
  });
  const result = res?.result;
  if (result === 'ok') return 'deleted';
  // Nothing left to remove in Cloudinary — treat as success.
  if (result === 'not found') return 'missing';
  throw new Error(`cloudinary returned ${result || 'no result'}`);
}
