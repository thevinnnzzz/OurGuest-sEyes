-- ============================================================
-- Our Guests' Eyes — Supabase schema (v1)
-- Run this in the Supabase SQL editor.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Weddings
-- ------------------------------------------------------------
create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  couple_name_1 text not null default '',
  couple_name_2 text not null default '',
  wedding_date date not null,
  cover_image_url text,
  message text,
  max_photos_per_guest int not null default 10,
  max_videos_per_guest int not null default 5,
  -- Strict 3-day policy: upload + viewing/deletion window
  expires_at timestamptz generated always as (
    (wedding_date + interval '3 days')::timestamp
      + interval '23 hours' + interval '59 minutes' + interval '59 seconds'
  ) stored,
  created_at timestamptz not null default now()
);

create index if not exists weddings_slug_idx on public.weddings (slug);

-- ------------------------------------------------------------
-- Guests (duplicate full names prevented per wedding)
-- ------------------------------------------------------------
create table if not exists public.guests (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  full_name text not null,
  created_at timestamptz not null default now(),
  constraint full_name_not_empty check (length(btrim(full_name)) > 0)
);

create unique index if not exists guests_wedding_name_unique
  on public.guests (wedding_id, lower(btrim(full_name)));

-- ------------------------------------------------------------
-- Guest sessions (secure per-device access token)
-- ------------------------------------------------------------
create table if not exists public.guest_sessions (
  token uuid primary key default gen_random_uuid(),
  guest_id uuid not null unique references public.guests(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  issued_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Media
-- ------------------------------------------------------------
create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  cloudinary_public_id text not null unique,
  url text not null,
  type text not null check (type in ('photo', 'video')),
  filter_name text,
  -- Rows shared in one upload session share this id and form one carousel post.
  batch_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists media_wedding_idx on public.media (wedding_id, created_at desc);
create index if not exists media_batch_idx on public.media (batch_id, created_at);

-- ------------------------------------------------------------
-- Likes (one per guest per media)
-- ------------------------------------------------------------
create table if not exists public.likes (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (media_id, guest_id)
);

-- ------------------------------------------------------------
-- Comments
-- ------------------------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  media_id uuid not null references public.media(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comment_not_empty check (length(btrim(body)) > 0)
);

create index if not exists comments_media_idx on public.comments (media_id, created_at);

-- ------------------------------------------------------------
-- Guestbook messages (vintage letters)
-- ------------------------------------------------------------
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint message_not_empty check (length(btrim(body)) > 0)
);

create index if not exists messages_wedding_idx on public.messages (wedding_id, created_at desc);

-- ------------------------------------------------------------
-- Partnership inquiries
-- ------------------------------------------------------------
create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  org_name text not null,
  org_type text not null check (org_type in ('restaurant', 'venue', 'coordinator', 'other')),
  contact_email text not null,
  message text,
  created_at timestamptz not null default now(),
  constraint inquiry_email_ok check (contact_email ilike '%@%')
);

-- ============================================================
-- Helper: is this wedding live (not expired)?
-- ============================================================
create or replace function public.wedding_is_live(w public.weddings)
returns boolean
language sql
stable
as $$
  select w.expires_at > now()
$$;

-- ============================================================
-- Privileges
-- RLS only filters rows the role is already allowed to touch, so the
-- API roles need table privileges. Without this block every request
-- fails with "permission denied for table ..." (42501).
-- ============================================================
grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.weddings      enable row level security;
alter table public.guests        enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.media         enable row level security;
alter table public.likes         enable row level security;
alter table public.comments      enable row level security;
alter table public.messages      enable row level security;
alter table public.inquiries     enable row level security;

-- Admin (Supabase authenticated user) does everything on weddings.
-- Public can READ live weddings by slug (needed by QR guest flow).
create policy "admin_full_weddings" on public.weddings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public_read_live_weddings" on public.weddings
  for select using (public.wedding_is_live(weddings));

-- Guests: public can insert a guest row (registration) only for live weddings.
create policy "public_register_guest" on public.guests
  for insert with check (
    exists (
      select 1 from public.weddings w
      where w.id = guests.wedding_id and public.wedding_is_live(w)
    )
  );

create policy "admin_full_guests" on public.guests
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "public_read_guests_of_live" on public.guests
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = guests.wedding_id and public.wedding_is_live(w)
    )
  );

-- Sessions: public can create one for a fresh guest registration;
-- public can read (validate a token) but only for live weddings.
create policy "public_create_session" on public.guest_sessions
  for insert with check (
    exists (
      select 1 from public.weddings w
      where w.id = guest_sessions.wedding_id and public.wedding_is_live(w)
    )
  );

create policy "public_read_session" on public.guest_sessions
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = guest_sessions.wedding_id and public.wedding_is_live(w)
    )
  );

create policy "admin_full_sessions" on public.guest_sessions
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Media
create policy "public_read_media_of_live" on public.media
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = media.wedding_id and public.wedding_is_live(w)
    )
  );

create policy "guest_insert_media" on public.media
  for insert with check (
    public.wedding_is_live(
      (select w from public.weddings w where w.id = media.wedding_id)
    )
    and exists (
      select 1 from public.guest_sessions s
      where s.guest_id = media.guest_id and s.wedding_id = media.wedding_id
    )
  );

create policy "admin_full_media" on public.media
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Likes
create policy "public_read_likes" on public.likes
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = likes.wedding_id and public.wedding_is_live(w)
    )
  );

create policy "guest_like" on public.likes
  for insert with check (
    exists (
      select 1 from public.guest_sessions s
      where s.guest_id = likes.guest_id and s.wedding_id = likes.wedding_id
    )
    and public.wedding_is_live(
      (select w from public.weddings w where w.id = likes.wedding_id)
    )
  );

create policy "guest_unlike" on public.likes
  for delete using (
    exists (
      select 1 from public.guest_sessions s
      where s.guest_id = likes.guest_id and s.wedding_id = likes.wedding_id
    )
    and public.wedding_is_live(
      (select w from public.weddings w where w.id = likes.wedding_id)
    )
  );

create policy "admin_full_likes" on public.likes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Comments
create policy "public_read_comments" on public.comments
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = comments.wedding_id and public.wedding_is_live(w)
    )
  );

create policy "guest_comment" on public.comments
  for insert with check (
    exists (
      select 1 from public.guest_sessions s
      where s.guest_id = comments.guest_id and s.wedding_id = comments.wedding_id
    )
    and public.wedding_is_live(
      (select w from public.weddings w where w.id = comments.wedding_id)
    )
  );

create policy "admin_full_comments" on public.comments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Messages
create policy "public_read_messages" on public.messages
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = messages.wedding_id and public.wedding_is_live(w)
    )
  );

create policy "guest_message" on public.messages
  for insert with check (
    exists (
      select 1 from public.guest_sessions s
      where s.guest_id = messages.guest_id and s.wedding_id = messages.wedding_id
    )
    and public.wedding_is_live(
      (select w from public.weddings w where w.id = messages.wedding_id)
    )
  );

create policy "admin_full_messages" on public.messages
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Inquiries: anonymous can only create; admin can read all.
create policy "public_create_inquiry" on public.inquiries
  for insert with check (true);

create policy "admin_read_inquiries" on public.inquiries
  for select using (auth.role() = 'authenticated');

-- ============================================================
-- Storage bucket for cover images (optional — admin only uploads)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('covers', 'covers', true)
on conflict (id) do nothing;

create policy "public_cover_read" on storage.objects
  for select using (bucket_id = 'covers');

create policy "admin_cover_write" on storage.objects
  for insert with check (bucket_id = 'covers' and auth.role() = 'authenticated');

-- ============================================================
-- purge_expired_events(): helper function used by server purge job
-- Returns wedings past their expiry. Media deletion from
-- Cloudinary happens server-side (service role + admin API).
-- ============================================================
create or replace function public.pending_expired_weddings()
returns setof public.weddings
language sql
stable
security definer
as $$
  select * from public.weddings where expires_at < now();
$$;
