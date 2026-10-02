-- Package 5 (see docs/umsetzungsplan.md, P10): sending invoices and
-- Stornorechnungen by e-mail.
--
-- DEPLOY ORDER: apply BEFORE deploying the package 5 code (new tables only,
-- the old code ignores them).

-- SMTP access and the mail template. A single row. Only the server (service
-- role) reads it: the SMTP password is stored encrypted (AES-256-GCM, key
-- derived from SESSION_SECRET) and never sent to the browser.
create table public.email_settings (
  id                       boolean primary key default true check (id),
  smtp_host                text not null default '',
  smtp_port                int not null default 587 check (smtp_port between 1 and 65535),
  -- starttls = port 587, tls = port 465 (implicit TLS)
  smtp_security            text not null default 'starttls' check (smtp_security in ('starttls', 'tls')),
  smtp_user                text not null default '',
  smtp_password_encrypted  text,
  from_name                text not null default 'Gaiser GmbH Erdbau und Abbruch',
  from_address             text not null default '',
  reply_to                 text not null default '',
  -- Copy of every invoice mail, e.g. for the office archive. Empty = none.
  bcc                      text not null default '',
  invoice_subject_template text not null default 'Rechnung {RECHNUNGSNUMMER} – Gaiser GmbH',
  invoice_body_template    text not null default
'Sehr geehrte Damen und Herren,

anbei erhalten Sie unsere Rechnung {RECHNUNGSNUMMER} vom {RECHNUNGSDATUM} über {BETRAG} für das Bauvorhaben {BAUVORHABEN}.

Bitte überweisen Sie den Betrag bis zum {FAELLIG_AM} unter Angabe der Rechnungsnummer.

Die Rechnung ist eine E-Rechnung im ZUGFeRD-Format: Das PDF enthält die Rechnungsdaten zusätzlich als XML.

Mit freundlichen Grüßen
Gaiser GmbH Erdbau und Abbruch
Hansjakobweg 14, 77830 Bühlertal
Tel. +49 170 2416906 · info@gaiser-abbruch.de',
  cancellation_subject_template text not null default 'Stornorechnung {STORNONUMMER} zu Rechnung {RECHNUNGSNUMMER} – Gaiser GmbH',
  cancellation_body_template text not null default
'Sehr geehrte Damen und Herren,

anbei erhalten Sie unsere Stornorechnung {STORNONUMMER} vom {STORNODATUM}. Sie hebt unsere Rechnung {RECHNUNGSNUMMER} vom {RECHNUNGSDATUM} über {BETRAG} vollständig auf.

Bitte buchen Sie die Rechnung {RECHNUNGSNUMMER} entsprechend aus.

Die Stornorechnung ist eine E-Rechnung im ZUGFeRD-Format: Das PDF enthält die Daten zusätzlich als XML.

Mit freundlichen Grüßen
Gaiser GmbH Erdbau und Abbruch
Hansjakobweg 14, 77830 Bühlertal
Tel. +49 170 2416906 · info@gaiser-abbruch.de',
  updated_at               timestamptz not null default now()
);

insert into public.email_settings (id) values (true);

alter table public.email_settings enable row level security;
revoke all on public.email_settings from anon, authenticated;
grant select, insert, update on public.email_settings to service_role;

-- Every send attempt; the invoice list shows "gesendet am" from here.
-- invoice_id is always the invoice; document_kind says whether the invoice
-- itself or its Stornorechnung was sent.
create table public.invoice_emails (
  id            bigint generated always as identity primary key,
  invoice_id    text not null,
  document_kind text not null default 'invoice' check (document_kind in ('invoice', 'cancellation')),
  company_id  uuid references public.companies(id) on delete set null,
  recipient   text not null,
  bcc         text not null default '',
  subject     text not null,
  e_invoice   boolean not null,
  status      text not null check (status in ('sent', 'failed')),
  error       text,
  message_id  text,
  sent_at     timestamptz not null default now()
);

create index invoice_emails_invoice_id_idx on public.invoice_emails (invoice_id, document_kind, sent_at desc);

alter table public.invoice_emails enable row level security;
revoke all on public.invoice_emails from anon, authenticated;
grant select, insert on public.invoice_emails to service_role;

-- Admin "Passwort vergessen": every request, for the rate limit (rows older
-- than a day are deleted on the next request).
create table public.password_reset_requests (
  id           bigint generated always as identity primary key,
  email        text not null,
  requested_at timestamptz not null default now()
);

create index password_reset_requests_email_idx on public.password_reset_requests (lower(email), requested_at desc);

alter table public.password_reset_requests enable row level security;
revoke all on public.password_reset_requests from anon, authenticated;
grant select, insert, delete on public.password_reset_requests to service_role;
