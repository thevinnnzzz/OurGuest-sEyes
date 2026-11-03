import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../../context/EventContext.jsx';
import { readStoredSession } from '../../lib/guestSession.js';
import QrScanner from './QrScanner.jsx';

/**
 * A gallery QR carries our own URL — `/w/<slug>` — so anything else on the
 * table (a venue Wi-Fi code, a menu link, a stranger's QR) is rejected instead
 * of sending the guest to a gallery that does not exist.
 */
function scannedSlug(value) {
  const raw = String(value || '').trim();
  if (!/^https?:\/\//i.test(raw)) return null;
  let path;
  try {
    path = new URL(raw).pathname;
  } catch {
    return null;
  }
  const match = path.match(/^\/w\/([a-z0-9][a-z0-9-]{0,78})\/?$/i);
  return match ? match[1] : null;
}

/**
 * Root-page guest entry. Guests arrive with a phone and a printed table card,
 * not an event name, so the card's only job is to scan that code — with the
 * camera or from a photo already on the phone. Owner tools never appear here.
 */
export default function EventLookup() {
  const navigate = useNavigate();
  const { lastEvent } = useEvent();
  const [stored, setStored] = useState(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let alive = true;
    readStoredSession().then((session) => {
      if (alive) setStored(session);
    });
    return () => {
      alive = false;
    };
  }, []);

  const knownSlug = stored?.slug || lastEvent || null;

  const acceptScan = (text) => {
    const slug = scannedSlug(text);
    if (!slug) return false;
    navigate(`/w/${encodeURIComponent(slug)}`);
    return true;
  };

  return (
    <div className="oge-card mx-auto w-full max-w-md p-6 text-left">
      {knownSlug ? (
        <>
          <p className="text-[11px] uppercase tracking-[0.28em] text-brown/50">This device last visited</p>
          <button
            type="button"
            onClick={() => navigate(`/w/${encodeURIComponent(knownSlug)}`)}
            className="oge-btn-primary mt-3 w-full"
          >
            {stored?.fullName ? `Continue as ${stored.fullName}` : 'Return to your gallery'}
          </button>
          <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-brown/35">
            <span className="h-px flex-1 bg-brown/15" />
            or scan your table card
            <span className="h-px flex-1 bg-brown/15" />
          </div>
        </>
      ) : (
        <>
          <p className="text-center font-script text-3xl text-rose">Find your gallery</p>
          <p className="mt-1 text-center text-xs leading-relaxed text-brown/55">
            Scan the QR code printed on your table card to step inside.
          </p>
        </>
      )}

      {scanning ? (
        <QrScanner onDetected={acceptScan} onCancel={() => setScanning(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setScanning(true)}
          className="oge-btn-primary mt-4 w-full"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
            <path
              d="M4 8V6a2 2 0 0 1 2-2h2M4 16v2a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v2M16 20h2a2 2 0 0 0 2-2v-2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            <path d="M4 12h16" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.55" />
          </svg>
          Scan the QR code
        </button>
      )}
    </div>
  );
}
