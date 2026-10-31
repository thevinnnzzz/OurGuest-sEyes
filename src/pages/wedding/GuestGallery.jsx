import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import JSZip from 'jszip';
import { useEvent } from '../../context/EventContext.jsx';
import { useCountdown } from '../../hooks/useCountdown.js';
import { useEventInteractions } from '../../hooks/useEventInteractions.js';
import { useGuestbook } from '../../hooks/useGuestbook.js';
import { supabase, supabaseReady } from '../../lib/supabase.js';
import FeedGrid from '../../components/wedding/Feed.jsx';
import UploadModal from '../../components/wedding/UploadModal.jsx';
import Modal from '../../components/ui/Modal.jsx';
import HeartLoader from '../../components/ui/HeartLoader.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import InstallApp from '../../components/ui/InstallApp.jsx';
import BottomNav, { TABS } from '../../components/feed/BottomNav.jsx';
import PhotoFeed from '../../components/feed/PhotoFeed.jsx';
import ReelFeed from '../../components/feed/ReelFeed.jsx';
import NotesFeed from '../../components/feed/NotesFeed.jsx';
import Avatar from '../../components/feed/Avatar.jsx';
import { PlusIcon } from '../../components/feed/icons.jsx';

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
  const [tab, setTab] = useState('photos');
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

  const names = wedding ? [wedding.couple_name_1, wedding.couple_name_2].filter(Boolean).join(' & ') : '';
  const photos = useMemo(() => media.filter((item) => item.type === 'photo'), [media]);
  const reels = useMemo(() => media.filter((item) => item.type === 'video'), [media]);

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

    const { data: mediaRows } = await supabase
      .from('media')
      .select('*')
      .eq('wedding_id', weddingRow.id)
      .order('created_at', { ascending: false });

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
  if (loading) return <HeartLoader label="Beauty takes a moment…" />;

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

  const isLive = !countdown.expired;
  const activeTabLabel = TABS.find((entry) => entry.id === tab)?.label || 'Photos';

  const emptyPhotos = (
    <div className="px-4 py-10">
      <EmptyState icon="📷" title="No photos yet" subtitle="Be the first to share a moment from today.">
        <button type="button" className="oge-btn-primary mt-3" onClick={() => setUploadOpen(true)} disabled={!isLive}>
          Snap the first photo
        </button>
      </EmptyState>
    </div>
  );

  const emptyReels = (
    <div className="px-4 py-10">
      <EmptyState icon="🎬" title="No reels yet" subtitle="Hold the shutter in the camera to record a clip of up to 20 seconds.">
        <button type="button" className="oge-btn-primary mt-3" onClick={() => setUploadOpen(true)} disabled={!isLive}>
          Record a reel
        </button>
      </EmptyState>
    </div>
  );

  const emptyNotes = (
    <div className="px-4 py-6">
      <EmptyState icon="✉️" title="No notes yet" subtitle="Your words will be the first keepsake here." />
    </div>
  );

  return (
    <div className="min-h-dvh bg-cream pb-[calc(var(--oge-nav-h)+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-20 flex h-[var(--oge-header-h)] items-center gap-3 border-b border-brown/10 bg-cream/95 px-3 backdrop-blur">
        <Avatar name={names || 'Wedding'} size="md" ring />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[15px] font-semibold text-brown-dark">{names || 'A Celebration'}</p>
          <p className="truncate text-[11px] text-brown/50">
            {isLive
              ? `Closes in ${countdown.days}d ${countdown.hours}h · ${activeTabLabel}`
              : 'Gallery closed · save what you love'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setUploadOpen(true)}
          disabled={!isLive}
          aria-label="Share a moment"
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-brown/20 bg-white text-brown transition hover:border-gold hover:text-gold disabled:opacity-40"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </header>

      {!isLive ? (
        <div className="mx-4 mt-6 rounded-2xl bg-brown/90 p-8 text-center text-cream">
          <p className="font-display text-xl font-semibold">The gallery has closed</p>
          <p className="mt-2 text-sm text-cream/80">All media was removed after the 3-day window. The couple now holds every keepsake.</p>
        </div>
      ) : (
        <>
          {tab === 'photos' && (
            <PhotoFeed
              photos={photos}
              guestNameById={guestNameById}
              likes={interactions.likes}
              comments={interactions.comments}
              session={session}
              onToggleLike={interactions.toggleLike}
              onAddComment={interactions.addComment}
              onDownload={(item) => downloadUrl(item.url, item.url.split('/').pop())}
              emptyState={emptyPhotos}
            />
          )}

          {tab === 'reels' && (
            <ReelFeed
              reels={reels}
              guestNameById={guestNameById}
              likes={interactions.likes}
              comments={interactions.comments}
              session={session}
              onToggleLike={interactions.toggleLike}
              onAddComment={interactions.addComment}
              onDownload={(item) => downloadUrl(item.url, item.url.split('/').pop())}
              emptyState={emptyReels}
            />
          )}

          {tab === 'notes' && (
            <NotesFeed
              messages={book.messages}
              loading={book.loading}
              canWrite={isLive && Boolean(session)}
              onSubmit={book.addMessage}
              session={session}
              emptyState={emptyNotes}
            />
          )}

          {tab === 'gallery' && (
            <div className="mx-auto max-w-5xl space-y-4 px-3 py-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.2em] text-brown/45">
                  {media.length} moment{media.length === 1 ? '' : 's'}
                </p>
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={media.length === 0}
                  className="rounded-full border border-brown/20 px-3 py-1.5 text-xs text-brown/80 transition hover:border-gold hover:text-brown disabled:opacity-40"
                >
                  Save all
                </button>
              </div>
              <FeedGrid
                media={media}
                guestNameById={guestNameById}
                likes={interactions.likes}
                comments={interactions.comments}
                session={session}
                onToggleLike={interactions.toggleLike}
                onAddComment={interactions.addComment}
                onDownload={(item) => downloadUrl(item.url, item.url.split('/').pop())}
              />
            </div>
          )}
        </>
      )}

      <BottomNav active={tab} onChange={setTab} onUpload={() => setUploadOpen(true)} uploadDisabled={!isLive} />

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

      <InstallApp raised />
    </div>
  );
}
