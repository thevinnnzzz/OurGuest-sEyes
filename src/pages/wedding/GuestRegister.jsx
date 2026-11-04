import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEvent } from '../../context/EventContext.jsx';
import { readLastEvent, readStoredSession } from '../../lib/guestSession.js';
import { supabaseReady } from '../../lib/supabase.js';
import InstallApp from '../../components/ui/InstallApp.jsx';

const PASSCODE_RE = /^[A-Za-z0-9]{4,12}$/;

export default function GuestRegister() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { loginGuest, lastEvent } = useEvent();
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [returning, setReturning] = useState(null);

  // A device that has been here before is nudged, never forced: the token may
  // already be gone but the event name is still worth offering back.
  useEffect(() => {
    let alive = true;
    (async () => {
      const [stored, remembered] = await Promise.all([readStoredSession(), readLastEvent()]);
      if (!alive) return;
      if (stored?.slug && stored.slug !== slug) setReturning({ slug: stored.slug, fullName: stored.fullName });
      else if (!stored && remembered && remembered !== slug) setReturning({ slug: remembered, fullName: null });
    })();
    return () => {
      alive = false;
    };
  }, [slug]);

  const passcodeOk = PASSCODE_RE.test(passcode.trim());
  const canSubmit = name.trim().length >= 2 && passcodeOk && !busy && supabaseReady;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await loginGuest(slug, name, passcode);
      navigate(`/w/${encodeURIComponent(String(slug).trim())}`, { replace: true });
    } catch (err) {
      setError(err.message || 'Could not check you in — try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="oge-page-in flex min-h-dvh flex-col items-center justify-center bg-cream px-5 py-10 text-center">
      <div aria-hidden className="pointer-events-none absolute left-6 top-8 text-2xl text-rose/40 sm:left-16">❦</div>
      <p className="text-[11px] uppercase tracking-[0.35em] text-brown/60">Our Guests' Eyes</p>
      <h1 className="mt-3 font-script text-5xl leading-tight text-rose">You're on the guest list</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-brown/60">
        {lastEvent === slug
          ? 'Welcome back — your name and passcode open your album again.'
          : 'Two little things, and the day is yours to keep.'}
      </p>

      <form onSubmit={submit} className="oge-card mt-7 w-full max-w-sm space-y-4 p-6 text-left">
        <div>
          <label className="oge-label" htmlFor="fullName">Your full name</label>
          <input
            id="fullName"
            className="oge-input text-center"
            placeholder="e.g. Kate Alvarez"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            autoComplete="name"
            autoFocus
          />
        </div>

        <div>
          <label className="oge-label" htmlFor="passcode">Your passcode</label>
          <input
            id="passcode"
            className="oge-input text-center tracking-[0.4em]"
            placeholder="••••"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value.replace(/\s/g, ''))}
            required
            minLength={4}
            maxLength={12}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="passcode-hint"
          />
          <p id="passcode-hint" className="mt-2 text-xs leading-relaxed text-brown/55">
            4–12 letters or numbers. First visit? Choose one you'll remember — the same pair brings your
            photos, notes and album back on any device.
          </p>
        </div>

        {error && (
          <p role="alert" className="rounded-xl bg-rose/10 p-3 text-sm leading-relaxed text-rose-dark">
            {error}
          </p>
        )}

        <button type="submit" className="oge-btn-primary w-full" disabled={!canSubmit}>
          {busy ? 'Checking the guest book…' : 'Step inside'}
        </button>

        <p className="text-center text-[11px] leading-relaxed text-brown/45">
          Already checked in? The same name and passcode return you to your own album.
        </p>
      </form>

      {returning && (
        <div className="mt-5 w-full max-w-sm rounded-2xl border border-brown/15 bg-beige/50 px-4 py-3 text-left">
          <p className="text-[11px] uppercase tracking-[0.18em] text-brown/50">This device last visited</p>
          <Link to={`/w/${encodeURIComponent(returning.slug)}`} className="mt-1 block text-sm text-brown hover:text-rose">
            {returning.fullName ? `${returning.fullName} · ` : ''}{returning.slug} →
          </Link>
        </div>
      )}

      <p className="mt-6 max-w-xs text-xs leading-relaxed text-brown/50">
        Photos & videos close as a gallery 3 days after the wedding. Save what you treasure.
      </p>
      <Link to="/" className="mt-3 text-xs text-brown/40 hover:text-brown">← not a guest?</Link>

      <InstallApp />
    </div>
  );
}
