-- Package 4 (see docs/umsetzungsplan.md):
--   P3  construction sites belong to exactly one company
--   P19 employee (truck driver) logins, "booked by" on records,
--       delivery-note photos from landfills etc.
--
-- DEPLOY ORDER: apply BEFORE deploying the package 4 code. Back up first and
-- test against `npm run db:clone` — the construction-site part moves data.

-- ===========================================================================
-- P3: construction sites per company
-- ===========================================================================

alter table public.construction_sites
  add column company_id uuid references public.companies(id) on delete cascade;

-- Names are no longer unique across all companies (two companies may build
-- at the same address); drop the old global index before copying sites.
drop index if exists public.construction_sites_name_lower_idx;

-- 1. Sites used by exactly one company belong to that company.
update public.construction_sites s
set company_id = used.company_id
from (
  select construction_site_id, (array_agg(distinct company_id))[1] as company_id
  from public.records
  where construction_site_id is not null
  group by construction_site_id
  having count(distinct company_id) = 1
) used
where used.construction_site_id = s.id;

-- 2. Sites shared by several companies: the first company (lowest id) keeps
--    the site, every other company gets its own copy and its records are
--    moved over. The name snapshot on the records stays untouched, so issued
--    invoices don't change.
do $$
declare
  shared record;
  v_new_site uuid;
  v_first_company uuid;
begin
  for shared in
    select construction_site_id as site_id,
           array_agg(distinct company_id order by company_id) as companies
    from public.records
    where construction_site_id is not null
    group by construction_site_id
    having count(distinct company_id) > 1
  loop
    v_first_company := shared.companies[1];
    update public.construction_sites set company_id = v_first_company where id = shared.site_id;

    for i in 2..cardinality(shared.companies) loop
      insert into public.construction_sites (name, company_id)
      select name, shared.companies[i] from public.construction_sites where id = shared.site_id
      returning id into v_new_site;

      update public.records
      set construction_site_id = v_new_site
      where construction_site_id = shared.site_id and company_id = shared.companies[i];
    end loop;
  end loop;
end;
$$;

-- 3. Sites nobody ever used (e.g. the examples from the initial setup) are
--    deleted (decided with Gaiser: customers simply enter them again and
--    they get assigned). No record references them, see steps 1 and 2.
delete from public.construction_sites where company_id is null;

alter table public.construction_sites alter column company_id set not null;

create unique index construction_sites_company_name_idx
  on public.construction_sites (company_id, lower(name));
create index construction_sites_company_id_idx on public.construction_sites (company_id);

-- The interim lookup from package 0 is replaced by the company_id column.
drop function if exists public.company_construction_sites(uuid);

-- ===========================================================================
-- P19: employees (truck drivers)
-- ===========================================================================

create table public.employees (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  pin_hash            text not null,
  active              boolean not null default true,
  failed_pin_attempts int not null default 0,
  pin_locked_until    timestamptz,
  pin_changed_at      timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create unique index employees_name_lower_idx on public.employees (lower(name));

create trigger employees_set_updated_at
  before update on public.employees
  for each row execute function public.set_updated_at();

alter table public.employees enable row level security;
revoke all on public.employees from anon, authenticated;
grant select, insert, update on public.employees to authenticated;
grant select, insert, update, delete on public.employees to service_role;
create policy "admins manage employees" on public.employees for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Who booked a record (NULL = the customer or an admin). The name is a
-- snapshot like company_name, so it survives renaming/deactivating.
alter table public.records add column created_by_employee_id uuid references public.employees(id);
alter table public.records add column created_by_name text;
create index records_created_by_employee_id_idx on public.records (created_by_employee_id);

-- Same race-free lockout as for customer PINs (claim_company_pin_attempt).
create or replace function public.claim_employee_pin_attempt(p_employee_id uuid, p_max_attempts int, p_lock_minutes int)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.employees e
  set failed_pin_attempts = n.attempts,
      pin_locked_until = case
        when n.attempts >= p_max_attempts then now() + make_interval(mins => p_lock_minutes)
        else null
      end
  from (
    select id,
      case when pin_locked_until is not null and pin_locked_until <= now() then 1 else failed_pin_attempts + 1 end as attempts
    from public.employees
    where id = p_employee_id and active
  ) n
  where e.id = n.id
    and (e.pin_locked_until is null or e.pin_locked_until <= now());

  return found;
end;
$$;

revoke all on function public.claim_employee_pin_attempt(uuid, int, int) from public, anon, authenticated;
grant execute on function public.claim_employee_pin_attempt(uuid, int, int) to service_role;

-- ===========================================================================
-- P19: delivery-note photos (Eingangskorb fürs Büro)
-- ===========================================================================

create table public.delivery_note_photos (
  id              uuid primary key default gen_random_uuid(),
  -- Photos taken in one go (one upload session) share a batch id.
  batch_id        uuid not null,
  storage_path    text not null unique,
  employee_id     uuid references public.employees(id),
  employee_name   text,
  company_id      uuid references public.companies(id) on delete set null,
  company_name    text,
  note            text not null default '',
  created_at      timestamptz not null default now(),
  processed_at    timestamptz
);
create index delivery_note_photos_created_at_idx on public.delivery_note_photos (created_at desc);
create index delivery_note_photos_batch_idx on public.delivery_note_photos (batch_id);

alter table public.delivery_note_photos enable row level security;
revoke all on public.delivery_note_photos from anon, authenticated;
grant select, update on public.delivery_note_photos to authenticated;
grant select, insert, update, delete on public.delivery_note_photos to service_role;
create policy "admins manage delivery note photos" on public.delivery_note_photos for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

-- Private bucket: photos are only ever served through short-lived signed URLs
-- created on the server for admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('delivery-note-photos', 'delivery-note-photos', false, 10485760, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;
