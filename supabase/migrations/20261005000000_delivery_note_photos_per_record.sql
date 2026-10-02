-- Delivery-note photos belong to a Vorgang: drivers attach them only while
-- booking LKW-Stunden (no separate upload page any more).
--
-- DEPLOY ORDER: apply BEFORE deploying the code. Photos uploaded earlier keep
-- record_id = NULL and still show up in the admin inbox.

alter table public.delivery_note_photos
  add column record_id bigint references public.records(id) on delete cascade;

create index delivery_note_photos_record_id_idx on public.delivery_note_photos (record_id);
