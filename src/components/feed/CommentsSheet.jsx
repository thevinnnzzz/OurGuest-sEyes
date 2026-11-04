import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import Avatar from './Avatar.jsx';
import { HeartIcon } from './icons.jsx';
import Modal from '../ui/Modal.jsx';

function nameOf(comment) {
  return comment.guests?.full_name || 'Guest';
}

/** One comment (or reply): body, time, Reply, and its own heart. */
function CommentRow({ comment, commentLikes, session, onToggleCommentLike, onReply }) {
  const author = nameOf(comment);
  const likes = commentLikes.filter((like) => like.comment_id === comment.id);
  const likedByMe = Boolean(session && likes.some((like) => like.guest_id === session.guestId));

  return (
    <div className="flex items-start gap-2.5">
      <Avatar name={author} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="break-words text-[13px] leading-snug">
          <span className="font-semibold text-brown-dark">{author}</span>{' '}
          <span className="text-ink/80">{comment.body}</span>
        </p>
        <div className="mt-1 flex items-center gap-3 text-[11px] text-brown/45">
          <span>{dayjs(comment.created_at).format('D MMM, HH:mm')}</span>
          {session && (
            <button type="button" onClick={() => onReply(comment)} className="font-medium hover:text-brown">
              Reply
            </button>
          )}
          {likes.length > 0 && (
            <span>
              {likes.length} like{likes.length === 1 ? '' : 's'}
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onToggleCommentLike(comment.id)}
        disabled={!session}
        aria-pressed={likedByMe}
        aria-label={likedByMe ? `Unlike ${author}'s comment` : `Like ${author}'s comment`}
        className={`relative mt-0.5 shrink-0 transition disabled:opacity-40 ${
          likedByMe ? 'text-rose-dark' : 'text-brown/35 hover:text-rose'
        }`}
      >
        <HeartIcon filled={likedByMe} className={`h-[18px] w-[18px] ${likedByMe ? 'oge-heart-pop' : ''}`} />
      </button>
    </div>
  );
}

/**
 * Every comment on one post or note. Comments are only ever shown here — a feed
 * card shows the icon and its count, nothing else.
 *
 * The dialog is a flex column (see Modal's `footer`), so the thread scrolls
 * inside its own area and the composer stays pinned below it instead of covering
 * the last comment on a short phone screen.
 *
 * Replies are one level deep, like Instagram: a reply to a reply lands on the
 * thread's root comment (`parent_id`), never on the reply itself.
 */
export default function CommentsSheet({
  open,
  onClose,
  comments,
  commentLikes = [],
  session,
  onAddComment,
  onToggleCommentLike,
  author,
  caption,
  createdAt,
  placeholder = 'Add a comment…',
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

  // Ids that were already on screen when the sheet rendered. Anything else is a
  // comment that just arrived (usually the guest's own) and slides in once. The
  // marker stays on the row so a later re-render cannot cut the animation short.
  const seenRef = useRef(null);
  if (seenRef.current === null) {
    seenRef.current = new Set(comments.map((comment) => comment.id));
  }
  const [animatedIds, setAnimatedIds] = useState(() => new Set());

  useEffect(() => {
    const seen = seenRef.current;
    const fresh = comments.filter((comment) => !seen.has(comment.id)).map((c) => c.id);
    comments.forEach((comment) => seen.add(comment.id));
    if (fresh.length) setAnimatedIds((prev) => new Set([...prev, ...fresh]));
  }, [comments]);

  const slidesIn = (id) => animatedIds.has(id);

  const roots = comments.filter((comment) => !comment.parent_id);
  const repliesOf = (id) => comments.filter((comment) => comment.parent_id === id);

  const submit = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onAddComment(body, replyTo?.id || null);
      setDraft('');
      setReplyTo(null);
    } catch (err) {
      setError(err.message || 'Your comment could not be posted.');
    } finally {
      setSending(false);
    }
  };

  const composer = session ? (
    <>
      {replyTo && (
        <div className="mb-1.5 flex items-center justify-between gap-2 rounded-full bg-beige px-3 py-1 text-[11px] text-brown/70">
          <span className="truncate">Replying to {replyTo.name}</span>
          <button
            type="button"
            onClick={() => setReplyTo(null)}
            className="shrink-0 text-base leading-none text-brown/50 hover:text-brown"
            aria-label="Cancel reply"
          >
            ×
          </button>
        </div>
      )}
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-ink placeholder:text-brown/40 focus:outline-none"
          placeholder={replyTo ? `Reply to ${replyTo.name}…` : placeholder}
          maxLength={300}
          aria-label={replyTo ? `Reply to ${replyTo.name}` : 'Add a comment'}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          className="shrink-0 text-[13px] font-semibold text-gold transition hover:text-brown disabled:opacity-40"
        >
          {sending ? 'Posting…' : 'Post'}
        </button>
      </form>
      {error && <p className="pt-1 text-[11px] text-rose-dark">{error}</p>}
    </>
  ) : (
    <p className="text-[13px] text-brown/45">Check in to comment.</p>
  );

  return (
    <Modal open={open} onClose={onClose} title="Comments" footer={composer}>
      <div className="flex items-center gap-2.5 border-b border-brown/10 pb-3">
        <Avatar name={author} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-brown-dark">{author}</p>
          <p className="text-[11px] text-brown/50">{dayjs(createdAt).format('D MMM, HH:mm')}</p>
        </div>
      </div>

      {caption && (
        <p className="mt-3 line-clamp-4 text-[13px] leading-snug text-ink">
          <span className="font-semibold text-brown-dark">{author}</span> {caption}
        </p>
      )}

      <ul className="mt-3 space-y-4">
        {roots.length === 0 ? (
          <li className="py-8 text-center text-[13px] text-brown/45">
            No comments yet — be the first to say something.
          </li>
        ) : (
          roots.map((comment) => {
            const replies = repliesOf(comment.id);
            return (
              <li key={comment.id} className={slidesIn(comment.id) ? 'oge-comment-in' : undefined}>
                <CommentRow
                  comment={comment}
                  commentLikes={commentLikes}
                  session={session}
                  onToggleCommentLike={onToggleCommentLike}
                  onReply={() => setReplyTo({ id: comment.id, name: nameOf(comment) })}
                />

                {replies.length > 0 && (
                  <ul className="ml-11 mt-2.5 space-y-2.5 border-l border-brown/10 pl-3">
                    {replies.map((reply) => (
                      <li key={reply.id} className={slidesIn(reply.id) ? 'oge-comment-in' : undefined}>
                        <CommentRow
                          comment={reply}
                          commentLikes={commentLikes}
                          session={session}
                          onToggleCommentLike={onToggleCommentLike}
                          onReply={() => setReplyTo({ id: comment.id, name: nameOf(reply) })}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })
        )}
      </ul>
    </Modal>
  );
}
