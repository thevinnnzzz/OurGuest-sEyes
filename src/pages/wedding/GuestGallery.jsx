import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useEvent } from '../../context/EventContext.jsx';
import { useCountdown } from '../../hooks/useCountdown.js';
import { useEventInteractions } from '../../hooks/useEventInteractions.js';
import { useGuestbook } from '../../hooks/useGuestbook.js';
import { supabase, supabaseReady } from '../../lib/supabase.js';
import GuestAlbums from '../../components/wedding/GuestAlbums.jsx';
import UploadModal from '../../components/wedding/UploadModal.jsx';
import HeartLoader from '../../components/ui/HeartLoader.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import InstallApp from '../../components/ui/InstallApp.jsx';
import BottomNav, { DEFAULT_TAB, TABS } from '../../components/feed/BottomNav.jsx';
import MediaFeed from '../../components/feed/MediaFeed.jsx';
import NotesFeed from '../../components/feed/NotesFeed.jsx';
import GalleryHeader from '../../components/wedding/GalleryHeader.jsx';
import DownloadModal from '../../components/wedding/DownloadModal.jsx';
import { hasGuestPosted } from '../../lib/posting.js';
import { buildGalleryZip, saveBlob } from '../../lib/downloads.js';

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
  const [saveProgress, setSaveProgress] = useState(null);
  const [saveResult, setSaveResult] = useState(null);
  const [remaining, setRemaining] = useState({ photos: 0, videos: 0 });
  const [tab, setTab] = useState(DEFAULT_TAB);
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

  const openSaveAll = () => {
    setSaveResult(null);
    setSaveProgress(null);
    setSaveAllOpen(true);
  };

  const runDownload = async (filter) => {
    setSaveResult(null);
    setSaveProgress({ done: 0, total: 0, label: 'Packing…' });
    try {
      const archive = await buildGalleryZip({
        media,
        notes: book.messages,
        filter,
        guestNameById,
        zipName: `${slug}-through-our-guests-eyes.zip`,
        onProgress: setSaveProgress,
      });
      const saved = saveBlob(archive.blob, archive.name);
      setSaveResult({
        total: archive.total,
        included: archive.included,
        failures: archive.failures.length,
        fileName: saved.fileName,
      });
    } catch (error) {
      setSaveResult({ error: error.message || 'Could not build the archive.' });
    } finally {
      setSaveProgress(null);
    }
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
  const activeTabLabel = TABS.find((entry) => entry.id === tab)?.label || 'Gallery';

  // The (+) stays in the corner for the whole gallery: a guest can keep adding
  // moments until their allowance is used up. The sheet itself enforces the
  // per-guest photo/video limits, so opening it late just explains what is left.
  const hasPosted = hasGuestPosted({ media, notes: book.messages, guestId: session?.guestId });
  const limitsLeft = Math.max(0, remaining.photos) + Math.max(0, remaining.videos);
  const shareLabel = limitsLeft > 0
    ? `Add moments — ${remaining.photos} photo${remaining.photos === 1 ? '' : 's'} and ${remaining.videos} video${remaining.videos === 1 ? '' : 's'} left`
    : 'Your photo and video limit is used up';

  // A new tab always opens at the top of its own content.
  const changeTab = (next) => {
    if (next === tab) return;
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  const emptyPhotos = (
    <div className="px-4 py-10">
      <EmptyState
        icon="📷"
        title="No moments yet"
        subtitle={
          hasPosted
            ? 'You have already shared something — tap + to add more whenever you like.'
            : 'Be the first to share a photo or a short video from today.'
        }
      >
        <button type="button" className="oge-btn-primary mt-3" onClick={() => setUploadOpen(true)} disabled={!isLive}>
          {hasPosted ? 'Add another moment' : 'Share the first moment'}
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
    <div className="oge-page-in min-h-dvh bg-cream pb-[calc(var(--oge-nav-h)+env(safe-area-inset-bottom))]">
      <GalleryHeader
        guestName={session?.fullName}
        coupleNames={names}
        statusText={isLive ? `Closes in ${countdown.days}d ${countdown.hours}h` : 'Gallery closed'}
        activeTabLabel={activeTabLabel}
        onShare={isLive && session ? () => setUploadOpen(true) : undefined}
        shareLabel={shareLabel}
        shareDisabled={!isLive}
      />

      {!isLive ? (
        <div className="mx-4 mt-6 rounded-2xl bg-brown/90 p-8 text-center text-cream">
          <p className="font-display text-xl font-semibold">The gallery has closed</p>
          <p className="mt-2 text-sm text-cream/80">All media was removed after the 3-day window. The couple now holds every keepsake.</p>
        </div>
      ) : (
        <>
          {tab === 'photos' && (
            <MediaFeed
              media={media}
              guestNameById={guestNameById}
              likes={interactions.likes}
              comments={interactions.comments}
              commentLikes={interactions.commentLikes}
              session={session}
              onToggleLike={interactions.toggleLike}
              onAddComment={interactions.addComment}
              onToggleCommentLike={interactions.toggleCommentLike}
              onDownload={(item) => downloadUrl(item.url, item.url.split('/').pop())}
              emptyState={emptyPhotos}
            />
          )}

          {tab === 'notes' && (
            <NotesFeed
              messages={book.messages}
              loading={book.loading}
              canWrite={isLive && Boolean(session)}
              onSubmit={book.addMessage}
              session={session}
              likes={interactions.likes}
              comments={interactions.comments}
              commentLikes={interactions.commentLikes}
              onToggleLike={interactions.toggleNoteLike}
              onAddComment={interactions.addNoteComment}
              onToggleCommentLike={interactions.toggleCommentLike}
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
                  onClick={openSaveAll}
                  disabled={media.length === 0 && book.messages.length === 0}
                  className="rounded-full border border-brown/20 px-3 py-1.5 text-xs text-brown/80 transition hover:border-gold hover:text-brown disabled:opacity-40"
                >
                  Save all
                </button>
              </div>
              <GuestAlbums
                media={media}
                notes={book.messages}
                guestNameById={guestNameById}
                likes={interactions.likes}
                session={session}
                onUpload={isLive ? () => setUploadOpen(true) : undefined}
                onToggleLike={interactions.toggleLike}
                onDownload={(item) => downloadUrl(item.url, item.url.split('/').pop())}
              />
            </div>
          )}
        </>
      )}

      <BottomNav active={tab} onChange={changeTab} />

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

      <DownloadModal
        open={saveAllOpen}
        onClose={() => setSaveAllOpen(false)}
        media={media}
        notes={book.messages}
        busy={Boolean(saveProgress)}
        progress={saveProgress}
        result={saveResult}
        onDownload={runDownload}
      />

      <InstallApp />
    </div>
  );
}
