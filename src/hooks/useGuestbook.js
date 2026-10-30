import { useEffect, useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase.js';

/** Loads and subscribes to the guestbook letters for a wedding. */
export function useGuestbook(weddingId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!supabaseReady || !weddingId) return;
    const { data } = await supabase
      .from('messages')
      .select('*, guests!inner(full_name)')
      .eq('wedding_id', weddingId)
      .order('created_at', { ascending: false });
    if (data) setMessages(data);
    setLoading(false);
  };

  useEffect(() => {
    if (!weddingId) return undefined;
    refresh();
    const channel = supabase
      .channel(`messages-${weddingId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages', filter: `wedding_id=eq.${weddingId}` },
        () => refresh(),
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weddingId]);

  const addMessage = async (body) => {
    const sessionData = JSON.parse(
      window.sessionStorage.getItem('oge_session') ||
        window.localStorage.getItem('oge_session') || 'null',
    );
    if (!sessionData) throw new Error('No guest session');
    await supabase.from('messages').insert({
      wedding_id: weddingId,
      guest_id: sessionData.guestId,
      body: body.trim(),
    });
    refresh();
  };

  return { messages, loading, addMessage };
}
