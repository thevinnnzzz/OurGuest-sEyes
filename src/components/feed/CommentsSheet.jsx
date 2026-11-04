import { useState } from 'react';
import dayjs from 'dayjs';
import Avatar from './Avatar.jsx';
import Modal from '../ui/Modal.jsx';

/**
 * Every comment on one post or note. Comments are only ever shown here — a feed
 * card shows the icon and its count, nothing else.
 *
 * The dialog is a flex column (see Modal's `footer`), so the thread scrolls
 * inside its own area and the composer stays pinned below it instead of covering
 * the last comment on a short phone screen.
 */
export default function CommentsSheet({
  open,
  onClose,
  comments,
  author,
  caption,
  createdAt,
  session,
  onAddComment,
  placeholder = 'Add a comment…',
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      await onAddComment(body);
      setDraft('');
    } catch (err) {
      setError(err.message || 'Your comment could not be posted.');
    } finally {
      setSending(false);
    }
  };

  const composer = session ? (
    <>
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] text-ink placeholder:text-brown/40 focus:outline-none"
          placeholder={placeholder}
          maxLength={300}
          aria-label="Add a comment"
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

      <ul className="mt-3 space-y-3">
        {comments.length === 0 ? (
          <li className="py-8 text-center text-[13px] text-brown/45">
            No comments yet — be the first to say something.
          </li>
        ) : (
          comments.map((comment) => (
            <li key={comment.id} className="flex gap-2.5">
              <Avatar name={comment.guests?.full_name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="break-words text-[13px] leading-snug">
                  <span className="font-semibold text-brown-dark">
                    {comment.guests?.full_name || 'Guest'}
                  </span>{' '}
                  <span className="text-ink/80">{comment.body}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-brown/40">
                  {dayjs(comment.created_at).format('D MMM, HH:mm')}
                </p>
              </div>
            </li>
          ))
        )}
      </ul>
    </Modal>
  );
}
