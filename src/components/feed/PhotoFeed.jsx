import dayjs from 'dayjs';
import Avatar from './Avatar.jsx';
import { filterCss } from '../../lib/constants.js';
import { CommentIcon, HeartIcon, MoreIcon, SendIcon } from './icons.jsx';

function PostComments({ comments, session, onAddComment }) {
  const visible = comments.slice(0, 2);

  const submit = async (event) => {
    event.preventDefault();
    const input = event.target.elements.commentBody;
    const body = input.value.trim();
    if (!body) return;
    await onAddComment(body);
    input.value = '';
  };

  return (
    <>
      {comments.length > 0 && (
        <ul className="space-y-1">
          {visible.map((comment) => (
            <li key={comment.id} className="text-[13px] leading-snug">
              <span className="font-semibold text-brown-dark">{comment.guests?.full_name || 'Guest'}</span>{' '}
              <span className="text-ink/80">{comment.body}</span>
            </li>
          ))}
          {comments.length > visible.length && (
            <li className="text-[13px] text-brown/45">View all {comments.length} comments</li>
          )}
        </ul>
      )}

      {session ? (
        <form onSubmit={submit} className="flex items-center gap-2 border-t border-brown/10 pt-2">
          <input
            name="commentBody"
            className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-ink placeholder:text-brown/40 focus:outline-none"
            placeholder="Add a comment…"
            maxLength={300}
            aria-label="Add a comment"
          />
          <button type="submit" className="text-[13px] font-semibold text-gold hover:text-brown">
            Post
          </button>
        </form>
      ) : (
        <p className="text-[13px] text-brown/45">Check in to comment.</p>
      )}
    </>
  );
}

function PhotoPost({ media, author, likedByMe, likeCount, comments, session, onToggleLike, onAddComment, onDownload }) {
  const filterLabel = media.filter_name && media.filter_name !== 'none'
    ? { hd: 'HD', vintage90s: '90s Vintage', retro: 'Retro', sepia: 'Sepia', classic: 'Classic' }[media.filter_name] || media.filter_name
    : null;

  return (
    <article className="border-b border-brown/10 bg-white pb-3 sm:rounded-2xl sm:border sm:shadow-card">
      <header className="flex items-center gap-3 px-3 py-2.5">
        <Avatar name={author} size="md" ring />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-brown-dark">{author}</p>
          <p className="truncate text-[11px] text-brown/50">
            {[filterLabel, dayjs(media.created_at).format('D MMM')].filter(Boolean).join(' · ')}
          </p>
        </div>
        <MoreIcon className="h-5 w-5 text-brown/40" />
      </header>

      <div className="relative w-full overflow-hidden bg-beige sm:rounded-sm">
        <img
          src={media.url}
          alt={`Shared by ${author}`}
          loading="lazy"
          className="aspect-[4/5] w-full object-cover"
          style={{ filter: filterCss(media.filter_name) }}
        />
      </div>

      <div className="space-y-2 px-3 pt-2.5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onToggleLike}
            aria-pressed={likedByMe}
            aria-label={likedByMe ? 'Unlike' : 'Like'}
            className={`transition ${likedByMe ? 'text-rose-dark' : 'text-brown-dark hover:text-rose'}`}
          >
            <HeartIcon filled={likedByMe} className="h-6 w-6" />
          </button>
          <span className="text-brown-dark" aria-hidden="true">
            <CommentIcon className="h-6 w-6" />
          </span>
          <button
            type="button"
            onClick={onDownload}
            aria-label="Download this photo"
            className="ml-auto text-brown-dark transition hover:text-gold"
          >
            <SendIcon className="h-6 w-6" />
          </button>
        </div>

        <p className="text-[13px] font-semibold text-brown-dark">
          {likeCount > 0 ? `${likeCount} like${likeCount === 1 ? '' : 's'}` : 'Be the first to like this'}
        </p>

        {media.caption ? (
          <p className="text-[13px] leading-snug text-ink">
            <span className="font-semibold text-brown-dark">{author}</span> {media.caption}
          </p>
        ) : (
          <p className="text-[13px] italic text-brown/45">a moment through {author}’s eyes</p>
        )}

        <PostComments comments={comments} session={session} onAddComment={onAddComment} />
      </div>
    </article>
  );
}

export default function PhotoFeed({ photos, guestNameById, likes, comments, session, onToggleLike, onAddComment, onDownload, emptyState }) {
  if (!photos.length) return emptyState;

  return (
    <div className="mx-auto w-full max-w-[470px] space-y-px sm:space-y-4 sm:px-3 sm:py-4">
      {photos.map((media) => {
        const postLikes = likes.filter((like) => like.media_id === media.id);
        const postComments = comments.filter((comment) => comment.media_id === media.id);
        return (
          <PhotoPost
            key={media.id}
            media={media}
            author={guestNameById[media.guest_id] || 'A guest'}
            likedByMe={Boolean(session && postLikes.some((like) => like.guest_id === session.guestId))}
            likeCount={postLikes.length}
            comments={postComments}
            session={session}
            onToggleLike={() => onToggleLike(media.id)}
            onAddComment={(body) => onAddComment(media.id, body)}
            onDownload={() => onDownload(media)}
          />
        );
      })}
    </div>
  );
}
