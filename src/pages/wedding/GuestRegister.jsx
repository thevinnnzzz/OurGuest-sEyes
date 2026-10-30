import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEvent } from '../../context/EventContext.jsx';
import { supabaseReady } from '../../lib/supabase.js';
import InstallApp from '../../components/ui/InstallApp.jsx';

export default function GuestRegister() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { registerGuest } = useEvent();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await registerGuest(slug.trim(), name);
      navigate(`/w/${encodeURIComponent(slug.trim())}`);
    } catch (err) {
      setError(err.message || 'Could not check you in — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-5 text-center">
      <div aria-hidden className="pointer-events-none absolute left-6 top-8 text-2xl text-rose/40 sm:left-16">❦</div>
      <p className="text-[11px] uppercase tracking-[0.35em] text-brown/60">Our Guests' Eyes</p>
      <h1 className="mt-3 font-script text-5xl text-rose">You're on the guest list!</h1>

      <form onSubmit={submit} className="oge-card mt-8 w-full max-w-sm space-y-4 p-6">
        {/* tiny wedding preview; fetched realtime within registerGuest submit */}
        <div>
          <label className="oge-label" htmlFor="fullName">Your full name</label>
          <input
            id="fullName"
            className="oge-input text-center"
            placeholder="e.g. Kate Alvarez"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={80}
          />
          <p className="mt-2 text-xs text-brown/55">
            We use names to keep every memory personal — no two guests can share the same one.
          </p>
        </div>
        {error && <p className="rounded-xl bg-rose/10 p-3 text-sm text-rose-dark">{error}</p>}
        <button type="submit" className="oge-btn-primary w-full" disabled={busy || !supabaseReady}>
          {busy ? 'Checking the guest book…' : 'Step inside'}
        </button>
      </form>

      <p className="mt-6 max-w-xs text-xs leading-relaxed text-brown/50">
        Photos & videos will expire as a gallery 3 days after the wedding. Save what you treasure.
      </p>
      <Link to="/" className="mt-4 text-xs text-brown/40 hover:text-brown">← not a guest?</Link>

      <InstallApp />
    </div>
  );
}
