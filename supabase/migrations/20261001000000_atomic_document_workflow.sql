-- Moves invoice creation, cancellation and "mark as paid" into single
-- transactional Postgres functions (previously the browser fired one request
-- per record, without awaiting or error handling, so a single failed request
-- left invoices half-written), stores the date each document was issued, and
-- makes the PIN lockout race-free.

-- ---------------------------------------------------------------------------
-- Document dates
-- ---------------------------------------------------------------------------

alter table public.records add column invoiced_at timestamptz;
alter table public.records add column cancelled_at timestamptz;

-- Best-effort backfill for documents issued before this migration: the
-- default templates (RG-{JAHR}{MONAT}{TAG}-…, ST-YYYYMMDD-…) embed the issue
-- date in the number itself. Rows whose number doesn't contain a date stay
-- NULL and the PDF falls back to the download date, as it did before.
update public.records
set invoiced_at = (to_date(substring(invoice_id from '(20\d{6})'), 'YYYYMMDD') + time '12:00') at time zone 'Europe/Berlin'
where invoice_id ~ '20\d{6}' and invoiced_at is null;

update public.records
set cancelled_at = (to_date(substring(cancel_id from '(20\d{6})'), 'YYYYMMDD') + time '12:00') at time zone 'Europe/Berlin'
where cancel_id ~ '20\d{6}' and cancelled_at is null;

-- ---------------------------------------------------------------------------
-- Number formatting (mirrors src/utils/numbering-format.ts, but always uses
-- the German calendar day — the app server runs in UTC)
-- ---------------------------------------------------------------------------

create or replace function public.format_document_number(
  p_template text,
  p_counter int,
  p_padding int,
  p_at timestamptz default now()
) returns text
language sql stable
set search_path = ''
as $$
  select replace(replace(replace(replace(p_template,
    '{JAHR}',  to_char(p_at at time zone 'Europe/Berlin', 'YYYY')),
    '{MONAT}', to_char(p_at at time zone 'Europe/Berlin', 'MM')),
    '{TAG}',   to_char(p_at at time zone 'Europe/Berlin', 'DD')),
    '{NUMMER}', case
      when length(p_counter::text) >= greatest(p_padding, 1) then p_counter::text
      else lpad(p_counter::text, greatest(p_padding, 1), '0')
    end)
$$;

-- ---------------------------------------------------------------------------
-- Invoice / cancellation / payment workflow
--
-- security invoker: called with the signed-in admin's token, so the existing
-- "admins manage records" / "admins manage numbering settings" RLS policies
-- remain the access check.
-- ---------------------------------------------------------------------------

create or replace function public.create_invoice(p_record_ids bigint[], p_reverse_charge boolean default false)
returns table(document_id text, document_date timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids bigint[] := array(select distinct unnest(p_record_ids));
  v_now timestamptz := now();
  v_found int;
  v_companies int;
  v_number record;
  v_invoice_id text;
begin
  if cardinality(v_ids) = 0 then
    raise exception 'Keine Vorgänge ausgewählt.' using errcode = 'P0001';
  end if;

  perform 1 from public.records where id = any(v_ids) order by id for update;

  select count(*), count(distinct company_id) into v_found, v_companies
  from public.records
  where id = any(v_ids) and status = 'lieferschein' and invoice_id is null and cancel_id is null;

  if v_found <> cardinality(v_ids) then
    raise exception 'Nur offene Lieferscheine können abgerechnet werden.' using errcode = 'P0001';
  end if;
  if v_companies <> 1 then
    raise exception 'Alle Vorgänge einer Rechnung müssen zur gleichen Firma gehören.' using errcode = 'P0001';
  end if;

  select * into v_number from public.next_invoice_number();
  if v_number is null then
    raise exception 'Rechnungsnummer konnte nicht erzeugt werden.' using errcode = 'P0001';
  end if;
  v_invoice_id := public.format_document_number(v_number.template, v_number.counter, v_number.padding, v_now);

  update public.records
  set status = 'rechnung',
      invoice_id = v_invoice_id,
      invoice_reverse_charge = coalesce(p_reverse_charge, false),
      invoiced_at = v_now
  where id = any(v_ids);

  return query select v_invoice_id, v_now;
end;
$$;

-- Cancels exactly one document: either a set of not-yet-invoiced delivery
-- note records, or one complete invoice (all of its records).
create or replace function public.cancel_records(p_record_ids bigint[])
returns table(document_id text, document_date timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids bigint[] := array(select distinct unnest(p_record_ids));
  v_now timestamptz := now();
  v_found int;
  v_invoice_count int;
  v_uninvoiced int;
  v_invoice_id text;
  v_cancel_id text;
begin
  if cardinality(v_ids) = 0 then
    raise exception 'Keine Vorgänge ausgewählt.' using errcode = 'P0001';
  end if;

  perform 1 from public.records where id = any(v_ids) order by id for update;

  select count(*), count(distinct invoice_id), count(*) filter (where invoice_id is null), max(invoice_id)
  into v_found, v_invoice_count, v_uninvoiced, v_invoice_id
  from public.records
  where id = any(v_ids) and status <> 'storniert' and cancel_id is null;

  if v_found <> cardinality(v_ids) then
    raise exception 'Vorgänge nicht gefunden oder bereits storniert.' using errcode = 'P0001';
  end if;

  if v_invoice_id is not null then
    if v_invoice_count > 1 or v_uninvoiced > 0 then
      raise exception 'Eine Stornierung kann nur genau eine Rechnung umfassen.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.records where invoice_id = v_invoice_id and not (id = any(v_ids))) then
      raise exception 'Eine Rechnung kann nur vollständig storniert werden.' using errcode = 'P0001';
    end if;
  elsif exists (select 1 from public.records where id = any(v_ids) and status <> 'lieferschein') then
    raise exception 'Nur Lieferscheine oder Rechnungen können storniert werden.' using errcode = 'P0001';
  end if;

  v_cancel_id := 'ST-' || to_char(v_now at time zone 'Europe/Berlin', 'YYYYMMDD') || '-' || (select min(x) from unnest(v_ids) x);

  update public.records
  set status = 'storniert', cancel_id = v_cancel_id, cancelled_at = v_now
  where id = any(v_ids);

  return query select v_cancel_id, v_now;
end;
$$;

create or replace function public.mark_invoices_paid(p_invoice_ids text[])
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_ids text[] := array(select distinct unnest(p_invoice_ids));
  v_open int;
  v_updated int;
begin
  if cardinality(v_ids) = 0 then
    raise exception 'Keine Rechnungen ausgewählt.' using errcode = 'P0001';
  end if;

  perform 1 from public.records where invoice_id = any(v_ids) order by id for update;

  select count(distinct invoice_id) into v_open
  from public.records
  where invoice_id = any(v_ids) and status = 'rechnung';

  if v_open <> cardinality(v_ids)
     or exists (select 1 from public.records where invoice_id = any(v_ids) and status <> 'rechnung') then
    raise exception 'Nur offene Rechnungen können als bezahlt markiert werden.' using errcode = 'P0001';
  end if;

  update public.records set status = 'bezahlt' where invoice_id = any(v_ids);
  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Race-free PIN lockout
--
-- Each login attempt claims a slot *before* the bcrypt comparison, in one
-- locked UPDATE. Previously the failed-attempt counter was read, compared and
-- written back later, so many concurrent requests all saw "0 attempts" and
-- the lockout never kicked in. The counter now counts attempts (not just
-- failures) and is reset to 0 on a successful login.
-- ---------------------------------------------------------------------------

create or replace function public.claim_company_pin_attempt(p_company_id uuid, p_max_attempts int, p_lock_minutes int)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.companies c
  set failed_pin_attempts = n.attempts,
      pin_locked_until = case
        when n.attempts >= p_max_attempts then now() + make_interval(mins => p_lock_minutes)
        else null
      end
  from (
    select id,
      case when pin_locked_until is not null and pin_locked_until <= now() then 1 else failed_pin_attempts + 1 end as attempts
    from public.companies
    where id = p_company_id
  ) n
  where c.id = n.id
    and (c.pin_locked_until is null or c.pin_locked_until <= now());

  return found;
end;
$$;

create or replace function public.claim_master_pin_attempt(p_max_attempts int, p_lock_minutes int)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.signup_settings s
  set failed_pin_attempts = n.attempts,
      pin_locked_until = case
        when n.attempts >= p_max_attempts then now() + make_interval(mins => p_lock_minutes)
        else null
      end
  from (
    select id,
      case when pin_locked_until is not null and pin_locked_until <= now() then 1 else failed_pin_attempts + 1 end as attempts
    from public.signup_settings
    where id = true
  ) n
  where s.id = n.id
    and (s.pin_locked_until is null or s.pin_locked_until <= now());

  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sessions issued before a PIN change are no longer accepted
-- ---------------------------------------------------------------------------

alter table public.companies add column pin_changed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Customer numbers must be unique. Only enforced if the existing data already
-- satisfies it, so this migration can never fail on production data — a
-- NOTICE lists what needs cleaning up otherwise.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from public.companies where customer_number <> ''
    group by customer_number having count(*) > 1
  ) then
    raise notice 'companies.customer_number has duplicates — unique index NOT created. Fix duplicates and re-run: create unique index companies_customer_number_key on public.companies (customer_number) where customer_number <> '''';';
  else
    create unique index companies_customer_number_key on public.companies (customer_number) where customer_number <> '';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges. Supabase grants EXECUTE on new functions to anon and
-- authenticated by default; none of these are meant for anon.
-- ---------------------------------------------------------------------------

revoke all on function public.format_document_number(text, int, int, timestamptz) from public, anon;
revoke all on function public.create_invoice(bigint[], boolean) from public, anon;
revoke all on function public.cancel_records(bigint[]) from public, anon;
revoke all on function public.mark_invoices_paid(text[]) from public, anon;
revoke all on function public.claim_company_pin_attempt(uuid, int, int) from public, anon, authenticated;
revoke all on function public.claim_master_pin_attempt(int, int) from public, anon, authenticated;
revoke all on function public.next_invoice_number() from public, anon;
revoke all on function public.next_delivery_note_number() from public, anon;
revoke all on function public.next_customer_number() from public, anon;

grant execute on function public.format_document_number(text, int, int, timestamptz) to authenticated, service_role;
grant execute on function public.create_invoice(bigint[], boolean) to authenticated, service_role;
grant execute on function public.cancel_records(bigint[]) to authenticated, service_role;
grant execute on function public.mark_invoices_paid(text[]) to authenticated, service_role;
grant execute on function public.claim_company_pin_attempt(uuid, int, int) to service_role;
grant execute on function public.claim_master_pin_attempt(int, int) to service_role;
grant execute on function public.next_invoice_number() to authenticated, service_role;
grant execute on function public.next_delivery_note_number() to authenticated, service_role;
grant execute on function public.next_customer_number() to authenticated, service_role;
