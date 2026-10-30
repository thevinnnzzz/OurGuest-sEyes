-- Optional caption shown under each post in the guest feeds.
-- Safe to re-run; the app falls back to caption-less inserts if this has not
-- been applied yet, so uploads never break.
alter table public.media add column if not exists caption text;
