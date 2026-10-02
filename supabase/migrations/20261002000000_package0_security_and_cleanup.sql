-- Package 0 (see docs/umsetzungsplan.md):
--   P0  companies_public must be read-only
--   P16 no new reverse-charge (§13b) invoices
--   P3  construction-site suggestions limited to the customer's own sites

-- ---------------------------------------------------------------------------
-- P0: companies_public was recreated in 20260727120000 without resetting its
-- privileges. On projects that auto-grant everything to the Data API roles
-- (production), anon could therefore UPDATE/DELETE companies through this
-- owner-privileged, auto-updatable view using the public key.
-- ---------------------------------------------------------------------------

revoke all on public.companies_public from anon, authenticated;
grant select on public.companies_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- P16: all invoices carry VAT. Replaces create_invoice(bigint[], boolean);
-- existing reverse-charge invoices keep invoice_reverse_charge = true and
-- are still rendered (and cancelled) as such.
-- ---------------------------------------------------------------------------

drop function if exists public.create_invoice(bigint[], boolean);

create function public.create_invoice(p_record_ids bigint[])
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
      invoice_reverse_charge = false,
      invoiced_at = v_now
  where id = any(v_ids);

  return query select v_invoice_id, v_now;
end;
$$;

revoke all on function public.create_invoice(bigint[]) from public, anon;
grant execute on function public.create_invoice(bigint[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- P3 (interim, until construction sites get a company_id): the sites a
-- company has actually used, for the suggestion list in "Neuer Vorgang".
-- Called server-side with the service role only.
-- ---------------------------------------------------------------------------

create function public.company_construction_sites(p_company_id uuid)
returns table(id uuid, name text)
language sql
stable
security invoker
set search_path = ''
as $$
  select s.id, s.name
  from public.construction_sites s
  where exists (
    select 1 from public.records r
    where r.construction_site_id = s.id and r.company_id = p_company_id
  )
  order by s.name
$$;

revoke all on function public.company_construction_sites(uuid) from public, anon, authenticated;
grant execute on function public.company_construction_sites(uuid) to service_role;
