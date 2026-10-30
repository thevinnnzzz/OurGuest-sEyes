import MediaCard from './MediaCard.jsx';
import EmptyState from '../ui/EmptyState.jsx';

export default function FeedGrid({ media, guestNameById, likes, comments, session, onToggleLike, onAddComment, onDownload }) {
  if (!media.length) {
    return (
      <EmptyState
        icon="📸"
        title="The gallery is waiting for its first moment"
        subtitle="Be the one to set the tone — share a photo or video of today."
      />
    );
  }

  return (
    <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3 [&>*]:break-inside-avoid">
      {media.map((m) => {
        const likeList = likes.filter((l) => l.media_id === m.id);
        const likedByMe = session ? likeList.some((l) => l.guest_id === session.guestId) : false;
        const mediaComments = comments.filter((c) => c.media_id === m.id);
        return (
          <div key={m.id} className="w-full">
            <MediaCard
              media={m}
              likeCount={likeList.length}
              likedByMe={likedByMe}
              comments={mediaComments}
              onToggleLike={() => onToggleLike(m.id)}
              onAddComment={(body) => onAddComment(m.id, body)}
              onDownload={() => onDownload(m)}
              guestNameById={guestNameById}
            />
          </div>
        );
      })}
    </div>
  );
}
