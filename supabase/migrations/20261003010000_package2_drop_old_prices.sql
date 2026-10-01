-- Package 2, part B (see docs/umsetzungsplan.md, P8): remove the old
-- private/business prices and the customer's price category. The single
-- `price` column (filled from the business price) replaced them.
--
-- DEPLOY ORDER: apply AFTER deploying the new code — the old code still
-- reads these columns. Not reversible; back up first.

alter table public.products
  drop column pickup_private_price,
  drop column pickup_business_price,
  drop column dropoff_private_price,
  drop column dropoff_business_price;

alter table public.trucks
  drop column private_price,
  drop column business_price;

alter table public.companies drop column price_category;
