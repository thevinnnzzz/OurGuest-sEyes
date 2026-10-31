import { useEffect, useRef, useState } from 'react';
import QRCodePanel from './QRCodePanel.jsx';
import { filterCss } from '../../lib/constants.js';
import { supabase } from '../../lib/supabase.js';
import Modal from '../ui/Modal.jsx';
import HeartProgress from '../ui/HeartProgress.jsx';
import { TrashIcon } from '../feed/icons.jsx';
import { deleteMediaFile } from '../../lib/adminMedia.js';

const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

export default function EventStats({ wedding, stats, onClose, onMediaDeleted }) {
  const [tab, setTab] = useState('overview');
  const [media, setMedia] = useState([]);
  const [guests, setGuests] = useState([]);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [deleteProgress, setDeleteProgress] = useState(0);
  const progressTimer = useRef(null);

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

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const stopProgress = () => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  };

  // Never leave a timer running if the dialog goes away mid-delete.
  useEffect(() => () => stopProgress(), []);

  const confirmDelete = async () => {
    if (!pendingDelete || deletingId) return;
    const target = pendingDelete;
    setDeletingId(target.id);
    setDeleteError(null);

    // One request does the whole delete, so the bar eases toward the end while
    // the server works and snaps to 100% when it answers.
    stopProgress();
    setDeleteProgress(8);
    progressTimer.current = setInterval(() => {
      setDeleteProgress((p) => (p >= 92 ? p : Math.min(92, p + Math.max(1.5, (92 - p) * 0.12))));
    }, 140);

    try {
      await deleteMediaFile(target);
      stopProgress();
      setDeleteProgress(100);
      await new Promise((resolve) => setTimeout(resolve, 550));
      setMedia((rows) => rows.filter((row) => row.id !== target.id));
      setNotice(`Deleted the ${target.type}. It is gone from the guest gallery too.`);
      setPendingDelete(null);
      onMediaDeleted?.();
    } catch (err) {
      stopProgress();
      setDeleteProgress(0);
      setDeleteError(err.message || 'Could not delete this item.');
    } finally {
      setDeletingId(null);
    }
  };

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
          <>
            {notice && (
              <p className="mb-3 rounded-xl bg-green-100 px-3 py-2 text-center text-xs font-medium text-green-800">{notice}</p>
            )}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {media.length === 0 && <p className="col-span-full py-6 text-center text-sm text-brown/60">No media shared yet.</p>}
              {media.map((m) => {
                const guestName = guestNameById[m.guest_id] || 'Guest';
                return (
                  <div key={m.id} className="relative overflow-hidden rounded-xl border border-brown/10 bg-white">
                    {m.type === 'video' ? (
                      <video src={m.url} muted playsInline className="h-24 w-full object-cover" preload="metadata" />
                    ) : (
                      <img
                        src={m.url}
                        alt=""
                        loading="lazy"
                        className="h-24 w-full object-cover"
                        style={{ filter: filterCss(m.filter_name) }}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => { setDeleteError(null); setPendingDelete({ ...m, guestName }); }}
                      disabled={deletingId === m.id}
                      aria-label={`Delete ${m.type} shared by ${guestName}`}
                      className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-brown-dark/60 text-cream backdrop-blur transition hover:bg-rose disabled:opacity-60"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                    <p className="truncate p-1.5 text-[10px] text-brown/60">
                      {guestName} · {m.type}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
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

        <Modal
          open={Boolean(pendingDelete)}
          onClose={() => { if (!deletingId) setPendingDelete(null); }}
          title={pendingDelete?.type === 'video' ? 'Delete this video?' : 'Delete this photo?'}
        >
          {pendingDelete && (
            <div className="relative">
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border border-brown/10 bg-brown-dark/5">
                  {pendingDelete.type === 'video' ? (
                    <video src={pendingDelete.url} controls playsInline className="max-h-56 w-full bg-brown-dark/90 object-contain" />
                  ) : (
                    <img
                      src={pendingDelete.url}
                      alt=""
                      className="max-h-56 w-full object-cover"
                      style={{ filter: filterCss(pendingDelete.filter_name) }}
                    />
                  )}
                </div>
                <p className="text-sm text-brown/75">
                  Shared by <span className="font-semibold text-brown">{pendingDelete.guestName}</span>. Deleting removes it
                  from the guest gallery and from Cloudinary for good, along with its likes and comments. This cannot be undone.
                </p>
                {deleteError && <p className="rounded-xl bg-rose/10 p-3 text-sm text-rose-dark">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="oge-btn-outline flex-1 py-2.5 text-sm"
                    onClick={() => setPendingDelete(null)}
                    disabled={Boolean(deletingId)}
                  >
                    Keep it
                  </button>
                  <button
                    type="button"
                    className="oge-btn flex-1 bg-rose py-2.5 text-sm text-cream hover:bg-rose-dark disabled:opacity-60"
                    onClick={confirmDelete}
                    disabled={Boolean(deletingId)}
                  >
                    {deletingId ? 'Deleting…' : 'Delete for good'}
                  </button>
                </div>
              </div>

              {deletingId && (
                <div
                  role="status"
                  aria-live="polite"
                  aria-busy="true"
                  className="absolute -inset-6 z-20 flex flex-col items-center justify-center gap-4 rounded-3xl bg-cream/95 px-6 text-center backdrop-blur-sm"
                >
                  <HeartProgress value={deleteProgress} />
                  <p className="font-display text-lg font-semibold text-brown">
                    {deleteProgress >= 100 ? 'Deleted' : `Deleting this ${pendingDelete.type}…`}
                  </p>
                  <div className="w-full max-w-[16rem]">
                    <div className="h-2 overflow-hidden rounded-full bg-brown/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose/60 to-rose transition-[width] duration-200 ease-out"
                        style={{ width: `${deleteProgress}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-brown/55">
                      <span>{deleteProgress >= 100 ? 'Removed from Cloudinary' : 'Removing from Cloudinary'}</span>
                      <span className="tabular-nums">{Math.round(deleteProgress)}%</span>
                    </div>
                    <p className="mt-2 text-[11px] text-brown/45">Please keep this window open.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
