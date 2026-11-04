import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { supabase, supabaseReady } from '../../lib/supabase.js';
import WeddingCard from '../../components/admin/WeddingCard.jsx';
import WeddingForm from '../../components/admin/WeddingForm.jsx';
import EventStats from '../../components/admin/EventStats.jsx';
import QRCodePanel from '../../components/admin/QRCodePanel.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import Avatar from '../../components/feed/Avatar.jsx';
import { LogoutIcon, PlusIcon } from '../../components/feed/icons.jsx';
import Modal from '../../components/ui/Modal.jsx';
import { deleteEvent } from '../../lib/adminEvents.js';

const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

const coupleNames = (wedding) =>
  [wedding?.couple_name_1, wedding?.couple_name_2].filter(Boolean).join(' & ');

export default function Dashboard() {
  const navigate = useNavigate();
  const [weddings, setWeddings] = useState(null);
  const [statsByWedding, setStats] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qrWedding, setQrWedding] = useState(null);
  const [viewWedding, setViewWedding] = useState(null);
  const [accountEmail, setAccountEmail] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deletingEvent, setDeletingEvent] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [notice, setNotice] = useState(null);
  const menuRef = useRef(null);

  useEffect(() => {
    let sub;
    let cancelled = false;
    const init = async () => {
      if (!supabaseReady) return setWeddings([]);
      const { data: auth } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!auth?.user) {
        navigate('/admin/login');
        return;
      }
      setAccountEmail(auth.user.email || 'Owner');
      await load();
      // React re-runs this effect during development, so a shared channel name
      // would hand back an already-subscribed channel and throw on .on().
      if (cancelled) return;
      sub = supabase
        .channel(`dashboard-weddings-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'weddings' }, load)
        .subscribe();
    };
    init();
    return () => {
      cancelled = true;
      if (sub) supabase.removeChannel(sub);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close the account menu on outside tap or Escape, like a native sheet.
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

  const load = async () => {
    const [weddingsRes, guestsRes, mediaRes, likesRes, messagesRes] = await Promise.all([
      supabase.from('weddings').select('*').order('wedding_date', { ascending: false }),
      supabase.from('guests').select('id, wedding_id'),
      supabase.from('media').select('id, wedding_id'),
      supabase.from('likes').select('id, wedding_id'),
      supabase.from('messages').select('id, wedding_id'),
    ]);
    const rows = weddingsRes.data || [];
    setWeddings(rows);
    const next = {};
    rows.forEach((r) => {
      next[r.id] = {
        guests: guestsRes.data.filter((x) => x.wedding_id === r.id).length,
        media: mediaRes.data.filter((x) => x.wedding_id === r.id).length,
        likes: likesRes.data.filter((x) => x.wedding_id === r.id).length,
        messages: messagesRes.data.filter((x) => x.wedding_id === r.id).length,
      };
    });
    setStats(next);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login');
  };

  // The card vanishes on success, so say out loud that it is gone for good.
  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const closeDelete = () => {
    if (deletingEvent) return;
    setPendingDelete(null);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deletingEvent) return;
    const target = pendingDelete;
    setDeletingEvent(true);
    setDeleteError(null);
    try {
      const result = await deleteEvent(target);
      setWeddings((rows) => (rows || []).filter((row) => row.id !== target.id));
      setStats((current) => {
        const next = { ...current };
        delete next[target.id];
        return next;
      });
      setViewWedding((current) => (current?.id === target.id ? null : current));
      setQrWedding((current) => (current?.id === target.id ? null : current));
      setPendingDelete(null);
      const files = result?.mediaDeleted || 0;
      setNotice(
        `${coupleNames(target) || 'The event'} was deleted along with ${files} photo/video file${files === 1 ? '' : 's'} ` +
          'and every guest list, like and letter.',
      );
    } catch (err) {
      setDeleteError(err.message || 'Could not delete this event.');
    } finally {
      setDeletingEvent(false);
    }
  };

  if (!supabaseReady) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-brown/70">
        Configure .env (Supabase + Cloudinary keys) to bring the dashboard to life.
      </div>
    );
  }
  if (!weddings) return <Spinner label="Opening your events…" />;

  return (
    <div className="oge-page-in min-h-dvh bg-cream">
      <nav className="sticky top-0 z-30 border-b border-brown/10 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-brown">Our Guests' Eyes</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-brown/50">owner's dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="oge-btn-primary flex items-center gap-1.5 px-3 py-2 text-xs sm:px-4"
              onClick={() => { setEditing(null); setFormOpen(true); }}
            >
              <PlusIcon className="h-4 w-4" />
              <span className="hidden sm:inline">New wedding</span>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((value) => !value)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-label="Account menu"
                className="flex items-center rounded-full border border-brown/15 bg-white p-0.5 transition hover:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60"
              >
                <Avatar name={accountEmail || 'Owner'} size="md" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="oge-fade-in absolute right-0 top-[calc(100%+0.5rem)] z-40 w-60 overflow-hidden rounded-2xl border border-brown/10 bg-cream shadow-soft"
                >
                  <div className="border-b border-brown/10 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.22em] text-brown/45">signed in as</p>
                    <p className="mt-1 truncate text-sm font-medium text-brown">{accountEmail || 'Owner'}</p>
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={logout}
                    className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-brown transition hover:bg-beige"
                  >
                    <LogoutIcon className="h-4 w-4 text-brown/70" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
        {notice && (
          <p
            role="status"
            className="col-span-full rounded-xl border border-green-300 bg-green-50 px-4 py-2.5 text-sm text-green-800"
          >
            {notice}
          </p>
        )}
        {weddings.length === 0 && (
          <div className="col-span-full rounded-2xl border border-dashed border-brown/25 bg-white/50 px-6 py-16 text-center">
            <p className="text-4xl" aria-hidden>💒</p>
            <h2 className="mt-3 font-display text-xl font-semibold text-brown">No weddings yet</h2>
            <p className="mt-1 text-sm text-brown/60">Create your first event to generate its QR code and guest gallery.</p>
            <button type="button" className="oge-btn-primary mt-5" onClick={() => setFormOpen(true)}>
              Create a wedding
            </button>
          </div>
        )}
        {weddings.map((w) => (
          <WeddingCard
            key={w.id}
            wedding={w}
            stats={statsByWedding[w.id]}
            onConfigure={() => { setEditing(w); setFormOpen(true); }}
            onQr={() => setQrWedding(w)}
            onView={() => setViewWedding(w)}
            onDelete={() => { setDeleteError(null); setPendingDelete(w); }}
          />
        ))}
      </main>

      {qrWedding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brown-dark/50 p-4 backdrop-blur-sm"
          onClick={() => setQrWedding(null)}
        >
          <div className="oge-card oge-fade-in w-full max-w-xs bg-cream p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 text-center font-display text-lg font-semibold text-brown">
              Guest QR code
            </h3>
            <QRCodePanel wedding={qrWedding} appUrl={appUrl} />
            <button type="button" className="mt-4 w-full oge-btn-outline" onClick={() => setQrWedding(null)}>
              Close
            </button>
          </div>
        </div>
      )}

      {viewWedding && (
        <EventStats
          wedding={viewWedding}
          stats={statsByWedding[viewWedding.id]}
          onClose={() => setViewWedding(null)}
          onMediaDeleted={load}
        />
      )}

      <WeddingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wedding={editing}
        onSaved={load}
      />

      <Modal
        open={Boolean(pendingDelete)}
        onClose={closeDelete}
        title="Delete this event?"
      >
        {pendingDelete && (
          <div className="space-y-4">
            <div className="rounded-xl border border-brown/10 bg-white/70 p-4">
              <p className="font-display text-base font-semibold text-brown">
                {coupleNames(pendingDelete) || 'This event'}
              </p>
              <p className="text-xs text-brown/60">
                {pendingDelete.wedding_date ? dayjs(pendingDelete.wedding_date).format('dddd, D MMM YYYY') : ''}
              </p>
              <p className="mt-2 text-xs text-brown/60">
                {statsByWedding[pendingDelete.id]?.guests ?? 0} guests ·{' '}
                {statsByWedding[pendingDelete.id]?.media ?? 0} photos &amp; videos ·{' '}
                {statsByWedding[pendingDelete.id]?.messages ?? 0} letters
              </p>
            </div>

            <p className="text-sm leading-relaxed text-brown/75">
              The gallery, its QR code and every photo, video, like and guestbook letter are removed from
              storage. Guests who scanned the QR code will see “not found”. This cannot be undone.
            </p>

            {deleteError && (
              <p className="rounded-xl bg-rose/10 p-3 text-sm text-rose-dark">{deleteError}</p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                type="button"
                className="oge-btn-outline flex-1"
                onClick={closeDelete}
                disabled={deletingEvent}
              >
                Keep it
              </button>
              <button
                type="button"
                className="oge-btn flex-1 bg-rose py-2.5 text-sm text-cream hover:bg-rose-dark disabled:opacity-60"
                onClick={confirmDelete}
                disabled={deletingEvent}
              >
                {deletingEvent ? 'Deleting…' : 'Delete event for good'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
