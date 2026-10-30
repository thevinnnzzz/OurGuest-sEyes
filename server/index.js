import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { purgeExpiredWeddings } from './purge.js';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'our-guests-eyes-server' });
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
