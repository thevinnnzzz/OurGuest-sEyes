import { useState } from 'react';
import dayjs from 'dayjs';
import Avatar from './Avatar.jsx';
import { CommentIcon, HeartIcon } from './icons.jsx';
import CommentsSheet from './CommentsSheet.jsx';
import { resolvedGuestName } from '../../lib/attribution.js';

function NoteCard({
  note,
  author,
  likes,
  comments,
  commentLikes,
  session,
  onToggleLike,
  onAddComment,
  onToggleCommentLike,
}) {
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const likedByMe = Boolean(session && likes.some((like) => like.guest_id === session.guestId));

  return (
    <article className="oge-post-in rounded-2xl border border-brown/10 bg-white p-3.5 shadow-card">
      <header className="flex items-center gap-3">
        <Avatar name={author} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-brown-dark">{author}</p>
          <p className="text-[11px] text-brown/45">{dayjs(note.created_at).format('D MMM · HH:mm')}</p>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-brown/35">note</span>
      </header>

      <p
        onClick={() => setExpanded((value) => !value)}
        className={`mt-2.5 whitespace-pre-wrap font-body text-[15px] leading-relaxed text-ink/90 ${expanded ? '' : 'line-clamp-5'}`}
      >
        {note.body}
      </p>

      <div className="mt-3 flex items-center gap-4 border-t border-brown/10 pt-2">
        <button
          type="button"
          onClick={onToggleLike}
          aria-pressed={likedByMe}
          aria-label={likedByMe ? 'Unlike this note' : 'Like this note'}
          className={`flex items-center gap-1.5 whitespace-nowrap text-[13px] transition ${
            likedByMe ? 'text-rose-dark' : 'text-brown-dark hover:text-rose'
          }`}
        >
          <HeartIcon filled={likedByMe} className={`h-5 w-5 ${likedByMe ? 'oge-heart-pop' : ''}`} />
          {likes.length > 0 ? likes.length : 'Like'}
        </button>
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          aria-label={`View all ${comments.length} comment${comments.length === 1 ? '' : 's'}`}
          className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-brown-dark transition hover:text-gold"
        >
          <CommentIcon className="h-5 w-5" />
          {comments.length > 0 ? comments.length : 'Comment'}
        </button>
      </div>

      <CommentsSheet
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={comments}
        author={author}
        caption={note.body}
        createdAt={note.created_at}
        commentLikes={commentLikes}
        session={session}
        onToggleCommentLike={onToggleCommentLike}
        onAddComment={onAddComment}
        placeholder="Add a comment on this note…"
      />
    </article>
  );
}

export default function NotesFeed({
  messages,
  loading,
  canWrite,
  onSubmit,
  session,
  emptyState,
  likes = [],
  comments = [],
  commentLikes = [],
  onToggleLike,
  onAddComment,
  onToggleCommentLike,
}) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (event) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit(body.trim());
      setBody('');
    } catch (err) {
      setError(err.message || 'The note could not be posted.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[470px] space-y-3 px-3 py-4">
      {canWrite && (
        <form onSubmit={submit} className="rounded-2xl border border-brown/10 bg-white p-3 shadow-card">
          <div className="flex items-start gap-3">
            <Avatar name={session?.fullName || 'Guest'} size="md" ring />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Leave a note for the newlyweds…"
              maxLength={1000}
              rows={3}
              className="min-h-[74px] flex-1 resize-y bg-transparent font-body text-[15px] leading-relaxed text-ink placeholder:text-brown/40 focus:outline-none"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 border-t border-brown/10 pt-2">
            <span className="text-[11px] text-brown/40">{body.length}/1000</span>
            <button type="submit" className="text-[13px] font-semibold text-gold hover:text-brown" disabled={sending || !body.trim()}>
              {sending ? 'Posting…' : 'Post note'}
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] text-rose-dark">{error}</p>}
        </form>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-brown/50">Opening the notes…</p>
      ) : messages.length === 0 ? (
        emptyState
      ) : (
        messages.map((message) => (
          <NoteCard
            key={message.id}
            note={message}
            author={resolvedGuestName(message.guests?.full_name)}
            likes={likes.filter((like) => like.message_id === message.id)}
            comments={comments.filter((comment) => comment.message_id === message.id)}
            commentLikes={commentLikes}
            session={session}
            onToggleLike={() => onToggleLike?.(message.id)}
            onAddComment={(body, parentId) => onAddComment?.(message.id, body, parentId)}
            onToggleCommentLike={onToggleCommentLike}
          />
        ))
      )}
    </div>
  );
}
