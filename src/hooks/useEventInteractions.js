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

  const toggleLike = async (mediaId) => {
    if (!session) return;
    const existing = likes.find((l) => l.media_id === mediaId && l.guest_id === session.guestId);
    if (existing) {
      setLikes((prev) => prev.filter((l) => l.id !== existing.id));
      await supabase.from('likes').delete().eq('id', existing.id);
    } else {
      await supabase
        .from('likes')
        .insert({ media_id: mediaId, guest_id: session.guestId, wedding_id: weddingId });
    }
  };

  const addComment = async (mediaId, body) => {
    if (!session || !body.trim()) return;
    await supabase.from('comments').insert({
      media_id: mediaId,
      guest_id: session.guestId,
      wedding_id: weddingId,
      body: body.trim(),
    });
    refresh();
  };

  return {
    likes,
    comments,
    loading,
    toggleLike,
    addComment,
  };
}
