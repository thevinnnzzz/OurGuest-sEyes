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

-- A comment can answer another comment. Threads stay one level deep, so replies
-- always point at the thread's root comment.
alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_idx on public.comments (parent_id, created_at);

-- ------------------------------------------------------------
-- Comment likes (one per guest per comment)
-- ------------------------------------------------------------
create table if not exists public.comment_likes (
  id uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments(id) on delete cascade,
  guest_id uuid not null references public.guests(id) on delete cascade,
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, guest_id)
);

create index if not exists comment_likes_comment_idx on public.comment_likes (comment_id);
create index if not exists comment_likes_wedding_idx on public.comment_likes (wedding_id);

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
-- Notes can be liked and commented on too
-- ------------------------------------------------------------
-- A like or comment targets exactly one thing: a photo/video (`media_id`) or a
-- guestbook note (`message_id`). Mirrors migrations/20261104_note_likes_comments.sql
-- and runs after `messages` exists so the foreign key can be declared here.
alter table public.likes    alter column media_id drop not null;
alter table public.comments alter column media_id drop not null;

alter table public.likes
  add column if not exists message_id uuid references public.messages(id) on delete cascade;

alter table public.comments
  add column if not exists message_id uuid references public.messages(id) on delete cascade;

alter table public.likes drop constraint if exists likes_single_target;
alter table public.likes add constraint likes_single_target
  check ((media_id is null) <> (message_id is null));

alter table public.comments drop constraint if exists comments_single_target;
alter table public.comments add constraint comments_single_target
  check ((media_id is null) <> (message_id is null));

create unique index if not exists likes_message_guest_idx
  on public.likes (message_id, guest_id)
  where message_id is not null;

create index if not exists comments_message_idx
  on public.comments (message_id, created_at)
  where message_id is not null;

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
alter table public.comment_likes enable row level security;
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

-- Comment hearts, same rules as likes above.
create policy "public_read_comment_likes" on public.comment_likes
  for select using (
    exists (
      select 1 from public.weddings w
      where w.id = comment_likes.wedding_id and public.wedding_is_live(w)
    )
  );

create policy "guest_like_comment" on public.comment_likes
  for insert with check (
    exists (
      select 1 from public.guest_sessions s
      where s.guest_id = comment_likes.guest_id and s.wedding_id = comment_likes.wedding_id
    )
    and public.wedding_is_live(
      (select w from public.weddings w where w.id = comment_likes.wedding_id)
    )
  );

create policy "guest_unlike_comment" on public.comment_likes
  for delete using (
    exists (
      select 1 from public.guest_sessions s
      where s.guest_id = comment_likes.guest_id and s.wedding_id = comment_likes.wedding_id
    )
    and public.wedding_is_live(
      (select w from public.weddings w where w.id = comment_likes.wedding_id)
    )
  );

create policy "admin_full_comment_likes" on public.comment_likes
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

-- ============================================================
-- Guest passcodes (name + PIN check-in)
-- Mirrors supabase/migrations/20261103_guest_passcodes.sql
-- ============================================================

create table if not exists public.guest_passcodes (
  guest_id uuid primary key references public.guests(id) on delete cascade,
  passcode_hash text not null,
  updated_at timestamptz not null default now()
);

alter table public.guest_passcodes enable row level security;

drop policy if exists "admin_full_guest_passcodes" on public.guest_passcodes;
create policy "admin_full_guest_passcodes" on public.guest_passcodes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- No policy for anon: guests can only authenticate through guest_checkin().
revoke all on public.guest_passcodes from anon;
grant select, insert, update, delete on public.guest_passcodes to authenticated, service_role;

-- ------------------------------------------------------------
-- Check-in: name + passcode → session
--
-- status is one of:
--   registered  a brand-new guest row + passcode was created
--   claimed     an older guest row (from before passcodes existed) was
--               adopted by the first device to enter a passcode for it
--   restored    name + passcode matched; the existing guest and session are back
--
-- Errors are raised with P0001 so PostgREST returns the message verbatim.
-- ------------------------------------------------------------
create or replace function public.guest_checkin(
  p_slug text,
  p_name text,
  p_passcode text
)
returns table (
  status text,
  session_token uuid,
  guest_uuid uuid,
  wedding_uuid uuid,
  guest_name text,
  wedding_slug text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_wedding public.weddings%rowtype;
  v_guest public.guests%rowtype;
  v_hash text;
  v_token uuid;
  v_status text;
  v_name text := btrim(coalesce(p_name, ''));
  v_pass text := btrim(coalesce(p_passcode, ''));
  v_slug text := btrim(coalesce(p_slug, ''));
begin
  if length(v_name) < 2 then
    raise exception 'Please enter the name you checked in with.' using errcode = 'P0001';
  end if;

  if v_pass !~ '^[A-Za-z0-9]{4,12}$' then
    raise exception 'Passcodes are 4 to 12 letters or digits, with no spaces.' using errcode = 'P0001';
  end if;

  select w.* into v_wedding
  from public.weddings w
  where lower(w.slug) = lower(v_slug);

  if v_wedding.id is null then
    raise exception 'That gallery link is not valid. Please scan the QR code on your table again.' using errcode = 'P0001';
  end if;

  if v_wedding.expires_at <= now() then
    raise exception 'This gallery has closed. Thank you for celebrating with us!' using errcode = 'P0001';
  end if;

  select g.* into v_guest
  from public.guests g
  where g.wedding_id = v_wedding.id
    and lower(btrim(g.full_name)) = lower(v_name)
  limit 1;

  if v_guest.id is null then
    insert into public.guests (wedding_id, full_name)
    values (v_wedding.id, v_name)
    returning * into v_guest;

    insert into public.guest_passcodes (guest_id, passcode_hash)
    values (v_guest.id, crypt(v_pass, gen_salt('bf', 10)));

    v_status := 'registered';
  else
    select p.passcode_hash into v_hash
    from public.guest_passcodes p
    where p.guest_id = v_guest.id;

    if v_hash is null then
      -- Guest existed before passcodes were introduced: let the first device
      -- with this name pin it, then treat them as the owner of that row.
      insert into public.guest_passcodes (guest_id, passcode_hash)
      values (v_guest.id, crypt(v_pass, gen_salt('bf', 10)))
      on conflict (guest_id) do nothing;

      v_status := 'claimed';
    elsif crypt(v_pass, v_hash) = v_hash then
      v_status := 'restored';
    else
      raise exception 'Incorrect passcode for this guest name. Please check your passcode or choose a unique name.' using errcode = 'P0001';
    end if;
  end if;

  -- One session per guest (guest_id is unique). Reuse the token so a guest can
  -- keep a phone and a tablet signed in at the same time.
  select s.token into v_token
  from public.guest_sessions s
  where s.guest_id = v_guest.id;

  if v_token is null then
    insert into public.guest_sessions (guest_id, wedding_id)
    values (v_guest.id, v_wedding.id)
    returning token into v_token;
  end if;

  return query
    select v_status, v_token, v_guest.id, v_wedding.id, v_guest.full_name, v_wedding.slug;

exception
  when unique_violation then
    raise exception 'Someone just checked in with that name. Please try again.' using errcode = 'P0001';
end;
$$;

revoke all on function public.guest_checkin(text, text, text) from public;
grant execute on function public.guest_checkin(text, text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
