import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, supabaseReady } from '../../lib/supabase.js';
import WeddingCard from '../../components/admin/WeddingCard.jsx';
import WeddingForm from '../../components/admin/WeddingForm.jsx';
import EventStats from '../../components/admin/EventStats.jsx';
import QRCodePanel from '../../components/admin/QRCodePanel.jsx';
import Spinner from '../../components/ui/Spinner.jsx';

const appUrl = import.meta.env.VITE_APP_URL || window.location.origin;

export default function Dashboard() {
  const navigate = useNavigate();
  const [weddings, setWeddings] = useState(null);
  const [statsByWedding, setStats] = useState({});
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [qrWedding, setQrWedding] = useState(null);
  const [viewWedding, setViewWedding] = useState(null);

  useEffect(() => {
    let sub;
    const init = async () => {
      if (!supabaseReady) return setWeddings([]);
      const { data: auth } = await supabase.auth.getUser();
      if (!auth?.user) {
        navigate('/admin/login');
        return;
      }
      await load();
      sub = supabase
        .channel('dashboard-weddings')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'weddings' }, load)
        .subscribe();
    };
    init();
    return () => sub && supabase.removeChannel(sub);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  if (!supabaseReady) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center text-sm text-brown/70">
        Configure .env (Supabase + Cloudinary keys) to bring the dashboard to life.
      </div>
    );
  }
  if (!weddings) return <Spinner label="Opening your events…" />;

  return (
    <div className="min-h-dvh bg-cream">
      <nav className="sticky top-0 z-30 border-b border-brown/10 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-lg font-semibold leading-tight text-brown">Our Guests' Eyes</p>
            <p className="text-[10px] uppercase tracking-[0.24em] text-brown/50">owner's dashboard</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="oge-btn-primary px-4 py-2 text-xs"
              onClick={() => { setEditing(null); setFormOpen(true); }}
            >
              + New wedding
            </button>
            <button type="button" className="oge-btn-outline px-3 py-2 text-xs" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto grid max-w-6xl gap-4 px-4 py-6 sm:grid-cols-2 lg:grid-cols-3">
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
        />
      )}

      <WeddingForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        wedding={editing}
        onSaved={load}
      />
    </div>
  );
}
