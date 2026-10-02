-- Grants admin rights to the production admin account. Written as a no-op on
-- databases where that auth user doesn't exist (fresh local databases), so
-- `supabase start` / `db reset` work; `npm run db:clone` brings the real
-- admin_users rows along with the production data.
insert into public.admin_users (user_id)
select id from auth.users where id = '32eff466-524c-4257-9d69-19a721c6355a'
on conflict do nothing;
