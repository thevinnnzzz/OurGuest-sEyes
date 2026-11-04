-- Instagram-style comments: a guest can reply to a comment, and can heart any
-- comment (not just the photo/note it sits under).
--
-- Replies stay one level deep: a reply to a reply is stored against the thread's
-- root comment (`parent_id`), which is what the UI renders.

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

alter table public.comment_likes enable row level security;

-- Same shape as the likes policies: everyone on a live wedding can read, a guest
-- with a session can add/remove only their own heart, the admin can do anything.
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
