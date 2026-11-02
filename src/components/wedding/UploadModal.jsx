import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../ui/Modal.jsx';
import CameraCapture from './CameraCapture.jsx';
import { filterCss } from '../../lib/constants.js';
import {
  uploadToCloudinary,
  getVideoDuration,
  MAX_PHOTO_MB,
  MAX_VIDEO_MB,
  MAX_VIDEO_SECONDS,
  cloudinaryReady,
} from '../../lib/cloudinary.js';

import { supabase } from '../../lib/supabase.js';

function formatDuration(seconds) {
  const total = Math.round(seconds);
  return total >= 60 ? `${Math.floor(total / 60)}m ${total % 60}s` : `${total}s`;
}

let itemSeq = 0;

/** Pending upload with its own preview URL, filter and type. */
function makeItem(file, filter = 'none') {
  itemSeq += 1;
  return {
    id: `${Date.now()}-${itemSeq}`,
    file,
    type: file.type.startsWith('video/') ? 'video' : 'photo',
    filter,
    previewUrl: URL.createObjectURL(file),
  };
}

export default function UploadModal({ open, onClose, wedding, remaining, session, onUploaded }) {
  const [files, setFiles] = useState([]);
  // Only remembered so the camera reopens on the guest's last preset; every
  // file carries its own filter, and there is no picker outside the camera.
  const [lastCameraFilter, setLastCameraFilter] = useState('none');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' });
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [caption, setCaption] = useState('');
  const [activeSlide, setActiveSlide] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const railRef = useRef(null);
  const filesRef = useRef([]);
  const dragRef = useRef(null);

  const cameraSupported =
    typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia) && window.isSecureContext;

  // `remaining` already holds how many of each type this guest can still add
  // (the wedding limit minus their own uploads), so use it as-is.
  const remainingPhotos = Math.max(0, remaining?.photos ?? 0);
  const remainingVideos = Math.max(0, remaining?.videos ?? 0);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  // Release preview object URLs when the sheet closes or the modal unmounts.
  useEffect(() => {
    if (open) return;
    filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    setFiles([]);
    setPreviewIndex(null);
    setActiveSlide(0);
    setCaption('');
  }, [open]);

  useEffect(
    () => () => {
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  const validate = async (list) => {
    const errs = [];
    const photos = list.filter((f) => f.type.startsWith('image/'));
    const videos = list.filter((f) => f.type.startsWith('video/'));
    if (photos.length + videos.length !== list.length) errs.push('Only photos and videos are allowed.');
    if (photos.length > remainingPhotos)errs.push(`You can only add ${remainingPhotos} more photo${remainingPhotos === 1 ? '' : 's'}.`);
    if (videos.length > remainingVideos) errs.push(`You can only add ${remainingVideos} more video${remainingVideos === 1 ? '' : 's'}.`);
    for (const p of photos) if (p.size > MAX_PHOTO_MB * 1024 * 1024) errs.push(`"${p.name}" is over ${MAX_PHOTO_MB} MB.`);
    for (const v of videos) {
      if (v.size > MAX_VIDEO_MB * 1024 * 1024) {
        errs.push(`"${v.name}" is over ${MAX_VIDEO_MB} MB.`);
        continue;
      }
      // Read the clip's length locally before uploading; half a second of
      // tolerance keeps a clip that reports 20.2s from being rejected.
      const seconds = await getVideoDuration(v);
      if (seconds && seconds > MAX_VIDEO_SECONDS + 0.5) {
        errs.push(`"${v.name}" is ${formatDuration(seconds)} long — videos can be up to ${MAX_VIDEO_SECONDS} seconds.`);
      }
    }
    return errs;
  };

  const onFilesPicked = async (e) => {
    const chosen = Array.from(e.target.files || []);
    setChecking(true);
    const errs = await validate(chosen);
    setChecking(false);
    setError(errs.length ? errs.join(' ') : null);
    setFiles(
      errs.length === 0 ? chosen.map((f) => makeItem(f)) : [],
    );
    e.target.value = '';
  };

  const stepPreview = (delta) => {
    setPreviewIndex((index) => {
      if (index === null) return index;
      return (index + delta + files.length) % files.length;
    });
  };

  // Horizontal swipe on the full-screen preview. Waits for the gesture to be
  // clearly sideways so a vertical drag can still scroll the page.
  const onViewerPointerDown = (event) => {
    if (files.length < 2) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, lastX: 0, active: false };
  };

  const onViewerPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
      drag.active = true;
      setDragging(true);
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        /* best effort */
      }
    }
    drag.lastX = dx;
    setDragX(dx);
  };

  const onViewerPointerUp = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const dx = drag.lastX || 0;
    const threshold = Math.min(110, window.innerWidth * 0.16);
    setDragging(false);
    setDragX(0);
    if (drag.active && Math.abs(dx) > threshold) stepPreview(dx > 0 ? -1 : 1);
  };

  const onViewerPointerLeave = () => {
    // A small (not yet active) drag that leaves the stage never captured the
    // pointer, so its pointerup lands elsewhere; drop it and snap back.
    if (dragRef.current && !dragRef.current.active) {
      dragRef.current = null;
      setDragX(0);
    }
  };

  const removeFile = (id) => {
    setFiles((previous) => {
      const target = previous.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((item) => item.id !== id);
    });
    setPreviewIndex(null);
    setActiveSlide(0);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // Everything shared in this one go belongs to a single post.
      const batchId =
        typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `batch-${Date.now()}`;
      let uploaded = 0;
      for (const item of files) {
        setProgress({ done: uploaded, total: files.length, label: `Uploading "${item.file.name}"…` });
        const res = await uploadToCloudinary(item.file, {
          onProgress: (pct) =>
            setProgress({ done: uploaded, total: files.length, label: `Uploading "${item.file.name}" — ${pct}%` }),
        });
        const row = {
          wedding_id: wedding.id,
          guest_id: session.guestId,
          cloudinary_public_id: res.publicId,
          url: res.url,
          type: res.type,
          filter_name: res.type === 'photo' ? item.filter || 'none' : null,
        };

        // `batch_id` and `caption` are optional columns. Retry without whichever
        // one is missing so a project that has not migrated can still upload.
        const text = caption.trim() || null;
        const attempts = [
          { ...row, batch_id: batchId, caption: text },
          { ...row, batch_id: batchId },
          { ...row, caption: text },
          row,
        ];

        let dbErr;
        for (const payload of attempts) {
          ({ error: dbErr } = await supabase.from('media').insert(payload));
          if (!dbErr || !/batch_id|caption/i.test(dbErr.message || '')) break;
        }
        if (dbErr) throw dbErr;
        uploaded += 1;
        setProgress({ done: uploaded, total: files.length, label: '' });
      }
      onUploaded();
      files.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setFiles([]);
      setCaption('');
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
  const previewItem = previewIndex === null ? null : files[previewIndex] || null;

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

          {cameraSupported && (
            <>
              <button type="button" onClick={() => setCameraOpen(true)} className="oge-btn-primary w-full">
                📸 Quick snap — photo or video
              </button>
              <p className="text-center text-[11px] uppercase tracking-[0.2em] text-brown/45">or from your device</p>
            </>
          )}

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
              Photos up to {MAX_PHOTO_MB} MB · Videos up to {MAX_VIDEO_MB} MB and {MAX_VIDEO_SECONDS} seconds
            </span>
          </label>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="oge-label mb-0">Ready to share ({files.length})</p>
                <p className="text-[11px] text-brown/45">Tap a card to preview</p>
              </div>

              <div
                ref={railRef}
                onScroll={(event) => {
                  const rail = event.currentTarget;
                  const card = rail.firstElementChild;
                  if (!card) return;
                  const step = card.getBoundingClientRect().width + 12;
                  setActiveSlide(Math.min(files.length - 1, Math.round(rail.scrollLeft / step)));
                }}
                className="oge-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2"
              >
                {files.map((item, index) => (
                  <figure
                    key={item.id}
                    className="relative w-36 shrink-0 snap-center overflow-hidden rounded-2xl border border-brown/10 bg-beige shadow-soft"
                  >
                    <button
                      type="button"
                      onClick={() => setPreviewIndex(index)}
                      aria-label={`Preview ${item.file.name}`}
                      className="relative block h-44 w-full"
                    >
                      {item.type === 'photo' ? (
                        <img
                          src={item.previewUrl}
                          alt=""
                          className="h-full w-full object-cover"
                          style={{ filter: filterCss(item.filter) }}
                        />
                      ) : (
                        <>
                          <video
                            src={item.previewUrl}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full rounded-t-2xl object-cover"
                          />
                          <span className="absolute inset-0 flex items-center justify-center text-3xl text-cream drop-shadow">
                            ▶
                          </span>
                        </>
                      )}
                    </button>
                    <span className="absolute left-1.5 top-1.5 rounded-full bg-brown-dark/70 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em] text-cream">
                      {item.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-brown-dark/70 text-sm leading-none text-cream"
                    >
                      ×
                    </button>
                    <figcaption className="truncate px-2 py-1.5 text-[10px] text-brown/60">{item.file.name}</figcaption>
                  </figure>
                ))}
              </div>

              {files.length > 1 && (
                <div className="flex justify-center gap-1.5">
                  {files.map((item, index) => (
                    <span
                      key={item.id}
                      className={`h-1.5 rounded-full transition-all ${
                        index === activeSlide ? 'w-4 bg-brown/70' : 'w-1.5 bg-brown/25'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-1.5">
              <label className="oge-label" htmlFor="mediaCaption">Caption (optional)</label>
              <input
                id="mediaCaption"
                className="oge-input text-sm"
                placeholder="Say something about these moments…"
                value={caption}
                onChange={(event) => setCaption(event.target.value)}
                maxLength={150}
                disabled={busy}
              />
            </div>
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
              disabled={busy || checking || files.length === 0 || !cloudinaryReady}
            >
              {busy ? 'Uploading…' : checking ? 'Checking length…' : `Share ${files.length || ''}`}
            </button>
          </div>
        </div>
      )}
      {previewItem &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex flex-col bg-brown-dark/95 p-4" role="dialog" aria-modal="true">
          <div className="flex items-center justify-between gap-3 pb-3 text-cream">
            <p className="truncate text-xs text-cream/70">{previewItem.file.name}</p>
            <button
              type="button"
              onClick={() => setPreviewIndex(null)}
              aria-label="Close preview"
              className="rounded-full bg-white/10 px-3 py-1 text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div
            className="flex flex-1 items-center justify-center overflow-hidden"
            onPointerDown={onViewerPointerDown}
            onPointerMove={onViewerPointerMove}
            onPointerUp={onViewerPointerUp}
            onPointerCancel={onViewerPointerUp}
            onPointerLeave={onViewerPointerLeave}
            style={{ touchAction: 'pan-y' }}
          >
            <div
              key={previewItem.id}
              className="w-full max-w-2xl overflow-hidden rounded-3xl bg-black shadow-2xl"
              style={{
                transform: dragX ? `translateX(${dragX}px)` : undefined,
                transition: dragging ? 'none' : 'transform 180ms ease',
              }}
            >
              {previewItem.type === 'photo' ? (
                <img
                  src={previewItem.previewUrl}
                  alt=""
                  draggable={false}
                  className="max-h-[75dvh] w-full object-contain"
                  style={{ filter: filterCss(previewItem.filter) }}
                />
              ) : (
                <video
                  src={previewItem.previewUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[75dvh] w-full bg-black"
                />
              )}
            </div>
          </div>

            {files.length > 1 && (
              <div className="mt-4 flex items-center justify-center gap-6 text-cream">
                <button
                  type="button"
                  aria-label="Previous item"
                  onClick={() => stepPreview(-1)}
                  className="rounded-full bg-white/10 px-3 py-1 text-xl leading-none"
                >
                  ‹
                </button>
                <span className="text-xs tracking-wide text-cream/70">
                  {(previewIndex ?? 0) + 1} / {files.length}
                </span>
                <button
                  type="button"
                  aria-label="Next item"
                  onClick={() => stepPreview(1)}
                  className="rounded-full bg-white/10 px-3 py-1 text-xl leading-none"
                >
                  ›
                </button>
                </div>
              )}
            {files.length > 1 && (
              <p className="mt-2 text-center text-[10px] uppercase tracking-[0.2em] text-cream/40">swipe to browse</p>
            )}
          </div>,
          document.body,
        )}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        initialFilter={lastCameraFilter}
        remainingPhotos={remainingPhotos - files.filter((item) => item.type === 'photo').length}
        remainingVideos={remainingVideos - files.filter((item) => item.type === 'video').length}
        onCapture={({ shots: captured, filter: chosenFilter }) => {
          setLastCameraFilter(chosenFilter);
          setFiles((previous) => [
            ...previous,
            ...captured.map(({ file, filter: shotFilter }) => makeItem(file, shotFilter)),
          ]);
          setError(null);
        }}
      />
    </Modal>
  );
}
