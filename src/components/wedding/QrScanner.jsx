import { useEffect, useRef, useState } from 'react';

// Frames are downscaled before decoding: a 480px-wide frame is plenty for a
// printed table card and keeps the scan loop cheap on older phones.
const FRAME_MAX = 480;
const PHOTO_MAX = 1600;

// The decoder is ~85 kB gzipped, so it is fetched only when a guest actually
// starts scanning — the landing page itself never pays for it.
let decoderPromise = null;
function loadDecoder() {
  if (!decoderPromise) {
    decoderPromise = import('jsqr')
      .then((mod) => mod.default)
      .catch((error) => {
        decoderPromise = null;
        throw error;
      });
  }
  return decoderPromise;
}

function decodeCanvas(decoder, canvas, source, width, height) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(source, 0, 0, width, height);
  const image = ctx.getImageData(0, 0, width, height);
  return decoder(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
}

function cameraErrorMessage(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access is blocked. Allow the camera for this site, or choose a photo of the QR code instead.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device. Choose a photo of the QR code instead.';
  }
  if (name === 'NotReadableError') {
    return 'The camera is busy in another app. Close that app, or choose a photo instead.';
  }
  return 'The camera could not start. Choose a photo of the QR code instead.';
}

/**
 * Live camera QR reader with a photo-upload fallback.
 *
 * `onDetected(text)` may be called repeatedly; it must return `true` once the
 * code has been accepted (the parent then navigates away) or `false` to keep
 * scanning, in which case the caller explains why the code was rejected.
 */
export default function QrScanner({ onDetected, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [camera, setCamera] = useState('starting'); // starting | live | unavailable
  const [hint, setHint] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let stream = null;
    let timer = null;
    let slowTimer = null;
    let decoder = null;

    loadDecoder()
      .then((loaded) => {
        decoder = loaded;
      })
      .catch(() => {
        if (cancelled) return;
        setHint('The scanner could not load. Please check your connection and try again.');
      });

    // Some browsers leave getUserMedia pending forever (no device, prompt
    // suppressed). Never sit on "Opening your camera…" — offer the photo path.
    slowTimer = setTimeout(() => {
      if (cancelled) return;
      setCamera((current) => (current === 'starting' ? 'unavailable' : current));
      setHint((current) => current || 'Your camera is taking too long to open. Choose a photo of the QR code instead.');
    }, 8000);

    const scanFrame = () => {
      if (cancelled) return false;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2 || !video.videoWidth) return false;
      if (!decoder) return false;

      const ratio = Math.min(1, FRAME_MAX / Math.max(video.videoWidth, video.videoHeight));
      const width = Math.max(1, Math.round(video.videoWidth * ratio));
      const height = Math.max(1, Math.round(video.videoHeight * ratio));

      let code = null;
      try {
        code = decodeCanvas(decoder, canvas, video, width, height);
      } catch {
        return false; // a dropped frame is never fatal — try the next one
      }
      if (!code?.data) return false;
      if (onDetected(code.data)) return true;
      setHint('That QR code is not a guest gallery. Please scan the card printed on your table.');
      return false;
    };

    const loop = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        if (scanFrame()) return;
        loop();
      }, 150);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCamera('unavailable');
          setHint('This browser cannot open the camera here. Choose a photo of the QR code instead.');
        }
        return;
      }
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 1280 },
          },
        });
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = media;
        await video.play().catch(() => {});
        if (cancelled) return;
        setCamera('live');
        setHint(null);
        loop();
      } catch (error) {
        if (cancelled) return;
        setCamera('unavailable');
        setHint(cameraErrorMessage(error));
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (slowTimer) clearTimeout(slowTimer);
      if (stream) stream.getTracks().forEach((track) => track.stop());
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readPhoto = async (file) => {
    if (!file) return;
    setBusy(true);
    setHint(null);
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('unreadable image'));
        img.src = url;
      });
      const ratio = Math.min(1, PHOTO_MAX / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * ratio));
      const height = Math.max(1, Math.round(image.naturalHeight * ratio));
      const decoder = await loadDecoder();
      const code = decodeCanvas(decoder, canvasRef.current, image, width, height);
      if (!code?.data) {
        setHint('No QR code was found in that photo. Try a closer, sharper shot — or use the camera.');
      } else if (!onDetected(code.data)) {
        setHint('That QR code is not a guest gallery. Please use the card printed on your table.');
      }
    } catch {
      setHint('That photo could not be read. Try another one.');
    } finally {
      URL.revokeObjectURL(url);
      setBusy(false);
    }
  };

  return (
    <div className="mt-4">
      <div className="relative overflow-hidden rounded-xl border border-brown/25 bg-brown-dark">
        <video
          ref={videoRef}
          className={`aspect-square w-full object-cover ${camera === 'live' ? '' : 'opacity-40'}`}
          muted
          playsInline
          autoPlay
        />
        {camera === 'live' && (
          <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-cream/80 shadow-[0_0_0_9999px_rgba(74,53,39,0.45)]" />
        )}
        {camera !== 'live' && (
          <div className="absolute inset-0 grid place-items-center p-5 text-center">
            <p className="text-[11px] leading-relaxed text-cream/85">
              {camera === 'starting' ? 'Opening your camera…' : 'Camera unavailable'}
            </p>
          </div>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <p aria-live="polite" className="mt-2 min-h-[2.5rem] text-center text-[11px] leading-relaxed text-brown/60">
        {hint || (camera === 'live' ? 'Point your camera at the QR code on your table card.' : ' ')}
      </p>

      <label className="oge-btn-outline w-full cursor-pointer text-sm">
        {busy ? 'Reading photo…' : 'Choose a photo of the QR code'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            readPhoto(file);
          }}
        />
      </label>

      <button
        type="button"
        onClick={onCancel}
        className="mt-3 w-full text-center text-[11px] uppercase tracking-[0.2em] text-brown/45 underline decoration-brown/20 underline-offset-4 hover:text-brown"
      >
        Cancel
      </button>
    </div>
  );
}
