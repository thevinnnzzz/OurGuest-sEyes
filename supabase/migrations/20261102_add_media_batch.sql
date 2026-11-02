-- Media shared in one upload session forms a single post with a swipeable
-- carousel. Safe to re-run; the app falls back to caption-less / batch-less
-- inserts if this has not been applied yet, so uploads never break.
alter table public.media add column if not exists batch_id uuid;

create index if not exists media_batch_idx on public.media (batch_id, created_at);
