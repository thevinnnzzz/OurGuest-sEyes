import { useState } from 'react';
import { supabase } from '../../lib/supabase.js';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      window.location.href = '/admin';
    } catch (err) {
      setError(err.message || 'Login failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-cream px-5">
      <form onSubmit={submit} className="oge-card w-full max-w-sm space-y-4 p-8">
        <h1 className="text-center font-display text-2xl font-semibold text-brown">The Owner's Key</h1>
        <p className="text-center font-script text-2xl text-rose">welcome back</p>
        <div>
          <label className="oge-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="oge-input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="oge-label" htmlFor="pw">Password</label>
          <input id="pw" type="password" className="oge-input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="rounded-xl bg-rose/10 p-3 text-center text-sm text-rose-dark">{error}</p>}
        <button type="submit" className="oge-btn-primary w-full" disabled={busy}>
          {busy ? 'Checking…' : 'Enter dashboard'}
        </button>
      </form>
    </div>
  );
}
