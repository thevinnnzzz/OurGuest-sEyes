import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvent } from '../../context/EventContext.jsx';
import { readStoredSession } from '../../lib/guestSession.js';

/** Accepts "sarah-john-wedding", "/w/sarah-john-wedding", or a full QR URL. */
function normaliseSlug(value) {
  return String(value || '')
    .trim()
    .replace(/^https?:\/\/[^/]+\/?/i, '')
    .replace(/^#\/?/, '')
    .replace(/^w\//i, '')
    .replace(/^\/+|\/+$/g, '')
    .split(/[?#]/)[0];
}

/**
 * Root-page guest entry. A guest who opens ourguestseyes.netlify.app with no
 * session should be able to get back to their wedding — never into the owner
 * dashboard — so this card is the primary action on the marketing page.
 */
export default function EventLookup() {
  const navigate = useNavigate();
  const { lastEvent } = useEvent();
  const [value, setValue] = useState('');
  const [stored, setStored] = useState(null);
  const [error, setError] = useState(null);

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

  const submit = (event) => {
    event.preventDefault();
    const slug = normaliseSlug(value);
    if (!slug) {
      setError('Enter the event name from your invitation, or scan the QR code on your table.');
      return;
    }
    setError(null);
    navigate(`/w/${encodeURIComponent(slug)}`);
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
            or another event
            <span className="h-px flex-1 bg-brown/15" />
          </div>
        </>
      ) : (
        <>
          <p className="text-center font-script text-3xl text-rose">Find your gallery</p>
          <p className="mt-1 text-center text-xs leading-relaxed text-brown/55">
            Scan the QR code on your table — or type the event name from your invitation.
          </p>
        </>
      )}

      <form onSubmit={submit} className="mt-3 space-y-3">
        <label className="sr-only" htmlFor="event-slug">Event name</label>
        <input
          id="event-slug"
          className="oge-input text-center"
          placeholder="sarah-john-wedding"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(null);
          }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {error && <p className="text-xs leading-relaxed text-rose-dark">{error}</p>}
        <button type="submit" className="oge-btn-outline w-full">Open my gallery</button>
      </form>
    </div>
  );
}
