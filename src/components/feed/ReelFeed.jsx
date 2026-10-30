import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Modal from '../ui/Modal.jsx';
import Avatar from './Avatar.jsx';
import { filterCss } from '../../lib/constants.js';
import { CommentIcon, HeartIcon, MuteIcon, PauseIcon, SendIcon } from './icons.jsx';

function Reel({
  media,
  author,
  likedByMe,
  likeCount,
  commentCount,
  muted,
  onToggleMute,
  onToggleLike,
  onOpenComments,
  onDownload,
}) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(false);

  // Play only the reel occupying most of the screen; pause the rest.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          video.play().then(() => setPaused(false)).catch(() => {});
        } else {
          video.pause();
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setPaused(false)).catch(() => {});
    } else {
      video.pause();
      setPaused(true);
    }
  };

  const filterLabel = media.filter_name && media.filter_name !== 'none' ? media.filter_name : null;

  return (
    <section className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={media.url}
        loop
        muted={muted}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        className="h-full w-full object-cover"
        style={{ filter: filterCss(media.filter_name) }}
      />

      {paused && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-cream/80">
          <PauseIcon className="h-14 w-14" />
        </span>
      )}

      <button
        type="button"
        onClick={onToggleMute}
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        className="absolute right-3 top-3 rounded-full bg-black/45 p-2 text-cream backdrop-blur"
      >
        <MuteIcon muted={muted} className="h-5 w-5" />
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4 pb-5">
        <div className="min-w-0 flex-1 text-cream">
          <div className="flex items-center gap-2">
            <Avatar name={author} size="sm" ring />
            <p className="truncate text-[13px] font-semibold">{author}</p>
            <span className="text-[11px] text-cream/60">· {dayjs(media.created_at).format('D MMM')}</span>
          </div>
          {media.caption && <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-cream/90">{media.caption}</p>}
          <p className="mt-2 text-[11px] text-cream/60">
            {filterLabel ? `${filterLabel} filter · ` : ''}original audio
          </p>
        </div>

        <div className="flex flex-col items-center gap-5 pb-2 text-cream">
          <button
            type="button"
            onClick={onToggleLike}
            aria-pressed={likedByMe}
            aria-label={likedByMe ? 'Unlike reel' : 'Like reel'}
            className="flex flex-col items-center gap-1"
          >
            <HeartIcon filled={likedByMe} className={`h-7 w-7 ${likedByMe ? 'text-rose' : ''}`} />
            <span className="text-[11px]">{likeCount}</span>
          </button>

          <button
            type="button"
            onClick={onOpenComments}
            aria-label="Open comments"
            className="flex flex-col items-center gap-1"
          >
            <CommentIcon className="h-7 w-7" />
            <span className="text-[11px]">{commentCount}</span>
          </button>

          <button type="button" onClick={onDownload} aria-label="Download this reel" className="flex flex-col items-center gap-1">
            <SendIcon className="h-7 w-7" />
          </button>
        </div>
      </div>
    </section>
  );
}

export default function ReelFeed({
  reels,
  guestNameById,
  likes,
  comments,
  session,
  onToggleLike,
  onAddComment,
  onDownload,
  emptyState,
}) {
  const [muted, setMuted] = useState(true);
  const [commentReelId, setCommentReelId] = useState(null);

  if (!reels.length) return emptyState;

  const commentReel = reels.find((reel) => reel.id === commentReelId) || null;
  const reelComments = commentReel ? comments.filter((comment) => comment.media_id === commentReel.id) : [];

  const submitComment = async (event) => {
    event.preventDefault();
    const input = event.target.elements.reelComment;
    const body = input.value.trim();
    if (!body || !commentReel) return;
    await onAddComment(commentReel.id, body);
    input.value = '';
  };

  return (
    <>
      <div className="oge-feed-height snap-y snap-mandatory overflow-y-auto overscroll-contain bg-black">
        {reels.map((media) => {
          const reelLikes = likes.filter((like) => like.media_id === media.id);
          const reelCommentCount = comments.filter((comment) => comment.media_id === media.id).length;
          return (
            <Reel
              key={media.id}
              media={media}
              author={guestNameById[media.guest_id] || 'A guest'}
              likedByMe={Boolean(session && reelLikes.some((like) => like.guest_id === session.guestId))}
              likeCount={reelLikes.length}
              commentCount={reelCommentCount}
              muted={muted}
              onToggleMute={() => setMuted((value) => !value)}
              onToggleLike={() => onToggleLike(media.id)}
              onOpenComments={() => setCommentReelId(media.id)}
              onDownload={() => onDownload(media)}
            />
          );
        })}
      </div>

      <Modal open={Boolean(commentReel)} onClose={() => setCommentReelId(null)} title="Comments">
        {reelComments.length === 0 ? (
          <p className="py-4 text-center text-sm text-brown/50">No comments yet — be the first.</p>
        ) : (
          <ul className="max-h-[45dvh] space-y-3 overflow-y-auto pb-2">
            {reelComments.map((comment) => (
              <li key={comment.id} className="flex items-start gap-3">
                <Avatar name={comment.guests?.full_name || 'Guest'} size="sm" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-brown-dark">{comment.guests?.full_name || 'Guest'}</p>
                  <p className="text-[13px] leading-snug text-ink/85">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {session && commentReel && (
          <form onSubmit={submitComment} className="mt-3 flex items-center gap-2 border-t border-brown/10 pt-3">
            <input
              name="reelComment"
              className="oge-input flex-1 py-2 text-sm"
              placeholder="Add a comment…"
              maxLength={300}
              aria-label="Add a comment"
            />
            <button type="submit" className="oge-btn-gold px-4 py-2 text-xs">
              Post
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
