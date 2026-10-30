import { useRef, useState } from 'react';
import Modal from '../ui/Modal.jsx';
import FilterPicker from './FilterPicker.jsx';
import { uploadToCloudinary, MAX_PHOTO_MB, MAX_VIDEO_MB, cloudinaryReady } from '../../lib/cloudinary.js';
import { supabase } from '../../lib/supabase.js';

export default function UploadModal({ open, onClose, wedding, remaining, session, onUploaded }) {
  const [files, setFiles] = useState([]);
  const [filter, setFilter] = useState('none');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const remainingPhotos = Math.max(0, wedding.max_photos_per_guest - remaining.photos);
  const remainingVideos = Math.max(0, wedding.max_videos_per_guest - remaining.videos);

  const validate = (list) => {
    const errs = [];
    const photos = list.filter((f) => f.type.startsWith('image/'));
    const videos = list.filter((f) => f.type.startsWith('video/'));
    if (photos.length + videos.length !== list.length) errs.push('Only photos and videos are allowed.');
    if (photos.length > remainingPhotos)errs.push(`You can only add ${remainingPhotos} more photo${remainingPhotos === 1 ? '' : 's'}.`);
    if (videos.length > remainingVideos) errs.push(`You can only add ${remainingVideos} more video${remainingVideos === 1 ? '' : 's'}.`);
    for (const p of photos) if (p.size > MAX_PHOTO_MB * 1024 * 1024) errs.push(`"${p.name}" is over ${MAX_PHOTO_MB} MB.`);
    for (const v of videos) if (v.size > MAX_VIDEO_MB * 1024 * 1024) errs.push(`"${v.name}" is over ${MAX_VIDEO_MB} MB.`);
    return errs;
  };

  const onFilesPicked = (e) => {
    const chosen = Array.from(e.target.files || []);
    const errs = validate(chosen);
    setError(errs.length ? errs.join(' ') : null);
    setFiles(
      errs.length === 0
        ? chosen.map((f) => ({ file: f, type: f.type.startsWith('video/') ? 'video' : 'photo' }))
        : [],
    );
    e.target.value = '';
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      let uploaded = 0;
      for (const item of files) {
        setProgress({ done: uploaded, total: files.length, label: `Uploading "${item.file.name}"…` });
        const res = await uploadToCloudinary(item.file, {
          onProgress: (pct) =>
            setProgress({ done: uploaded, total: files.length, label: `Uploading "${item.file.name}" — ${pct}%` }),
        });
        const { error: dbErr } = await supabase.from('media').insert({
          wedding_id: wedding.id,
          guest_id: session.guestId,
          cloudinary_public_id: res.publicId,
          url: res.url,
          type: res.type,
          filter_name: res.type === 'photo' ? filter : null,
        });
        if (dbErr) throw dbErr;
        uploaded += 1;
        setProgress({ done: uploaded, total: files.length, label: '' });
      }
      onUploaded();
      setFiles([]);
      onClose();
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
      setProgress({ done: 0, total: 0, label: '' });
    }
  };

  // guest id comes from the caller's session via props

  if (!wedding) return null;
  const canPick = remainingPhotos > 0 || remainingVideos > 0;

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title="Share your view" size="lg">
      {!cloudinaryReady && (
        <div className="mb-4 rounded-xl border border-rose/40 bg-rose/10 p-3 text-sm text-rose-dark">
          Uploads are not configured yet (missing Cloudinary keys in .env).
        </div>
      )}
      {!canPick ? (
        <div className="rounded-xl bg-beige/60 p-6 text-center text-brown">
          <p className="font-display text-lg font-semibold">You've used up your camera roll!</p>
          <p className="mt-1 text-sm text-brown/70">Each guest can share up to {wedding.max_photos_per_guest} photos and {wedding.max_videos_per_guest} videos — yours are already in the gallery.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-brown/70">
            You can still add <strong>{remainingPhotos}</strong> photo{remainingPhotos === 1 ? '' : 's'} and{' '}
            <strong>{remainingVideos}</strong> video{remainingVideos === 1 ? '' : 's'}.
          </p>

          <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-brown/25 bg-white/60 p-8 text-center transition hover:border-gold hover:bg-white/80">
            <input
              ref={inputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              hidden
              onChange={onFilesPicked}
            />
            <span className="block text-2xl" aria-hidden>📷</span>
            <span className="mt-2 block font-display font-semibold text-brown">Tap to choose photos & videos</span>
            <span className="mt-1 block text-xs text-brown/50">
              Photos up to {MAX_PHOTO_MB} MB · Videos up to {MAX_VIDEO_MB} MB
            </span>
          </label>

          {files.length > 0 && (
            <ul className="space-y-1.5 rounded-xl bg-beige/50 p-4 text-sm">
              {files.map((f) => (
                <li key={f.file.name + f.file.size} className="flex items-center justify-between gap-3">
                  <span className="truncate">{f.file.name}</span>
                  <span className="text-xs text-brown/50">{f.type}</span>
                </li>
              ))}
            </ul>
          )}

          {files.some((f) => f.type === 'photo') && (
            <FilterPicker value={filter} onChange={setFilter} />
          )}

          {progress.total > 0 && (
            <div className="h-2 overflow-hidden rounded-full bg-beige">
              <div className="h-full bg-gold transition-all" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
            </div>
          )}
          {progress.label && <p className="text-center text-xs text-brown/60">{progress.label}</p>}
          {error && <p className="rounded-xl bg-rose/10 p-3 text-center text-sm text-rose-dark">{error}</p>}

          <div className="flex justify-end gap-3">
            <button type="button" className="oge-btn-outline" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className="oge-btn-primary"
              onClick={submit}
              disabled={busy || files.length === 0 || !cloudinaryReady}
            >
              {busy ? 'Uploading…' : `Share ${files.length || ''}`}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
