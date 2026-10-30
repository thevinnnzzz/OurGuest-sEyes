import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import JSZip from 'jszip';
import { useEvent } from '../../context/EventContext.jsx';
import { useCountdown } from '../../hooks/useCountdown.js';
import { useEventInteractions } from '../../hooks/useEventInteractions.js';
import { useGuestbook } from '../../hooks/useGuestbook.js';
import { supabase, supabaseReady } from '../../lib/supabase.js';
import Hero from '../../components/wedding/Hero.jsx';
import CountdownBanner from '../../components/ui/CountdownBanner.jsx';
import FeedGrid from '../../components/wedding/Feed.jsx';
import Guestbook from '../../components/wedding/Guestbook.jsx';
import UploadModal from '../../components/wedding/UploadModal.jsx';
import Modal from '../../components/ui/Modal.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import InstallApp from '../../components/ui/InstallApp.jsx';

async function downloadUrl(url, filename) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}

export default function GuestGallery() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { session, checkExistingSession } = useEvent();
  const [wedding, setWedding] = useState(null);
  const [guests, setGuests] = useState([]);
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notLive, setNotLive] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [saveAllOpen, setSaveAllOpen] = useState(false);
  const [zipProgress, setZipProgress] = useState(null);
  const [remaining, setRemaining] = useState({ photos: 0, videos: 0 });
  const bootedRef = useRef(false);

  const deadlineRef = useMemo(
    () => (wedding ? wedding.expires_at || `${wedding.wedding_date}T23:59:59` : null),
    [wedding],
  );
  const countdown = useCountdown(deadlineRef);
  const interactions = useEventInteractions(wedding?.id, session);
  const book = useGuestbook(wedding?.id);

  const guestNameById = useMemo(
    () => Object.fromEntries(guests.map((g) => [g.id, g.full_name])),
    [guests],
  );

  // Boot: resolve session for this slug, then load everything
  const boot = useCallback(async () => {
    if (!supabaseReady || bootedRef.current) return;
    bootedRef.current = true;
    const sessionData = await checkExistingSession(slug);
    if (!sessionData) {
      navigate(`/w/${encodeURIComponent(slug)}/register`, { replace: true });
      return;
    }
    const [{ data: weddingRow }, { data: guestRows }] = await Promise.all([
      supabase.from('weddings').select('*').eq('slug', slug).maybeSingle(),
      supabase.from('guests').select('id, wedding_id, full_name').eq('wedding_id', sessionData.weddingId),
    ]);

    if (!weddingRow || new Date(weddingRow.expires_at) <= new Date()) {
      setNotLive(true);
      setLoading(false);
      return;
    }
    setWedding(weddingRow);
    setGuests(guestRows || []);

    const [{ data: mediaRows }] = await Promise.all([
      supabase
        .from('media')
        .select('*')
        .eq('wedding_id', weddingRow.id)
        .order('created_at', { ascending: false }),
    ]);
    setMedia(mediaRows || []);
    computeRemaining(weddingRow, mediaRows || [], sessionData);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    boot();
  }, [boot]);

  useEffect(() => {
    if (!wedding?.id) return undefined;
    const channel = supabase
      .channel(`media-${wedding.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'media', filter: `wedding_id=eq.${wedding.id}` },
        async () => {
          const { data } = await supabase
            .from('media')
            .select('*')
            .eq('wedding_id', wedding.id)
            .order('created_at', { ascending: false });
          setMedia(data || []);
        },
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [wedding?.id]);

  const computeRemaining = (weddingRow, mediaRows, sessionData) => {
    if (!sessionData) return;
    const own = mediaRows.filter((m) => m.guest_id === sessionData.guestId);
    setRemaining({
      photos: Math.max(0, (weddingRow?.max_photos_per_guest ?? 10) - own.filter((m) => m.type === 'photo').length),
      videos: Math.max(0, (weddingRow?.max_videos_per_guest ?? 5) - own.filter((m) => m.type === 'video').length),
    });
  };

  const onUploaded = async () => {
    const { data } = await supabase
      .from('media')
      .select('*')
      .eq('wedding_id', wedding.id)
      .order('created_at', { ascending: false });
    setMedia(data || []);
    computeRemaining(wedding, data || [], session);
  };

  const saveAll = async () => {
    setSaveAllOpen(true);
    const zip = new JSZip();
    for (let i = 0; i < media.length; i++) {
      setZipProgress({ done: i, total: media.length, label: media[i].url.split('/').pop() });
      try {
        const blob = await (await fetch(media[i].url)).blob();
        const ext = media[i].type === 'video' ? 'mp4' : 'jpg';
        zip.file(`${String(i + 1).padStart(3, '0')}-by-${(guestNameById[media[i].guest_id] || 'guest').replace(/\s+/g, '-')}.${ext}`, blob);
      } catch {
        /* skip */
      }
    }
    setZipProgress({ done: media.length, total: media.length, label: 'Sealing the album…' });
    const out = await zip.generateAsync({ type: 'blob' }, (meta) =>
      setZipProgress({ done: Math.round(meta.percent / 2), total: media.length, label: 'Compressing…' }),
    );
    const url = URL.createObjectURL(out);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-through-our-guests-eyes.zip`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    setZipProgress(null);
    setSaveAllOpen(false);
  };

  if (!supabaseReady) {
    return <div className="p-10 text-center text-sm text-brown/70">Gallery is being configured.</div>;
  }
  if (loading) return <Spinner label="Beauty takes a moment…" />;

  if (notLive) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
        <p className="font-script text-5xl text-rose">The flowers have been pressed</p>
        <p className="mt-4 max-w-sm text-brown/70">
          This gallery has closed and its media removed — that happens 3 days after every wedding. We hope you saved what you loved.
        </p>
        <Link to="/" className="oge-btn-outline mt-8">← Back home</Link>
      </div>
    );
  }

  const names = [wedding.couple_name_1, wedding.couple_name_2].filter(Boolean).join(' & ');
  const isLive = !countdown.expired;

  return (
    <div className="min-h-dvh bg-cream pb-32">
      <Hero wedding={wedding} couplesSince={media.length} />

      <div className="mx-auto max-w-3xl space-y-8 px-4">
        <CountdownBanner weddingDate={wedding.wedding_date} expiresAt={wedding.expires_at} />

        {isLive ? (
          <>
            <nav className="flex flex-wrap justify-center gap-2">
              <button type="button" className="oge-btn-primary" onClick={() => setUploadOpen(true)}>
                📷 Share a moment
              </button>
              <a href="#guestbook" className="oge-btn-outline">✉️ Write a letter</a>
              <button type="button" className="oge-btn-gold" onClick={saveAll} disabled={media.length === 0}>
                ⬇ Save all ({media.length})
              </button>
            </nav>

            {session && (
              <p className="text-center text-xs tracking-wide text-brown/60">
                Sharing as <strong className="text-brown">{session.fullName}</strong> ·{' '}
                {remaining.photos} photo{remaining.photos === 1 ? '' : 's'} & {remaining.videos} video{remaining.videos === 1 ? '' : 's'} left
              </p>
            )}

            <section className="pt-2">
              <FeedGrid
                media={media}
                guestNameById={guestNameById}
                likes={interactions.likes}
                comments={interactions.comments}
                session={session}
                onToggleLike={interactions.toggleLike}
                onAddComment={interactions.addComment}
                onDownload={(m) => downloadUrl(m.url, m.url.split('/').pop())}
              />
            </section>

            <Guestbook messages={book.messages} loading={book.loading} canWrite={isLive && Boolean(session)} onSubmit={book.addMessage} />

            <CountdownBanner weddingDate={wedding.wedding_date} expiresAt={wedding.expires_at} variant="inline" />
          </>
        ) : (
          <div className="rounded-2xl bg-brown/90 p-8 text-center text-cream">
            <p className="font-display text-xl font-semibold">The gallery has closed</p>
            <p className="mt-2 text-sm text-cream/80">
              All media was removed after the 3-day window. The couple now holds every keepsake.
            </p>
          </div>
        )}
      </div>

      {isLive && session && (
        <UploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          wedding={wedding}
          remaining={remaining}
          session={session}
          onUploaded={onUploaded}
        />
      )}

      <Modal open={saveAllOpen} onClose={() => !zipProgress && setSaveAllOpen(false)} title="Sealing your keepsake…">
        <p className="mb-4 text-sm text-brown/70">Gathering {media.length} files from every guest into one pocket album.</p>
        <div className="h-3 overflow-hidden rounded-full bg-beige">
          <div
            className="h-full bg-gold transition-all"
            style={{ width: `${zipProgress && media.length ? (zipProgress.done / media.length) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-center text-xs text-brown/60">{zipProgress?.label}</p>
      </Modal>

      <p className="mt-16 text-center text-[11px] tracking-[0.2em] text-brown/40">
        seen through <span className="font-script text-base text-rose/70">Our Guests' Eyes</span>
      </p>

      <InstallApp />
    </div>
  );
}
