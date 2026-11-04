-- ============================================================
-- Guest profile: change passcode, sign out
--
-- Guests have no direct write access to `guest_passcodes` (the PIN hash must
-- never be readable by anon). These SECURITY DEFINER functions take the device's
-- session token, so only the owner of that session can change it.
--
-- Safe to re-run.
-- ============================================================

-- ------------------------------------------------------------
-- Replace the 4–12 character passcode
--
-- The stored value is a bcrypt hash, so the current one can only be verified,
-- never shown back. A guest with no passcode row yet (older accounts) can set
-- one directly.
-- ------------------------------------------------------------
create or replace function public.guest_change_passcode(
  p_token uuid,
  p_current text,
  p_new text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_guest_id uuid;
  v_hash text;
  v_current text := btrim(coalesce(p_current, ''));
  v_new text := btrim(coalesce(p_new, ''));
begin
  if v_new !~ '^[A-Za-z0-9]{4,12}$' then
    raise exception 'Passcodes are 4 to 12 letters or digits, with no spaces.' using errcode = 'P0001';
  end if;

  select s.guest_id into v_guest_id
  from public.guest_sessions s
  where s.token = p_token;

  if v_guest_id is null then
    raise exception 'Your session has expired. Please check in again.' using errcode = 'P0001';
  end if;

  select p.passcode_hash into v_hash
  from public.guest_passcodes p
  where p.guest_id = v_guest_id;

  if v_hash is null then
    insert into public.guest_passcodes (guest_id, passcode_hash)
    values (v_guest_id, crypt(v_new, gen_salt('bf', 10)));
    return;
  end if;

  if v_current = '' then
    raise exception 'Enter your current passcode to change it.' using errcode = 'P0001';
  end if;

  if crypt(v_current, v_hash) <> v_hash then
    raise exception 'That current passcode does not match the one on file.' using errcode = 'P0001';
  end if;

  update public.guest_passcodes
  set passcode_hash = crypt(v_new, gen_salt('bf', 10)),
      updated_at = now()
  where guest_id = v_guest_id;
end;
$$;

-- ------------------------------------------------------------
-- Sign out this device
--
-- The token row is deleted, so a copied token cannot be replayed. Media and
-- notes are untouched: they belong to the guest id, not the session.
-- ------------------------------------------------------------
create or replace function public.guest_sign_out(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.guest_sessions where token = p_token;
end;
$$;

revoke all on function public.guest_change_passcode(uuid, text, text) from public;
revoke all on function public.guest_sign_out(uuid) from public;

grant execute on function public.guest_change_passcode(uuid, text, text) to anon, authenticated, service_role;
grant execute on function public.guest_sign_out(uuid) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
