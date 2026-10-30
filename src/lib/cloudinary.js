const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryReady = Boolean(cloudName && uploadPreset);

export const MAX_PHOTO_MB = 20;
export const MAX_VIDEO_MB = 100;
export const MAX_VIDEO_SECONDS = 20;

/**
 * Reads a local video file's duration in seconds without uploading it.
 * Resolves null when the browser cannot determine it (e.g. a codec it cannot
 * decode), so callers can decide how strict to be.
 */
export function getVideoDuration(file, timeoutMs = 5000) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(value) && value > 0 ? value : null);
    };

    // Fragmented MP4 and MediaRecorder WebM report `Infinity` until the
    // browser has scanned to the end, which a seek to a huge time forces.
    const check = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) finish(video.duration);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    video.preload = 'metadata';
    video.addEventListener('loadedmetadata', () => {
      if (Number.isFinite(video.duration) && video.duration > 0) return finish(video.duration);
      video.addEventListener('durationchange', check);
      video.addEventListener('seeked', check);
      video.currentTime = 1e101;
    });
    video.addEventListener('error', () => finish(null));
    video.src = url;
  });
}

/**
 * Uploads a single file to Cloudinary using an unsigned upload preset.
 * @returns {Promise<{publicId, url, type}>}
 */
export async function uploadToCloudinary(file, { onProgress } = {}) {
  if (!cloudinaryReady) {
    throw new Error(
      'Cloudinary is not configured. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env',
    );
  }

  const type = file.type.startsWith('video/') ? 'video' : 'image';
  const resourceType = type === 'video' ? 'video' : 'image';

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', uploadPreset);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      });
    }

    xhr.addEventListener('load', () => {
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 400 || res.error) {
          reject(new Error(res.error?.message || `Upload failed (${xhr.status})`));
          return;
        }
        resolve({
          publicId: res.public_id,
          url: res.secure_url,
          type,
          width: res.width,
          height: res.height,
          duration: res.duration,
        });
      } catch (e) {
        reject(new Error('Invalid response from Cloudinary'));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during upload')));
    xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));
    xhr.send(form);
  });
}
