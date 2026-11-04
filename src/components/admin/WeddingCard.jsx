import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { TrashIcon } from '../feed/icons.jsx';

const STATUS_STYLES = {
  live: 'bg-green-100 text-green-800 border-green-300',
  upcoming: 'bg-gold/20 text-brown border-gold',
  expired: 'bg-rose/15 text-rose-dark border-rose/40',
};

function DotsIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

export default function WeddingCard({ wedding, stats, onConfigure, onQr, onView, onDelete }) {
  const names = [wedding.couple_name_1, wedding.couple_name_2].filter(Boolean).join(' & ');
  const status = (wedding.status || 'live');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the card menu on outside tap or Escape, like a native menu.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const run = (action) => () => {
    setMenuOpen(false);
    action?.();
  };

  const daysLeft = wedding.expires_at
    ? Math.max(0, Math.ceil((new Date(wedding.expires_at) - new Date()) / 86400000))
    : null;

  return (
    <article className="oge-card flex flex-col">
      <div className="relative h-36 overflow-hidden rounded-t-2xl bg-beige">
        {wedding.cover_image_url ? (
          <img src={wedding.cover_image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl text-rose/60">❦</div>
        )}
        <span
          className={`absolute right-3 top-3 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${STATUS_STYLES[status] || STATUS_STYLES.live}`}
        >
          {status}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-semibold leading-snug text-brown">{names}</h3>
            <p className="text-xs text-brown/60">{dayjs(wedding.wedding_date).format('dddd, D MMM YYYY')}</p>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label={`More actions for ${names || 'this event'}`}
              className="rounded-full border border-brown/15 bg-white/80 p-1.5 text-brown/70 transition hover:border-gold hover:text-brown focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
            >
              <DotsIcon className="h-4 w-4" />
            </button>

            {menuOpen && (
              <div
                role="menu"
                className="oge-fade-in absolute right-0 top-[calc(100%+0.35rem)] z-30 w-44 overflow-hidden rounded-2xl border border-brown/10 bg-cream shadow-soft"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={run(onConfigure)}
                  className="block w-full px-4 py-2.5 text-left text-sm text-brown transition hover:bg-beige"
                >
                  Edit details
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={run(onQr)}
                  className="block w-full border-t border-brown/5 px-4 py-2.5 text-left text-sm text-brown transition hover:bg-beige"
                >
                  Guest QR code
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={run(onDelete)}
                  className="flex w-full items-center gap-2 border-t border-brown/10 px-4 py-2.5 text-left text-sm text-rose-dark transition hover:bg-rose/10"
                >
                  <TrashIcon className="h-4 w-4" />
                  Delete event
                </button>
              </div>
            )}
          </div>
        </div>

        {stats && (
          <dl className="grid grid-cols-4 gap-1 rounded-xl bg-beige/50 p-2 text-center">
            {[
              ['Guests', stats.guests],
              ['Media', stats.media],
              ['Likes', stats.likes],
              ['Notes', stats.messages],
            ].map(([label, val]) => (
              <div key={label}>
                <dd className="font-display text-base font-bold text-brown">{val ?? 0}</dd>
                <dt className="text-[9px] uppercase tracking-[0.14em] text-brown/55">{label}</dt>
              </div>
            ))}
          </dl>
        )}

        {status === 'live' && daysLeft != null && (
          <p className="text-xs text-rose-dark">Window closes in {daysLeft} day{daysLeft === 1 ? '' : 's'}</p>
        )}

        <div className="mt-auto grid grid-cols-2 gap-2">
          <button type="button" className="oge-btn-outline px-2 py-2 text-xs" onClick={onQr}>
            QR code
          </button>
          <button type="button" className="oge-btn-primary px-2 py-2 text-xs" onClick={onView}>
            View
          </button>
        </div>
      </div>
    </article>
  );
}
