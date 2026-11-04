import { useEffect, useRef, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase.js';

/**
 * Loads likes and comments for an event's media and keeps realtime
 * subscriptions in sync. Exposes helper actions scoped to the session token.
 */
export function useEventInteractions(weddingId, session) {
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentLikes, setCommentLikes] = useState([]);
  const [loading, setLoading] = useState(true);

  // A ref mirror is the source of truth for the tap handlers. React state can
  // lag a click by a render, and a toggle that decides from a stale snapshot
  // turns a double tap into the wrong request. Everything that changes likes
  // goes through `updateLikes` / `updateCommentLikes`, so the ref is always the
  // newest value the guest sees.
  const likesRef = useRef([]);
  const commentLikesRef = useRef([]);

  const updateLikes = (next) => {
    likesRef.current = next;
    setLikes(next);
  };

  const updateCommentLikes = (next) => {
    commentLikesRef.current = next;
    setCommentLikes(next);
  };

  // Only the newest fetch may write state, so a response that started before a
  // tap can never undo it.
  const refreshSeq = useRef(0);
  // Every tap bumps this. A fetch that started before a tap may still be in
  // flight when it lands; applying its likes would wipe the tap that came after,
  // which is how a removed heart used to flicker back.
  const mutationSeq = useRef(0);

  const refresh = async () => {
    if (!supabaseReady || !weddingId) return;
    const seq = ++refreshSeq.current;
    const mutationsAtStart = mutationSeq.current;
    const [likesRes, commentsRes, commentLikesRes] = await Promise.all([
      supabase.from('likes').select('*').eq('wedding_id', weddingId),
      supabase
        .from('comments')
        .select('*, guests!inner(full_name)')
        .eq('wedding_id', weddingId)
        .order('created_at', { ascending: true }),
      // Fails harmlessly before 20261105_comment_replies_likes.sql is applied.
      supabase.from('comment_likes').select('*').eq('wedding_id', weddingId),
    ]);
    if (seq !== refreshSeq.current) return;
    const touchedMeanwhile = mutationsAtStart !== mutationSeq.current;
    if (likesRes.data && !touchedMeanwhile) updateLikes(likesRes.data);
    if (commentLikesRes.data && !touchedMeanwhile) updateCommentLikes(commentLikesRes.data);
    if (commentsRes.data) setComments(commentsRes.data);
    setLoading(false);
  };

  useEffect(() => {
    if (!weddingId) return undefined;
    refresh();
    const channel = supabase
      .channel(`interactions-${weddingId}`)
      .on('presence', { event: 'sync' }, () => {})
      .subscribe();
    const likesChannel = supabase
      .channel(`likes-${weddingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'likes', filter: `wedding_id=eq.${weddingId}` },
        () => refresh(),
      )
      .subscribe();
    const commentsChannel = supabase
      .channel(`comments-${weddingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `wedding_id=eq.${weddingId}` },
        () => refresh(),
      )
      .subscribe();
    const commentLikesChannel = supabase
      .channel(`comment-likes-${weddingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comment_likes', filter: `wedding_id=eq.${weddingId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(commentLikesChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingId]);

  // One queue per like target, so a fast double tap can never interleave an
  // insert and a delete and settle on the wrong answer.
  const queues = useRef(new Map());
  const runExclusive = (key, task) => {
    const previous = queues.current.get(key) || Promise.resolve();
    const next = previous.then(task, task).finally(() => {
      if (queues.current.get(key) === next) queues.current.delete(key);
    });
    queues.current.set(key, next);
    return next;
  };

  // A like belongs either to a photo/video (`media_id`) or to a guestbook note
  // (`message_id`), so the target is passed as a one-key column map.
  const toggleTargetLike = (target) => {
    if (!session) return Promise.resolve();
    const [column] = Object.keys(target);
    const value = target[column];
    const guestId = session.guestId;
    const isMine = (like) => like[column] === value && like.guest_id === guestId;

    return runExclusive(`${column}:${value}:${guestId}`, async () => {
      mutationSeq.current += 1;
      if (likesRef.current.some(isMine)) {
        // Remove first for an instant response. Then delete by target rather
        // than by row id: straight after a like the row may only exist locally
        // as `optimistic-…`, and deleting by that id matches nothing — which is
        // exactly how a removed like used to come back on the next refresh.
        updateLikes(likesRef.current.filter((like) => !isMine(like)));
        const { error } = await supabase
          .from('likes')
          .delete()
          .eq(column, value)
          .eq('guest_id', guestId);
        if (error) {
          updateLikes([
            ...likesRef.current,
            { id: `fallen-${value}`, ...target, guest_id: guestId, wedding_id: weddingId },
          ]);
        }
        // The database is the truth either way.
        refresh();
        return;
      }

      const optimistic = {
        id: `optimistic-${column}-${value}-${guestId}`,
        ...target,
        guest_id: guestId,
        wedding_id: weddingId,
      };
      updateLikes([...likesRef.current, optimistic]);
      const { error } = await supabase
        .from('likes')
        .insert({ ...target, guest_id: guestId, wedding_id: weddingId });
      if (error) {
        updateLikes(likesRef.current.filter((like) => like.id !== optimistic.id));
        return;
      }
      // Swap the placeholder id for the real row id.
      refresh();
    });
  };

  const toggleCommentLike = (commentId) => {
    if (!session) return Promise.resolve();
    const guestId = session.guestId;
    const isMine = (like) => like.comment_id === commentId && like.guest_id === guestId;

    return runExclusive(`comment:${commentId}:${guestId}`, async () => {
      mutationSeq.current += 1;
      if (commentLikesRef.current.some(isMine)) {
        updateCommentLikes(commentLikesRef.current.filter((like) => !isMine(like)));
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('guest_id', guestId);
        if (error) {
          updateCommentLikes([
            ...commentLikesRef.current,
            { id: `fallen-${commentId}`, comment_id: commentId, guest_id: guestId, wedding_id: weddingId },
          ]);
        }
        refresh();
        return;
      }

      const optimistic = {
        id: `optimistic-comment-${commentId}-${guestId}`,
        comment_id: commentId,
        guest_id: guestId,
        wedding_id: weddingId,
      };
      updateCommentLikes([...commentLikesRef.current, optimistic]);
      const { error } = await supabase.from('comment_likes').insert({
        comment_id: commentId,
        guest_id: guestId,
        wedding_id: weddingId,
      });
      if (error) {
        updateCommentLikes(commentLikesRef.current.filter((like) => like.id !== optimistic.id));
        return;
      }
      refresh();
    });
  };

  const addTargetComment = async (target, body, parentId = null) => {
    if (!session || !body.trim()) return;
    const row = {
      ...target,
      guest_id: session.guestId,
      wedding_id: weddingId,
      body: body.trim(),
    };
    // Only sent for replies, so plain comments keep working before the
    // parent_id migration is applied.
    if (parentId) row.parent_id = parentId;
    const { error } = await supabase.from('comments').insert(row);
    if (error) throw new Error(error.message || 'Your comment could not be posted.');
    refresh();
  };

  return {
    likes,
    comments,
    commentLikes,
    loading,
    toggleLike: (mediaId) => toggleTargetLike({ media_id: mediaId }),
    addComment: (mediaId, body, parentId) => addTargetComment({ media_id: mediaId }, body, parentId),
    toggleNoteLike: (messageId) => toggleTargetLike({ message_id: messageId }),
    addNoteComment: (messageId, body, parentId) =>
      addTargetComment({ message_id: messageId }, body, parentId),
    toggleCommentLike,
  };
}
