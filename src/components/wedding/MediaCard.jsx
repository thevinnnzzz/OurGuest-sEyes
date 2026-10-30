import { filterCss } from '../../lib/constants.js';

// CSS live filters are applied on render — the original file is untouched.
export { filterCss };

export default function MediaCard({
  media,
  liked,
  likeCount,
  comments,
  likedByMe,
  onToggleLike,
  onAddComment,
  onDownload,
  guestNameById,
}) {
  const isVideo = media.type === 'video';
  const commentList = comments || [];

  const addComment = async (e) => {
    e.preventDefault();
    const input = e.target.elements.commentBody;
    if (!input.value.trim()) return;
    await onAddComment(input.value.trim());
    input.value = '';
  };

  return (
    <figure className="oge-fade-in overflow-hidden rounded-2xl border border-brown/10 bg-white shadow-card">
      <div className="relative bg-beige">
        {isVideo ? (
          <video
            src={media.url}
            controls
            playsInline
            preload="metadata"
            className="max-h-[70vh] w-full object-contain"
          />
        ) : (
          <img
            src={media.url}
            alt={`Shared by ${guestNameById[media.guest_id] || 'a guest'}`}
            loading="lazy"
            className="max-h-[70vh] w-full object-contain"
            style={{ filter: filterCss(media.filter_name) }}
          />
        )}
        {media.filter_name && media.filter_name !== 'none' && !isVideo && (
          <span className="absolute right-3 top-3 rounded-full bg-brown-dark/80 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-cream">
            Filter
          </span>
        )}
      </div>

      <figcaption className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-brown/50">
              {isVideo ? 'Video moment' : 'Photo'}
            </p>
            <p className="font-display text-sm font-semibold text-brown">
              {guestNameById[media.guest_id] || 'A guest'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleLike}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                likedByMe
                  ? 'border-rose bg-rose/15 text-rose-dark'
                  : 'border-brown/20 text-brown/70 hover:border-rose hover:text-rose'
              }`}
              aria-pressed={likedByMe}
            >
              {likedByMe ? '♥' : '♡'} {likeCount ?? 0}
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="rounded-full border border-brown/20 px-3 py-1.5 text-sm text-brown/80 hover:border-gold hover:text-brown"
              aria-label="Download this file"
            >
              ↓ Save
            </button>
          </div>
        </div>

        {commentList.length > 0 && (
          <ul className="space-y-1.5 border-t border-brown/10 pt-3">
            {commentList.map((c) => (
              <li key={c.id} className="text-sm leading-snug">
                <span className="font-semibold text-brown">{c.guests?.full_name || 'Guest'}</span>{' '}
                <span className="text-ink/80">{c.body}</span>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={addComment} className="flex gap-2">
          <input
            name="commentBody"
            className="oge-input flex-1 py-2 text-sm"
            placeholder="Write a note of love…"
            maxLength={300}
          />
          <button type="submit" className="oge-btn-gold px-4 py-2 text-xs">
            Post
          </button>
        </form>
      </figcaption>
    </figure>
  );
}
