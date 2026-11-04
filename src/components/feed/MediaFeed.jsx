import { useEffect, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Avatar from './Avatar.jsx';
import { CommentIcon, HeartIcon, SendIcon } from './icons.jsx';
import CommentsSheet from './CommentsSheet.jsx';
import { filterCss } from '../../lib/constants.js';
import { resolvedGuestName } from '../../lib/attribution.js';
import { groupMediaIntoPosts } from '../../lib/mediaPosts.js';

const FILTER_LABELS = {
  hd: 'HD',
  vintage90s: '90s Vintage',
  retro: 'Retro',
  sepia: 'Sepia',
  classic: 'Classic',
};


/** A video slide that only plays while it is the visible one. */
function VideoSlide({ item, active, label }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    if (!active) {
      video.pause();
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [active]);

  return (
    <video
      ref={videoRef}
      src={item.url}
      loop
      muted
      controls={active}
      playsInline
      preload="metadata"
      tabIndex={active ? undefined : -1}
      aria-label={label}
      className="aspect-[4/5] w-full bg-black object-contain"
      style={{ filter: filterCss(item.filter_name) }}
    />
  );
}

function MediaPost({ post, author, likes, comments, session, onToggleLike, onAddComment, onDownload }) {
  const items = post.items;
  const [index, setIndex] = useState(0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  const safeIndex = Math.min(index, items.length - 1);
  const active = items[safeIndex];
  const multiple = items.length > 1;

  const step = (delta) => setIndex((current) => Math.min(items.length - 1, Math.max(0, current + delta)));

  // Horizontal swipe between the media of one post, Instagram-style. The drag
  // only takes over once it is clearly sideways, so vertical scrolling and the
  // video controls still work.
  const onPointerDown = (event) => {
    if (!multiple) return;
    dragRef.current = { startX: event.clientX, startY: event.clientY, lastX: 0, active: false };
  };

  const onPointerMove = (event) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.active) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
      drag.active = true;
      setDragging(true);
      try {
        event.currentTarget.setPointerCapture?.(event.pointerId);
      } catch {
        /* best effort */
      }
    }
    drag.lastX = dx;
    setDragX(dx);
  };

  const onPointerUp = (event) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    const dx = drag.lastX || 0;
    const width = event.currentTarget.clientWidth || 320;
    const threshold = Math.min(110, width * 0.16);
    setDragging(false);
    setDragX(0);
    if (drag.active && Math.abs(dx) > threshold) step(dx > 0 ? -1 : 1);
  };

  const onPointerCancel = () => {
    dragRef.current = null;
    setDragging(false);
    setDragX(0);
  };

  const postLikes = likes.filter((like) => like.media_id === active.id);
  const likedByMe = Boolean(session && postLikes.some((like) => like.guest_id === session.guestId));
  const postComments = comments.filter((comment) => comment.media_id === active.id);
  const filterLabel =
    active.filter_name && active.filter_name !== 'none'
      ? FILTER_LABELS[active.filter_name] || active.filter_name
      : null;

  return (
    <article className="border-b border-brown/10 bg-white pb-3 sm:rounded-2xl sm:border sm:shadow-card">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Avatar name={author} size="md" ring />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-brown-dark">{author}</p>
          <p className="truncate text-[11px] text-brown/50">
            {[filterLabel, dayjs(active.created_at).format('D MMM')].filter(Boolean).join(' · ')}
          </p>
        </div>
      </header>

      <div
        className="group relative w-full overflow-hidden bg-beige"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onKeyDown={(event) => {
          if (!multiple) return;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            step(-1);
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            step(1);
          }
        }}
        tabIndex={multiple ? 0 : -1}
        role={multiple ? 'group' : undefined}
        aria-roledescription={multiple ? 'carousel' : undefined}
        aria-label={multiple ? `${items.length} moments from ${author}, swipe to browse` : undefined}
        style={{ touchAction: 'pan-y' }}
      >
        <div
          className="flex"
          style={{
            transform: `translateX(calc(${-safeIndex * 100}% + ${dragX}px))`,
            transition: dragging ? 'none' : 'transform 220ms ease',
          }}
        >
          {items.map((item, itemIndex) => (
            <div
              key={item.id}
              className="w-full shrink-0"
              aria-hidden={itemIndex !== safeIndex}
              aria-roledescription={multiple ? 'slide' : undefined}
              aria-label={multiple ? `${itemIndex + 1} of ${items.length}` : undefined}
            >
              {item.type === 'video' ? (
                <VideoSlide
                  item={item}
                  active={itemIndex === safeIndex}
                  label={`Video shared by ${author}`}
                />
              ) : (
                <img
                  src={item.url}
                  alt={`Shared by ${author}`}
                  loading={itemIndex === 0 ? 'eager' : 'lazy'}
                  draggable={false}
                  className="aspect-[4/5] w-full select-none object-cover"
                  style={{ filter: filterCss(item.filter_name) }}
                />
              )}
            </div>
          ))}
        </div>

        {multiple && (
          <>
            <span className="pointer-events-none absolute right-2 top-2 rounded-full bg-brown-dark/55 px-2 py-0.5 text-[11px] font-medium text-cream backdrop-blur">
              {safeIndex + 1}/{items.length}
            </span>

            {safeIndex > 0 && (
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo or video in this post"
                className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-brown-dark/45 text-xl leading-none text-cream backdrop-blur transition hover:bg-brown-dark/70 sm:flex"
              >
                ‹
              </button>
            )}
            {safeIndex < items.length - 1 && (
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo or video in this post"
                className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-brown-dark/45 text-xl leading-none text-cream backdrop-blur transition hover:bg-brown-dark/70 sm:flex"
              >
                ›
              </button>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5 [filter:drop-shadow(0_1px_2px_rgba(0,0,0,0.45))]">
              {items.map((item, itemIndex) => (
                <span
                  key={item.id}
                  className={`h-1.5 rounded-full transition-all ${
                    itemIndex === safeIndex ? 'w-4 bg-cream' : 'w-1.5 bg-cream/70'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="space-y-2 px-3 pt-2.5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onToggleLike(active.id)}
            aria-pressed={likedByMe}
            aria-label={likedByMe ? 'Unlike' : 'Like'}
            className={`transition ${likedByMe ? 'text-rose-dark' : 'text-brown-dark hover:text-rose'}`}
          >
            <HeartIcon filled={likedByMe} className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen(true)}
            aria-label={`View all ${postComments.length} comment${postComments.length === 1 ? '' : 's'}`}
            className="flex items-center gap-1 text-brown-dark transition hover:text-gold"
          >
            <CommentIcon className="h-6 w-6" />
            {postComments.length > 0 && (
              <span className="text-[11px] font-semibold">{postComments.length}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onDownload(active)}
            aria-label={`Download this ${active.type}`}
            className="ml-auto text-brown-dark transition hover:text-gold"
          >
            <SendIcon className="h-6 w-6" />
          </button>
        </div>

        <p className="text-[13px] font-semibold text-brown-dark">
          {postLikes.length > 0
            ? `${postLikes.length} like${postLikes.length === 1 ? '' : 's'}`
            : 'Be the first to like this'}
        </p>

        {post.caption ? (
          <p className="text-[13px] leading-snug text-ink">
            <span className="font-semibold text-brown-dark">{author}</span> {post.caption}
          </p>
        ) : (
          <p className="text-[13px] italic text-brown/45">a moment through {author}’s eyes</p>
        )}

      </div>

      <CommentsSheet
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={postComments}
        author={author}
        caption={post.caption}
        createdAt={active.created_at}
        session={session}
        onAddComment={(body) => onAddComment(active.id, body)}
      />
    </article>
  );
}

/**
 * The Photos tab: every upload appears once, as one Instagram-style post.
 * Photos and videos shared together live in the same post and swipe sideways.
 */
export default function MediaFeed({
  media,
  guestNameById,
  likes,
  comments,
  session,
  onToggleLike,
  onAddComment,
  onDownload,
  emptyState,
}) {
  const posts = useMemo(() => groupMediaIntoPosts(media), [media]);

  if (!posts.length) return emptyState;

  return (
    <div className="mx-auto w-full max-w-[470px] space-y-px sm:space-y-4 sm:px-3 sm:py-4">
      {posts.map((post) => (
        <MediaPost
          key={post.key}
          post={post}
          author={resolvedGuestName(guestNameById[post.guestId])}
          likes={likes}
          comments={comments}
          session={session}
          onToggleLike={onToggleLike}
          onAddComment={onAddComment}
          onDownload={onDownload}
        />
      ))}
    </div>
  );
}
