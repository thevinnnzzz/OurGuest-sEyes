import { useState } from 'react';
import { supabase, supabaseReady } from '../lib/supabase.js';

const ORG_TYPES = [
  ['restaurant', 'Restaurant'],
  ['venue', 'Wedding venue'],
  ['coordinator', 'Event coordinator'],
  ['other', 'Other business'],
];

export default function PartnerPage() {
  const [form, setForm] = useState({ org_name: '', org_type: 'venue', contact_email: '', message: '' });
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      if (!supabaseReady) throw new Error('Database not configured.');
      const { error } = await supabase.from('inquiries').insert(form);
      if (error) throw error;
      setStatus({ ok: true, msg: 'Thank you! We will be in touch shortly to grow together.' });
      setForm({ org_name: '', org_type: 'venue', contact_email: '', message: '' });
    } catch (err) {
      setStatus({ ok: false, msg: err.message || 'Something went wrong — try again.' });
    } finally {
      setBusy(false);
    }
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-5 py-14">
      <a href="/" className="text-xs uppercase tracking-[0.2em] text-brown/60 hover:text-brown">← Back home</a>
      <h1 className="mt-6 font-display text-3xl font-semibold text-brown">Let's create something together</h1>
      <p className="mt-2 font-body text-lg text-brown/75">
        For restaurants, wedding venues, planners and event coordinators — bring a digital wedding album to every couple you celebrate.
      </p>

      <form onSubmit={submit} className="oge-card mt-8 space-y-4 p-6">
        <div>
          <label className="oge-label" htmlFor="org">Business name</label>
          <input id="org" className="oge-input" value={form.org_name} onChange={set('org_name')} required />
        </div>
        <div>
          <label className="oge-label" htmlFor="type">Who are you?</label>
          <select id="type" className="oge-input" value={form.org_type} onChange={set('org_type')}>
            {ORG_TYPES.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="oge-label" htmlFor="email">Contact email</label>
          <input id="email" type="email" className="oge-input" value={form.contact_email} onChange={set('contact_email')} required />
        </div>
        <div>
          <label className="oge-label" htmlFor="msg">Tell us more (optional)</label>
          <textarea id="msg" className="oge-input min-h-[100px]" value={form.message} onChange={set('message')} />
        </div>

        {status && (
          <p className={`rounded-xl p-3 text-sm ${status.ok ? 'bg-green-100 text-green-800' : 'bg-rose/10 text-rose-dark'}`}>
            {status.msg}
          </p>
        )}

        <button type="submit" className="oge-btn-primary w-full" disabled={busy}>
          {busy ? 'Sending…' : 'Send inquiry'}
        </button>
      </form>
    </div>
  );
}
