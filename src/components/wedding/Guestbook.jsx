import { useState } from 'react';
import EmptyState from '../ui/EmptyState.jsx';
import LetterCard from './LetterCard.jsx';

export default function Guestbook({ messages, loading, canWrite, onSubmit }) {
  const [form, setForm] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.trim()) return;
    setSending(true);
    try {
      await onSubmit(form.trim());
      setForm('');
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } finally {
      setSending(false);
    }
  };

  return (
    <section id="guestbook" className="space-y-5">
      <div className="text-center">
        <h2 className="font-display text-2xl font-semibold text-brown">Letters to the Newlyweds</h2>
        <p className="mt-1 font-script text-3xl text-rose">leave a keepsake</p>
      </div>

      {canWrite && (
        <form onSubmit={handleSubmit} className="oge-card p-4">
          <textarea
            value={form}
            onChange={(e) => setForm(e.target.value)}
            className="oge-input min-h-[110px] resize-y bg-transparent font-script text-2xl leading-relaxed"
            placeholder="Write from your heart…"
            maxLength={1000}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-brown/50">{form.length}/1000</span>
            <button type="submit" className="oge-btn-primary" disabled={sending || !form.trim()}>
              {sending ? 'Sealing…' : 'Seal my letter'}
            </button>
          </div>
          {done && <p className="mt-2 text-center text-sm text-rose-dark">Your letter is in the mail. ♥</p>}
        </form>
      )}
      {loading ? (
        <p className="py-6 text-center text-sm text-brown/60">Opening the letters…</p>
      ) : messages.length === 0 ? (
        <EmptyState icon="✉️" title="No letters yet" subtitle="Your note will be the first keepsake here." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {messages.map((m) => (
            <LetterCard
              key={m.id}
              message={m}
              author={m.guests?.full_name || 'Kind guest'}
              date={m.created_at}
            />
          ))}
        </div>
      )}
    </section>
  );
}
