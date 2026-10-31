import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { purgeExpiredWeddings } from './purge.js';
import { deleteMediaById } from '../shared/deleteMedia.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'our-guests-eyes-server' });
});

// Delete a single photo/video. The browser cannot destroy Cloudinary assets
// (that needs the API secret), so the owner dashboard sends its Supabase access
// token and this server does the work. The Netlify function in
// netlify/functions/media-delete.js runs the same shared logic in production.
app.delete('/api/media/:id', async (req, res) => {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'unauthorized', message: 'Sign in again to delete media.' });

  try {
    const result = await deleteMediaById(req.params.id, token);
    res.json({ ok: true, ...result });
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error('[media] delete failed:', err.message);
    res.status(status).json({
      error: err.code || 'delete_failed',
      message: err.message || 'Could not delete this item.',
    });
  }
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
