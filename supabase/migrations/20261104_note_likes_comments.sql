-- Guestbook notes can now be liked and commented on, just like photos and videos.
--
-- `likes` and `comments` used to require a `media_id`. Each row now points at
-- exactly one target: a media row (`media_id`) or a guestbook note
-- (`message_id`). Deleting either target still cascades to its likes/comments.

alter table public.likes    alter column media_id drop not null;
alter table public.comments alter column media_id drop not null;

alter table public.likes
  add column if not exists message_id uuid references public.messages(id) on delete cascade;

alter table public.comments
  add column if not exists message_id uuid references public.messages(id) on delete cascade;

-- Exactly one of the two targets must be set.
alter table public.likes drop constraint if exists likes_single_target;
alter table public.likes add constraint likes_single_target
  check ((media_id is null) <> (message_id is null));

alter table public.comments drop constraint if exists comments_single_target;
alter table public.comments add constraint comments_single_target
  check ((media_id is null) <> (message_id is null));

-- One like per guest per note (the existing unique (media_id, guest_id) still
-- covers photos and videos).
create unique index if not exists likes_message_guest_idx
  on public.likes (message_id, guest_id)
  where message_id is not null;

create index if not exists comments_message_idx
  on public.comments (message_id, created_at)
  where message_id is not null;
