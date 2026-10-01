-- Package 1 (see docs/umsetzungsplan.md): kiosk flows.
--
-- DEPLOY ORDER: apply this migration right AFTER deploying the package 1 code.
-- It removes the public company list that the previous login page reads
-- directly; the new login page searches through a server function instead.

-- P13: inactivity logout for the admin area (customers already have one).
alter table public.signup_settings
  add column admin_inactivity_timeout_minutes int not null default 10;

-- P1: the full company list must no longer be readable with the public key
-- (it allowed anyone to enumerate all customers). The login search now runs
-- server-side with a minimum query length and a result limit.
drop view if exists public.companies_public;

-- The GitHub keepalive workflow pinged companies_public to keep the free
-- Supabase project from pausing. It calls this instead: touches the
-- database, returns nothing sensitive.
create or replace function public.keepalive()
returns int
language sql
stable
set search_path = ''
as $$ select 1 $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated, service_role;
