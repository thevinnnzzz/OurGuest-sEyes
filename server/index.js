import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { purgeExpiredWeddings } from './purge.js';
import { destroyCloudinaryAsset } from './cloudinary.js';
import { adminSupabase } from './supabase.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'our-guests-eyes-server' });
});

// Delete a single photo/video. The browser cannot destroy Cloudinary assets
// (that needs the API secret), so the owner dashboard calls this with its
// Supabase access token and the service role does the work.
app.delete('/api/media/:id', async (req, res) => {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const { data: auth, error: authErr } = await adminSupabase.auth.getUser(token);
  if (authErr || !auth?.user) return res.status(401).json({ error: 'unauthorized' });

  const { id } = req.params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'bad_id' });
  }

  const { data: row, error: fetchErr } = await adminSupabase
    .from('media')
    .select('id, wedding_id, cloudinary_public_id, type')
    .eq('id', id)
    .maybeSingle();

  if (fetchErr) {
    console.error('[media] lookup failed:', fetchErr.message);
    return res.status(500).json({ error: 'lookup_failed', message: 'Could not look up this item.' });
  }
  if (!row) return res.status(404).json({ error: 'not_found' });

  // Remove the stored file first. If Cloudinary fails we keep the row so the
  // admin can retry, instead of leaving an asset nobody can reach again.
  let asset;
  try {
    asset = await destroyCloudinaryAsset(
      row.cloudinary_public_id,
      row.type === 'video' ? 'video' : 'image',
    );
  } catch (err) {
    console.error('[media] cloudinary delete failed:', row.cloudinary_public_id, err?.message || err);
    return res.status(502).json({
      error: 'cloudinary_failed',
      message: 'The file could not be removed from Cloudinary. Nothing was deleted — try again.',
    });
  }

  // Likes and comments reference media with on delete cascade, so they go too.
  const { error: delErr } = await adminSupabase.from('media').delete().eq('id', row.id);
  if (delErr) {
    console.error('[media] database delete failed:', delErr.message);
    return res.status(500).json({
      error: 'delete_failed',
      message: 'The file was removed but its gallery entry could not be deleted. Try again.',
    });
  }

  console.log(`[media] deleted ${row.type} ${row.id} (${row.cloudinary_public_id}) — asset ${asset}`);
  res.json({ ok: true, id: row.id, asset });
});

// Manual purge trigger (protected). Wire this to a free cron service
// (e.g. GitHub Actions or Supabase scheduled function) if you prefer cron-as-a-service.
app.post('/api/purge', async (req, res) => {
  const expected = process.env.PURGE_API_TOKEN;
  if (!expected || req.get('x-api-token') !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  try {
    const result = await purgeExpiredWeddings();
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[purge] failed:', err);
    res.status(500).json({ error: 'purge_failed', message: err.message });
  }
});

// Built-in cron: top of every hour.
cron.schedule('0 * * * *', async () => {
  try {
    console.log('[cron] running scheduled purge');
    const result = await purgeExpiredWeddings();
    if (result.purged > 0) {
      console.log(`[cron] purged ${result.purged} wedding(s):`, result.details);
    }
  } catch (err) {
    console.error('[cron] purge failed:', err);
  }
});

const port = process.env.SERVER_PORT || 4000;
app.listen(port, () => {
  console.log(`Our Guests' Eyes server listening on http://localhost:${port}`);
});
