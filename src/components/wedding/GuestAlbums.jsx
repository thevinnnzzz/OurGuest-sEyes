import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Modal from '../ui/Modal.jsx';
import EmptyState from '../ui/EmptyState.jsx';
import { filterCss } from '../../lib/constants.js';

function typeLabel(item) {
  return item.type === 'video' ? 'Reel' : 'Photo';
}

/** One tile per guest: a cover from their latest photo (or reel) plus a count. */
function GuestAlbumCard({ album, onOpen }) {
  const cover = album.items.find((item) => item.type === 'photo') || album.items[0];
  const photos = album.items.filter((item) => item.type === 'photo').length;
  const reels = album.items.length - photos;
  const counts = [
    photos ? `${photos} photo${photos === 1 ? '' : 's'}` : null,
    reels ? `${reels} reel${reels === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open ${album.name}'s album, ${counts}`}
      className="group relative block w-full overflow-hidden rounded-2xl border border-brown/10 bg-white text-left shadow-card transition hover:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
    >
      <div className="relative aspect-[4/5] w-full bg-beige">
        {cover.type === 'video' ? (
          <video
            src={cover.url}
            muted
            playsInline
            preload="metadata"
            aria-hidden="true"
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={cover.url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            style={{ filter: filterCss(cover.filter_name) }}
          />
        )}

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-brown-dark/90 via-brown-dark/50 to-transparent px-3 pb-3 pt-10">
          <p className="break-words font-display text-sm font-semibold leading-snug text-cream">
            {album.name}
          </p>
          <p className="mt-0.5 text-[11px] text-cream/75">{counts}</p>
        </div>

        {reels > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-brown-dark/70 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-cream backdrop-blur">
            ▶ {reels}
          </span>
        )}
      </div>
    </button>
  );
}

/** Full-screen viewer for one photo or reel, with previous/next through the album. */
function MediaViewer({ item, author, index, total, onClose, onPrev, onNext, onDownload, liked, likeCount, onToggleLike }) {
  const hasPrev = index > 0;
  const hasNext = index < total - 1;

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowLeft' && hasPrev) onPrev();
      else if (event.key === 'ArrowRight' && hasNext) onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${typeLabel(item)} shared by ${author}`}
      className="fixed inset-0 z-[60] flex flex-col bg-brown-dark/95"
    >
      <div className="flex items-start justify-between gap-4 px-4 pb-2 pt-4 text-cream">
        <div className="min-w-0">
          <p className="truncate font-display text-base font-semibold">{author}</p>
          <p className="text-[11px] text-cream/60">
            {typeLabel(item)} · {index + 1} of {total}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="shrink-0 rounded-full border border-cream/30 px-3 py-1 text-lg leading-none text-cream/80 transition hover:bg-cream/10"
        >
          ×
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {item.type === 'video' ? (
          <video src={item.url} controls autoPlay playsInline className="max-h-full max-w-full" />
        ) : (
          <img
            src={item.url}
            alt={`Shared by ${author}`}
            className="max-h-full max-w-full object-contain"
            style={{ filter: filterCss(item.filter_name) }}
          />
        )}

        {hasPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous moment"
            className="absolute left-2 flex h-10 w-10 items-center justify-center rounded-full bg-brown-dark/60 text-2xl leading-none text-cream backdrop-blur transition hover:bg-brown-dark/80"
          >
            ‹
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next moment"
            className="absolute right-2 flex h-10 w-10 items-center justify-center rounded-full bg-brown-dark/60 text-2xl leading-none text-cream backdrop-blur transition hover:bg-brown-dark/80"
          >
            ›
          </button>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-4 text-cream">
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike this moment' : 'Like this moment'}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
            liked ? 'border-rose bg-rose/25 text-cream' : 'border-cream/30 text-cream/85 hover:border-rose'
          }`}
        >
          {liked ? '♥' : '♡'} {likeCount}
        </button>
        <button
          type="button"
          onClick={onDownload}
          className="rounded-full border border-cream/30 px-3 py-1.5 text-sm text-cream/85 transition hover:border-gold hover:text-cream"
        >
          ↓ Save
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The gallery tab, grouped into one album per guest. Tapping an album opens a
 * grid of everything that guest shared; tapping a tile opens the viewer.
 */
export default function GuestAlbums({
  media,
  guestNameById,
  likes = [],
  session,
  onToggleLike,
  onDownload,
}) {
  const [openGuestId, setOpenGuestId] = useState(null);
  const [viewerIndex, setViewerIndex] = useState(null);

  const albums = useMemo(() => {
    const grouped = new Map();
    media.forEach((item) => {
      const key = item.guest_id || 'unknown';
      if (!grouped.has(key)) {
        grouped.set(key, {
          id: key,
          name: guestNameById[item.guest_id] || 'A guest',
          items: [],
        });
      }
      grouped.get(key).items.push(item);
    });
    return [...grouped.values()];
  }, [media, guestNameById]);

  const active = albums.find((album) => album.id === openGuestId) || null;
  const viewerItem = active && viewerIndex !== null ? active.items[viewerIndex] : null;

  const viewerLikes = viewerItem ? likes.filter((like) => like.media_id === viewerItem.id) : [];
  const viewerLiked = Boolean(session && viewerLikes.some((like) => like.guest_id === session.guestId));

  if (!media.length) {
    return (
      <EmptyState
        icon="📸"
        title="The gallery is waiting for its first moment"
        subtitle="Be the one to set the tone — share a photo or video of today."
      />
    );
  }

  const closeAlbum = () => {
    setViewerIndex(null);
    setOpenGuestId(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {albums.map((album) => (
          <GuestAlbumCard
            key={album.id}
            album={album}
            onOpen={() => {
              setViewerIndex(null);
              setOpenGuestId(album.id);
            }}
          />
        ))}
      </div>

      <Modal
        open={Boolean(active)}
        onClose={() => {
          if (viewerIndex === null) closeAlbum();
        }}
        title={active?.name}
        size="lg"
      >
        {active && (
          <>
            <p className="-mt-3 mb-3 text-xs text-brown/55">
              {active.items.length} moment{active.items.length === 1 ? '' : 's'} shared by this guest
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {active.items.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setViewerIndex(index)}
                  aria-label={`View ${typeLabel(item).toLowerCase()} ${index + 1} of ${active.items.length}`}
                  className="group relative aspect-square overflow-hidden rounded-xl border border-brown/10 bg-brown-dark/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold"
                >
                  {item.type === 'video' ? (
                    <>
                      <video
                        src={item.url}
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-brown-dark/25 text-2xl text-cream">
                        ▶
                      </span>
                    </>
                  ) : (
                    <img
                      src={item.url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-200 group-hover:scale-105"
                      style={{ filter: filterCss(item.filter_name) }}
                    />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </Modal>

      {viewerItem && (
        <MediaViewer
          item={viewerItem}
          author={active.name}
          index={viewerIndex}
          total={active.items.length}
          onClose={() => setViewerIndex(null)}
          onPrev={() => setViewerIndex((index) => Math.max(0, index - 1))}
          onNext={() => setViewerIndex((index) => Math.min(active.items.length - 1, index + 1))}
          onDownload={() => onDownload(viewerItem)}
          onToggleLike={() => onToggleLike(viewerItem.id)}
          liked={viewerLiked}
          likeCount={viewerLikes.length}
        />
      )}
    </>
  );
}
