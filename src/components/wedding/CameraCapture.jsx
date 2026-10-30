import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PHOTO_FILTERS, filterCss } from '../../lib/constants.js';
import { MAX_VIDEO_SECONDS } from '../../lib/cloudinary.js';

const HOLD_MS = 320;
const MIN_RECORD_MS = 900;

const MIME_CANDIDATES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

/**
 * Starts a MediaRecorder on the first container/codec the browser accepts for
 * this stream. Codec strings that name an audio codec are skipped when the
 * stream has no audio track, because `start()` throws NotSupportedError on them.
 */
function startRecorder(stream, onChunk) {
  if (typeof MediaRecorder === 'undefined') return null;
  const hasAudio = stream.getAudioTracks().length > 0;
  const candidates = MIME_CANDIDATES.filter((type) => hasAudio || !/mp4a|opus/i.test(type));
  candidates.push(null); // let the browser choose

  for (const mimeType of candidates) {
    if (mimeType && !MediaRecorder.isTypeSupported?.(mimeType)) continue;
    try {
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 })
        : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => onChunk(event.data);
      recorder.start(100);
      return recorder;
    } catch {
      /* try the next container */
    }
  }
  return null;
}

function stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}${pad(d.getSeconds())}`;
}

function secondsLabel(ms) {
  const total = Math.floor(ms / 1000);
  return `0:${String(total).padStart(2, '0')}`;
}

/**
 * In-app camera: tap the shutter for a photo, hold it for a video (up to
 * MAX_VIDEO_SECONDS). Filters are the same presets used on uploads, shown
 * live and stored as `filter_name` — they are never baked into the pixels.
 */
export default function CameraCapture({
  open,
  onClose,
  onCapture,
  remainingPhotos = 0,
  remainingVideos = 0,
  initialFilter = 'none',
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const holdTimerRef = useRef(null);
  const tickRef = useRef(null);
  const startedAtRef = useRef(0);
  const shotsRef = useRef([]);

  const [facing, setFacing] = useState('environment');
  const [filter, setFilter] = useState(initialFilter);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shots, setShots] = useState([]);

  useEffect(() => {
    if (!open) return undefined;
    setFilter(initialFilter);
  }, [open, initialFilter]);

  const releaseStream = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Open / flip camera
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setReady(false);
    setError(null);

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser cannot open the camera here. Use “choose from device” instead.');
        return;
      }
      const video = { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } };
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
        } catch (err) {
          if (cancelled) return;
          setError(
            err?.name === 'NotAllowedError'
              ? 'Camera access was blocked. Allow it in your browser settings, then try again.'
              : err?.name === 'NotFoundError'
                ? 'No camera was found on this device.'
                : 'The camera could not start. Try again, or choose a file instead.',
          );
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play?.().catch(() => {});
      }
      setReady(true);
    };

    start();
    return () => {
      cancelled = true;
      releaseStream();
    };
  }, [open, facing, releaseStream]);

  // Clear pending shots when the camera closes
  useEffect(() => {
    if (open) return;
    shotsRef.current.forEach((shot) => URL.revokeObjectURL(shot.url));
    shotsRef.current = [];
    setShots([]);
  }, [open]);

  const addShot = useCallback((file, type, duration = null, filterId = 'none') => {
    const url = URL.createObjectURL(file);
    const shot = { file, type, duration, filter: filterId, url };
    shotsRef.current = [...shotsRef.current, shot];
    setShots(shotsRef.current);
  }, []);

  const photoSlots = remainingPhotos - shots.filter((s) => s.type === 'photo').length;
  const videoSlots = remainingVideos - shots.filter((s) => s.type === 'video').length;

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !ready) return;
    if (photoSlots <= 0) {
      setError('You have used up your photo allowance for this wedding.');
      return;
    }
    setError(null);
    const width = video.videoWidth || 1080;
    const height = video.videoHeight || 1920;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (facing === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError('That frame could not be captured. Try again.');
          return;
        }
        addShot(new File([blob], `snap-${stamp()}.jpg`, { type: 'image/jpeg' }), 'photo', null, filter);
      },
      'image/jpeg',
      0.92,
    );
  }, [addShot, facing, filter, photoSlots, ready]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') recorder.stop();
    clearInterval(tickRef.current);
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current || recorderRef.current?.state === 'recording') return;
    if (videoSlots <= 0) {
      setError('You have used up your video allowance for this wedding.');
      return;
    }
    setError(null);
    chunksRef.current = [];
    const filterAtStart = filter;
    startedAtRef.current = Date.now();
    const recorder = startRecorder(streamRef.current, (data) => {
      if (data?.size) chunksRef.current.push(data);
    });
    if (!recorder) {
      setError('Recording video is not supported in this browser.');
      return;
    }
    const mimeType = recorder.mimeType || 'video/webm';
    recorderRef.current = recorder;
    recorder.onstop = () => {
      clearInterval(tickRef.current);
      const duration = Date.now() - startedAtRef.current;
      const chunks = chunksRef.current;
      chunksRef.current = [];
      recorderRef.current = null;
      setRecording(false);
      setElapsed(0);
      if (duration < MIN_RECORD_MS) {
        setError('Hold the shutter a little longer to record a video.');
        return;
      }
      const type = mimeType.split(';')[0];
      const ext = type.includes('mp4') ? 'mp4' : 'webm';
      addShot(
        new File([new Blob(chunks, { type })], `clip-${stamp()}.${ext}`, { type }),
        'video',
        duration,
        filterAtStart,
      );
    };

    setRecording(true);
    setElapsed(0);
    tickRef.current = setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      if (ms >= MAX_VIDEO_SECONDS * 1000) stopRecording();
    }, 100);
  }, [addShot, filter, stopRecording, videoSlots]);

  const onShutterDown = (event) => {
    event.preventDefault();
    if (!ready || recording) return;
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId);
    } catch {
      /* capture is best-effort; the press still works without it */
    }
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      startRecording();
    }, HOLD_MS);
  };

  const onShutterUp = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      takePhoto();
      return;
    }
    if (recording) stopRecording();
  };

  const finish = () => {
    stopRecording();
    onCapture?.({ shots: shotsRef.current.map(({ file, filter: shotFilter }) => ({ file, filter: shotFilter })), filter });
    onClose?.();
  };

  const close = () => {
    stopRecording();
    onClose?.();
  };

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => event.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canFinish = shots.length > 0;
  const remainingSeconds = Math.max(0, MAX_VIDEO_SECONDS - elapsed / 1000);

  return createPortal(
    <div className="fixed inset-0 z-[60] flex flex-col bg-brown-dark text-cream" role="dialog" aria-modal="true">
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button type="button" onClick={close} aria-label="Close camera" className="rounded-full bg-white/10 px-3 py-1.5 text-lg leading-none">
          ×
        </button>
        <p className="font-display text-sm tracking-wide text-cream/80">
          {recording ? `${secondsLabel(elapsed)} · ${Math.ceil(remainingSeconds)}s left` : 'Our Guests’ Eyes'}
        </p>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          aria-label="Switch camera"
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm"
        >
          ⟲
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          autoPlay
          muted
          className="h-full w-full object-cover"
          style={{
            filter: filterCss(filter),
            transform: facing === 'user' ? 'scaleX(-1)' : undefined,
          }}
        />

        {!ready && !error && (
          <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm text-cream/70">Opening the camera…</p>
        )}

        {error && (
          <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 rounded-2xl bg-cream/95 p-4 text-center text-sm text-brown">
            <p>{error}</p>
            <button type="button" onClick={close} className="oge-btn-outline mt-3">
              Choose from device instead
            </button>
          </div>
        )}

        {recording && (
          <div className="absolute inset-x-0 top-0 h-1 bg-white/20">
            <div
              className="h-full bg-rose"
              style={{ width: `${Math.min(100, (elapsed / (MAX_VIDEO_SECONDS * 1000)) * 100)}%` }}
            />
          </div>
        )}

        {shots.length > 0 && (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2 px-3">
            {shots.slice(-5).map((shot) => (
              <span key={shot.url} className="h-12 w-12 overflow-hidden rounded-lg border border-cream/40">
                {shot.type === 'photo' ? (
                  <img src={shot.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-brown/70 text-[10px]">▶ video</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <div className="oge-scrollbar flex gap-2 overflow-x-auto pb-1">
          {PHOTO_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setFilter(option.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs tracking-wide transition ${
                filter === option.id ? 'border-gold bg-gold/20 text-cream' : 'border-cream/25 text-cream/70'
              }`}
            >
              {option.name}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={finish}
            disabled={!canFinish}
            className="w-20 rounded-full border border-cream/30 px-3 py-2 text-xs text-cream/80 disabled:opacity-40"
          >
            {canFinish ? `Done (${shots.length})` : 'Done'}
          </button>

          <button
            type="button"
            onPointerDown={onShutterDown}
            onPointerUp={onShutterUp}
            onPointerCancel={onShutterUp}
            onContextMenu={(event) => event.preventDefault()}
            onKeyDown={(event) => {
              if ((event.key === 'Enter' || event.key === ' ') && ready) {
                event.preventDefault();
                takePhoto();
              }
            }}
            aria-label={recording ? 'Release to stop recording' : 'Take a photo, or hold to record a video'}
            className="touch-none select-none rounded-full p-1"
          >
            <span
              className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-cream transition ${
                recording ? 'bg-rose' : 'bg-cream/20'
              }`}
            >
              <span className={`rounded-full bg-cream transition-all ${recording ? 'h-5 w-5 rounded-sm' : 'h-12 w-12'}`} />
            </span>
          </button>

          <span className="w-20 text-center text-[10px] leading-tight text-cream/60">
            {recording ? 'release to stop' : 'tap photo · hold video'}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
