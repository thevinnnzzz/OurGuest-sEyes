import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

function useRemaining(deadline) {
  const [remaining, setRemaining] = useState(Math.max(0, new Date(deadline).getTime() - Date.now()));
  useEffect(() => {
    setRemaining(Math.max(0, new Date(deadline).getTime() - Date.now()));
    const t = setInterval(() => setRemaining(Math.max(0, new Date(deadline).getTime() - Date.now())), 1000);
    return () => clearInterval(t);
  }, [deadline]);
  return remaining;
}

export default function CountdownBanner({ weddingDate, expiresAt, variant = 'full' }) {
  const deadline = expiresAt || `${weddingDate}T23:59:59`;
  const remaining = useRemaining(deadline);
  const expired = remaining <= 0;
  const d = Math.floor(remaining / 86400000);
  const h = Math.floor((remaining % 86400000) / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  const weddingDateFormatted = weddingDate ? dayjs(weddingDate).format('dddd, D MMMM YYYY') : '';

  if (expired) {
    return (
      <div className="rounded-2xl border border-brown/20 bg-brown px-5 py-4 text-center text-cream">
        The gallery window has closed. All media has been given to the couple.
      </div>
    );
  }

  if (variant === 'inline') {
    return (
      <p className="text-center text-xs tracking-wide text-brown/70">
        Download everything before it closes in{' '}
        <strong className="text-rose-dark">{d}d {h}h {m}m</strong>
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gold/40 bg-white/80 shadow-soft">
      <div className="bg-gold/90 px-4 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-brown-dark">
        This gallery will expire and delete all media in {d} {d === 1 ? 'day' : 'days'} — save what you love
      </div>
      <div className="grid grid-cols-4 divide-x divide-brown/10 px-2 py-4 text-center">
        {[
          ['days', d],
          ['hours', h],
          ['min', m],
          ['sec', s],
        ].map(([unit, val]) => (
          <div key={unit}>
            <div className="font-display text-2xl font-bold text-brown tabular-nums">{String(val).padStart(2, '0')}</div>
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-brown/60">{unit}</div>
          </div>
        ))}
      </div>
      {weddingDate && (
        <p className="border-t border-brown/10 pb-3 pt-2 text-center text-xs text-brown/60">
          Celebrating {weddingDateFormatted} · sharing window closes {dayjs(expiresAt || deadline).format('D MMM YYYY, HH:mm')}
        </p>
      )}
    </div>
  );
}
