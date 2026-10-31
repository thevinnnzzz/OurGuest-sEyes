# Our Guests' Eyes — Wedding QR Code Photo & Video Sharing

A wedding media-sharing platform: guests scan a QR code, check in, share photos/videos, and leave keepsake letters. The gallery lives exactly 3 days from the wedding date, then everything is purged.

## Stack
- **Frontend:** React (Vite) + Tailwind CSS — `npm run dev` (http://localhost:5173)
- **Server:** Node/Express — purge cron (hourly) + manual endpoint — `npm run dev:server` (http://localhost:4000)
- **Database/Auth/RLS:** Supabase (PostgreSQL)
- **Media storage:** Cloudinary (unsigned upload presets from guests' phones)

## Setup

1. **Supabase** — create a free project, then in the SQL editor run:
   - `supabase/schema.sql` (tables, RLS, storage bucket for covers)
   - `supabase/seed.sql` (optional demo wedding)

2. **Supabase Auth** — in Dashboard → Authentication, create your owner account (email + password). Disable email confirmation for simplicity, or confirm manually.

3. **Cloudinary** — create an **unsigned** upload preset (Settings → Upload → Add upload preset → Unsigned).

4. **Environment** — copy `.env.example` to `.env` and fill in:
   ```
   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
   VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET
   SERVER_PORT, SUPABASE_SERVICE_ROLE_KEY, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, PURGE_API_TOKEN
   ```

   Deleting a photo or video goes through the Express server, since destroying a
   Cloudinary asset needs the API secret. Vite proxies `/api` to
   `http://localhost:4000` in dev; in production set `VITE_API_URL` to the
   deployed server's origin.

5. **Run** — root: `npm install && npm run dev`; server: `npm --prefix server install && npm run dev:server` (or `npm start`).

## Routes
| Route | Who | What |
|---|---|---|
| `/` | public | Landing + partnership intro |
| `/partner` | public | Partnership inquiry form |
| `/admin/login`, `/admin` | owner | Dashboard: all weddings as cards, create/edit, QR generation + PNG download, stats |
| `/w/:slug` | guests | Register (full name, duplicate-checked) → Gallery: hero, countdown, feed, likes/comments, uploads, guestbook letters, save-all ZIP |
| `POST /api/purge` (header `x-api-token`) | ops | Force-expire: deletes Cloudinary media then Supabase rows for expired weddings |
| `DELETE /api/media/:id` (owner bearer token) | owner | Delete one photo or video: removes the Cloudinary asset, then the media row (likes and comments cascade) |

## Key rules encoded
- **3-day lifespan:** `expires_at` is generated in schema as `wedding_date + 3 days` (FK cascade on delete). Guests see a live countdown banner and everything turns read-only after expiry; the hour-run cron (node-cron in `server/index.js`) purges media + rows.
- **Upload limits:** 10 photos / 5 videos per guest (floor; configurable per wedding, frontend-validated + enforced by remaining-counter).
- **Duplicate guest names:** unique index on `(wedding_id, lower(trim(full_name)))` + friendly error.
- **Filters:** CSS-only live filters (Original, HD, 90s Vintage, Retro, Sepia, Classic), chosen inside the camera before capture and stored as media metadata — files stay untouched, and no filter picker is shown in the upload sheet afterwards.

## Deliberate free-tier notes
- QR codes are generated client-side (`qrcode`, PNG download, no service).
- Save-all uses client-side `jszip`; media fetches are CORS-enabled by Cloudinary's unsigned endpoints.
- File sizes gated client-side to 20 MB (photo) / 100 MB (video), and videos to 20 seconds (duration read locally with a throwaway `<video>` element before upload).
- In-app camera (`getUserMedia` + `MediaRecorder`): tap the shutter for a photo, hold it for a video that stops itself at 20 seconds. The same CSS filter presets apply live and are stored as `filter_name`; nothing uploads until the guest taps Share.
