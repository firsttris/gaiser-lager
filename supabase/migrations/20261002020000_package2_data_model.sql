-- Package 2 (see docs/umsetzungsplan.md): data model cleanup.
--
-- DEPLOY ORDER: apply BEFORE deploying the package 2 code. The old code keeps
-- working with this migration in place (old columns stay until a later
-- migration removes them).

-- ---------------------------------------------------------------------------
-- P8: one price per product/truck — the former business price. All customers
-- are businesses; the private price and the customer's price category go away.
-- ---------------------------------------------------------------------------

alter table public.products add column price double precision not null default 0;
update public.products
set price = case when flow = 'pickup' then pickup_business_price else dropoff_business_price end;

alter table public.trucks add column price double precision not null default 0;
update public.trucks set price = business_price;

-- New code no longer sends a price category; keep inserts valid until the
-- column is dropped in a follow-up migration.
alter table public.companies alter column price_category set default 'business';

-- ---------------------------------------------------------------------------
-- P9: e-mail address for sending invoices (optional in the database because
-- existing customers don't have one yet; required in the forms).
-- ---------------------------------------------------------------------------

alter table public.companies add column email text;

-- ---------------------------------------------------------------------------
-- P14: configurable customer numbers. Gaiser assigns plain numbers by hand
-- (10295, 10398, …); automatic numbers continue at 10600.
-- ---------------------------------------------------------------------------

alter table public.numbering_settings add column customer_number_template text not null default '{NUMMER}';
update public.numbering_settings set customer_number_template = '{NUMMER}', next_customer_number = 10600;

-- Next automatic customer number, skipping numbers that were already given
-- out by hand. Atomic like the other counters.
create or replace function public.next_free_customer_number()
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_template text;
  v_counter int;
  v_number text;
begin
  for i in 1..10000 loop
    update public.numbering_settings
    set next_customer_number = next_customer_number + 1
    where id = true
    returning customer_number_template, next_customer_number - 1 into v_template, v_counter;

    v_number := public.format_document_number(v_template, v_counter, 1);
    if not exists (select 1 from public.companies where customer_number = v_number) then
      return v_number;
    end if;
  end loop;
  raise exception 'Keine freie Kundennummer gefunden.' using errcode = 'P0001';
end;
$$;

revoke all on function public.next_free_customer_number() from public, anon, authenticated;
grant execute on function public.next_free_customer_number() to service_role;

-- Highest plain-number customer number, shown in Settings as a hint when
-- choosing the next number.
create or replace function public.highest_customer_number()
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select max(customer_number::bigint) from public.companies where customer_number ~ '^\d{1,18}$'
$$;

revoke all on function public.highest_customer_number() from public, anon;
grant execute on function public.highest_customer_number() to authenticated, service_role;
