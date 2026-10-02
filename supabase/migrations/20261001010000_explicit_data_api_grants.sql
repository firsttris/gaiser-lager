-- Older Supabase projects — including production — grant the Data API roles
-- (anon, authenticated, service_role) full access to every new table via
-- default privileges, and the earlier migrations silently relied on that.
-- Newer Supabase versions (e.g. the local CLI stack) no longer do, so on a
-- fresh database the app couldn't read anything.
--
-- This makes the privileges the app needs explicit. On production every
-- statement is a no-op, because these privileges already exist there; RLS
-- policies are unchanged and still decide what each role may see.
--
-- New tables should grant their privileges explicitly in their own migration.

-- Server functions run as service_role (bypasses RLS) for customer and
-- dual-mode access.
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select, update on all sequences in schema public to service_role;

-- Admin requests run as authenticated: inserting into serial-id tables
-- (products, trucks) needs the sequences, and the admin login checks its own
-- admin_users row (RLS limits it to that row).
grant usage, select on all sequences in schema public to authenticated;
grant select on public.admin_users to authenticated;
