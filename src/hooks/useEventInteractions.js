import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase.js';

/**
 * Loads likes and comments for an event's media and keeps realtime
 * subscriptions in sync. Exposes helper actions scoped to the session token.
 */
export function useEventInteractions(weddingId, session) {
  const [likes, setLikes] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!supabaseReady || !weddingId) return;
    const [likesRes, commentsRes] = await Promise.all([
      supabase.from('likes').select('*').eq('wedding_id', weddingId),
      supabase
        .from('comments')
        .select('*, guests!inner(full_name)')
        .eq('wedding_id', weddingId)
        .order('created_at', { ascending: true }),
    ]);
    if (likesRes.data) setLikes(likesRes.data);
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
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(likesChannel);
      supabase.removeChannel(commentsChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingId]);

  // A like belongs either to a photo/video (`media_id`) or to a guestbook note
  // (`message_id`), so the target is passed as a one-key column map.
  const toggleTargetLike = async (target) => {
    if (!session) return;
    const [column] = Object.keys(target);
    const value = target[column];
    const existing = likes.find((l) => l[column] === value && l.guest_id === session.guestId);
    if (existing) {
      setLikes((prev) => prev.filter((l) => l.id !== existing.id));
      await supabase.from('likes').delete().eq('id', existing.id);
    } else {
      // Show the like immediately; the realtime refresh reconciles the row id.
      const optimisticId = `optimistic-${value}-${session.guestId}`;
      setLikes((prev) => [
        ...prev,
        { id: optimisticId, ...target, guest_id: session.guestId, wedding_id: weddingId },
      ]);
      const { error } = await supabase
        .from('likes')
        .insert({ ...target, guest_id: session.guestId, wedding_id: weddingId });
      if (error) setLikes((prev) => prev.filter((like) => like.id !== optimisticId));
      refresh();
    }
  };

  const addTargetComment = async (target, body) => {
    if (!session || !body.trim()) return;
    const { error } = await supabase.from('comments').insert({
      ...target,
      guest_id: session.guestId,
      wedding_id: weddingId,
      body: body.trim(),
    });
    if (error) throw new Error(error.message || 'Your comment could not be posted.');
    refresh();
  };

  return {
    likes,
    comments,
    loading,
    toggleLike: (mediaId) => toggleTargetLike({ media_id: mediaId }),
    addComment: (mediaId, body) => addTargetComment({ media_id: mediaId }, body),
    toggleNoteLike: (messageId) => toggleTargetLike({ message_id: messageId }),
    addNoteComment: (messageId, body) => addTargetComment({ message_id: messageId }, body),
  };
}
