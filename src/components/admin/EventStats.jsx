import { useEffect, useState } from 'react';
import QRCodePanel from './QRCodePanel.jsx';
import { filterCss } from '../../lib/constants.js';
import { supabase } from '../../lib/supabase.js';

const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

export default function EventStats({ wedding, stats, onClose }) {
  const [tab, setTab] = useState('overview');
  const [media, setMedia] = useState([]);
  const [guests, setGuests] = useState([]);

  useEffect(() => {
    if (tab !== 'media' || !wedding?.id) return;
    (async () => {
      const [{ data: mediaRows }, { data: guestRows }] = await Promise.all([
        supabase.from('media').select('*').eq('wedding_id', wedding.id).order('created_at', { ascending: false }),
        supabase.from('guests').select('*').eq('wedding_id', wedding.id).order('created_at'),
      ]);
      setMedia(mediaRows || []);
      setGuests(guestRows || []);
    })();
  }, [tab, wedding?.id]);

  if (!wedding) return null;
  const names = [wedding.couple_name_1, wedding.couple_name_2].filter(Boolean).join(' & ');
  const guestNameById = Object.fromEntries(guests.map((g) => [g.id, g.full_name]));

  return (
    <div className="fixed inset-0 z-40 flex justify-center bg-brown-dark/40 p-4 backdrop-blur-sm sm:items-center">
      <div className="oge-fade-in relative max-h-[90dvh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-cream p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-display text-2xl font-semibold text-brown">{names}</h2>
            <p className="text-xs text-brown/60">
              {names} · expires in {wedding.expires_at ? Math.max(0, Math.ceil((new Date(wedding.expires_at) - new Date()) / 86400000)) : '—'} days
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-brown/20 px-3 py-1 text-lg leading-none text-brown/70 hover:bg-beige" aria-label="Close">×</button>
        </div>

        <div className="mb-5 flex gap-2">
          {['overview', 'media', 'guests'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] transition ${
                tab === t ? 'bg-brown text-cream' : 'bg-white/70 text-brown/70 hover:bg-beige'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="grid gap-4 sm:grid-cols-2">
            <dl className="grid grid-cols-2 gap-3">
              {[
                ['Registered guests', stats?.guests ?? '—'],
                ['Media shared', stats?.media ?? '—'],
                ['Likes', stats?.likes ?? '—'],
                ['Letters', stats?.messages ?? '—'],
              ].map(([k, v]) => (
                <div key={k} className="oge-card p-4 text-center">
                  <dd className="font-display text-2xl font-bold text-brown">{v}</dd>
                  <dt className="mt-1 text-[10px] uppercase tracking-[0.14em] text-brown/55">{k}</dt>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="oge-label">QR & link</h3>
              <QRCodePanel wedding={{ ...wedding, slug: wedding.slug }} appUrl={appUrl} />
            </div>
          </div>
        )}

        {tab === 'media' && (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {media.length === 0 && <p className="col-span-full py-6 text-center text-sm text-brown/60">No media shared yet.</p>}
            {media.map((m) => (
              <div key={m.id} className="overflow-hidden rounded-xl border border-brown/10 bg-white">
                {m.type === 'video' ? (
                  <video src={m.url} muted className="h-24 w-full object-cover" preload="metadata" />
                ) : (
                  <img
                    src={m.url}
                    alt=""
                    loading="lazy"
                    className="h-24 w-full object-cover"
                    style={{ filter: filterCss(m.filter_name) }}
                  />
                )}
                <p className="truncate p-1.5 text-[10px] text-brown/60">
                  {guestNameById[m.guest_id] || 'Guest'} · {m.type}
                </p>
              </div>
            ))}
          </div>
        )}

        {tab === 'guests' && (
          <ul className="divide-y divide-brown/10">
            {guests.length === 0 && <li className="py-6 text-center text-sm text-brown/60">No guests registered yet.</li>}
            {guests.map((g) => (
              <li key={g.id} className="flex items-center justify-between py-2">
                <span className="font-body text-base">{g.full_name}</span>
                <span className="text-xs text-brown/50">
                  {media.filter((m) => m.guest_id === g.id).length} shared
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
