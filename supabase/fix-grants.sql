-- ============================================================
-- Fix: "permission denied for table ..." (Postgres error 42501)
--
-- The tables in schema.sql were created without granting privileges
-- to the API roles, so PostgREST rejects every request — the owner
-- dashboard cannot list or create weddings, and guests cannot enter.
-- Paste this into the Supabase SQL editor and run it once.
-- It is idempotent.
-- ============================================================

grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- Ask PostgREST to pick up the new privileges immediately.
notify pgrst, 'reload schema';
