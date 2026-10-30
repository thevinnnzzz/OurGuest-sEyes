import { useState } from 'react';
import Modal from '../ui/Modal.jsx';
import { supabase } from '../../lib/supabase.js';
import { MIN_PHOTOS, MIN_VIDEOS } from '../../lib/constants.js';

const slugify = (s) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);

export default function WeddingForm({ open, onClose, wedding, onSaved }) {
  const editing = Boolean(wedding);
  const [form, setForm] = useState(
    editing
      ? {
          slug: wedding.slug,
          couple_name_1: wedding.couple_name_1,
          couple_name_2: wedding.couple_name_2,
          wedding_date: wedding.wedding_date,
          message: wedding.message || '',
          max_photos_per_guest: wedding.max_photos_per_guest,
          max_videos_per_guest: wedding.max_videos_per_guest,
        }
      : { slug: '', couple_name_1: '', couple_name_2: '', wedding_date: '', message: '', max_photos_per_guest: MIN_PHOTOS, max_videos_per_guest: MIN_VIDEOS },
  );
  const [coverFile, setCoverFile] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const slugPreview = form.slug || slugify(`${form.couple_name_1}-${form.couple_name_2}`);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let payload = {
        couple_name_1: form.couple_name_1.trim(),
        couple_name_2: form.couple_name_2.trim(),
        wedding_date: form.wedding_date,
        message: form.message.trim(),
        max_photos_per_guest: Math.max(MIN_PHOTOS, parseInt(form.max_photos_per_guest, 10) || MIN_PHOTOS),
        max_videos_per_guest: Math.max(MIN_VIDEOS, parseInt(form.max_videos_per_guest, 10) || MIN_VIDEOS),
      };

      // Optional cover photo upload (stored in public "covers" bucket)
      if (coverFile) {
        const ext = coverFile.name.split('.').pop();
        const path = `${slugPreview}-${Date.now()}.${ext.replace(/[^a-z0-9]/gi, '') || 'jpg'}`;
        const { error: upErr } = await supabase.storage.from('covers').upload(path, coverFile, { upsert: true });
        if (!upErr) {
          const { data } = supabase.storage.from('covers').getPublicUrl(path);
          payload.cover_image_url = data.publicUrl;
        } else if (upErr.message.includes('Bucket not found')) {
          console.warn('covers bucket missing — run the storage section of schema.sql');
        } else {
          throw upErr;
        }
      }

      if (editing) {
        const { error: err } = await supabase.from('weddings').update(payload).eq('id', wedding.id);
        if (err) throw err;
      } else {
        payload.slug = slugify(slugPreview) || `wedding-${Date.now()}`;
        const { error: err } = await supabase.from('weddings').insert(payload);
        if (err) {
          if (err.code === '23505') throw new Error('That URL name is taken — pick another.');
          throw err;
        }
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={busy ? undefined : onClose} title={editing ? 'Configure wedding' : 'A new love story'} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="oge-label" htmlFor="cn1">Partner one</label>
            <input id="cn1" className="oge-input" value={form.couple_name_1} onChange={set('couple_name_1')} required />
          </div>
          <div>
            <label className="oge-label" htmlFor="cn2">Partner two</label>
            <input id="cn2" className="oge-input" value={form.couple_name_2} onChange={set('couple_name_2')} />
          </div>
        </div>

        <div>
          <label className="oge-label" htmlFor="wd">Wedding date</label>
          <input id="wd" type="date" className="oge-input" value={form.wedding_date} onChange={set('wedding_date')} required />
          <p className="mt-1 text-xs text-brown/55">
            The upload + viewing window open on this date and everything expires & is deleted exactly 3 days after.
          </p>
        </div>

        {!editing && (
          <div>
            <label className="oge-label" htmlFor="slug">Guest link name</label>
            <input
              id="slug"
              className="oge-input"
              placeholder={slugPreview || 'auto-generated'}
              value={form.slug}
              onChange={set('slug')}
              pattern="[a-z0-9-]*"
              title="lowercase letters, numbers and dashes only"
            />
            <p className="mt-1 text-xs text-brown/55">Guests will see: {import.meta.env.VITE_APP_URL || window.location.origin}/w/{slugify(slugPreview) || '…'}</p>
          </div>
        )}

        <div>
          <label className="oge-label" htmlFor="msg">Note from the couple</label>
          <textarea id="msg" className="oge-input min-h-[80px]" value={form.message} onChange={set('message')} placeholder="A warm welcome for your guests…" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="oge-label" htmlFor="mp">Max photos per guest</label>
            <input id="mp" type="number" min={MIN_PHOTOS} className="oge-input" value={form.max_photos_per_guest} onChange={set('max_photos_per_guest')} />
            <p className="mt-1 text-xs text-brown/55">Floor {MIN_PHOTOS} (default)</p>
          </div>
          <div>
            <label className="oge-label" htmlFor="mv">Max videos per guest</label>
            <input id="mv" type="number" min={MIN_VIDEOS} className="oge-input" value={form.max_videos_per_guest} onChange={set('max_videos_per_guest')} />
            <p className="mt-1 text-xs text-brown/55">Floor {MIN_VIDEOS} (default)</p>
          </div>
        </div>

        <div>
          <label className="oge-label" htmlFor="cover">Cover photo (optional)</label>
          <input
            id="cover"
            type="file"
            accept="image/*"
            className="block w-full text-sm text-brown/70 file:mr-3 file:rounded-full file:border-0 file:bg-brown/10 file:px-4 file:py-2 file:text-sm file:text-brown"
            onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
          />
        </div>

        {error && <p className="rounded-xl bg-rose/10 p-3 text-sm text-rose-dark">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="oge-btn-outline" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="oge-btn-primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save changes' : 'Create wedding'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
