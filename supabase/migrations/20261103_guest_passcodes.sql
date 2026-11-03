-- ============================================================
-- Guest passcodes (name + PIN check-in)
--
-- A guest's passcode is stored as a bcrypt hash in its own table so the public
-- `guests` select policy can never expose it (a 4-digit PIN is trivially
-- brute-forced offline if the hash leaks). Verification happens inside
-- `guest_checkin`, a SECURITY DEFINER function that also issues/restores the
-- device session token.
--
-- Safe to re-run.
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
