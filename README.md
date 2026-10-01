# Gaiser Lager

Kundenportal und Verwaltung für das Lager der Gaiser GmbH Erdbau und Abbruch:
Kunden legen Abhol-, Anlieferungs- und LKW-Vorgänge an und laden ihre
Lieferscheine/Rechnungen herunter; im Admin-Bereich werden Vorgänge
abgerechnet, storniert und Stammdaten (Material, LKW, Kunden, Baustellen)
gepflegt.

Stack: TanStack Start (React 19, Router, Query), Tailwind CSS, Supabase
(Postgres + Auth), jsPDF für die Dokumente, Deployment auf Vercel (Nitro).

## Entwicklung

Entwickelt wird ausschließlich gegen eine **lokale Supabase** (Docker oder
Podman). Die Produktion wird lokal nie beschrieben.

```bash
npm install
npm run db:start   # lokale Supabase starten, schreibt .env mit den lokalen Keys
npm run db:clone   # optional: aktuellen Datenstand der Produktion lokal einspielen
npm run dev        # http://localhost:3000
```

| Befehl | Was passiert |
| --- | --- |
| `npm run db:start` / `db:stop` | lokale Supabase starten/stoppen |
| `npm run db:reset` | lokale DB leer aus `supabase/migrations/` neu aufbauen |
| `npm run db:clone` | Produktion **nur lesend** per `pg_dump` auslesen, lokale DB zurücksetzen und die Daten einspielen (inkl. Admin-Logins und Materialbilder) |
| `npm test`, `npx tsc --noEmit`, `npm run build` | Tests, Typecheck, Build |

Nach `db:clone` gelten dieselben Logins wie in der Produktion (Kunden-PINs,
Admin-Passwort). Zusätzlich gibt es lokal immer den Admin
`admin@gaiser.local` / `entwicklung`.

### Schutz vor Verwechslungen

- `.env` enthält nur die lokale Datenbank. `npm run dev` startet nicht,
  wenn sie auf eine entfernte Datenbank zeigt (Notausgang:
  `ALLOW_PRODUCTION_DB=1 npm run dev`, dann mit rotem Warnbanner).
- Die Produktions-Zugangsdaten für `db:clone` liegen in `.env.prod`
  (git-ignoriert, siehe `.env.prod.example`). Vite liest diese Datei nie.
- Alle schreibenden Befehle in `scripts/db.mjs` prüfen, dass das Ziel
  `127.0.0.1` ist, und rufen die Supabase CLI nur mit `--local` auf. Wichtig,
  weil das Repo per `supabase link` mit der Produktion verknüpft ist: ein
  `supabase db reset --linked` würde die Produktion löschen — nie von Hand
  ausführen.
- Gegen die lokale DB zeigt die App einen gelben Banner „Entwicklung“,
  `[DEV]` im Tab-Titel, und alle PDFs tragen das Wasserzeichen
  „ENTWICKLUNG – kein gültiger Beleg“.

### Hinweise

- Die Supabase CLI ist auf `2.109.1` festgelegt: neuere Versionen übergeben
  unter Podman die Container-Umgebungsvariablen nicht (Datenbank startet nicht).
- Unter Podman setzt `scripts/db.mjs` `DOCKER_HOST` automatisch auf
  `$XDG_RUNTIME_DIR/podman/podman.sock`.

## Architektur in Kürze

- **Admins** melden sich über Supabase Auth an; ihre Server-Funktionen laufen
  mit dem Admin-Token, Row Level Security ist die eigentliche Prüfung.
- **Kunden** melden sich mit Firma + 4-stelliger PIN an (eigenes,
  verschlüsseltes Session-Cookie). Ihre Server-Funktionen laufen mit dem
  Service-Key und filtern selbst auf die eigene Firma (`requireAnySession`).
  Eine PIN-Änderung macht bestehende Kunden-Sessions ungültig.
- **Rechnung erstellen, Stornieren, Als bezahlt markieren** laufen jeweils als
  eine Transaktion in Postgres (`create_invoice`, `cancel_records`,
  `mark_invoices_paid`); erst danach wird das PDF erzeugt.
- **Datumsangaben** werden immer in deutscher Zeit (`Europe/Berlin`)
  angezeigt, gefiltert und in Belegnummern eingesetzt, unabhängig von der
  Zeitzone des Servers (`src/utils/berlin-time.ts`).
- **Vorgänge** speichern Produkt-, Baustellen- und Firmennamen als Kopie.
  Umbenennungen in den Stammdaten wirken nur auf noch nicht abgerechnete
  Vorgänge, gestellte Rechnungen bleiben unverändert.

## Datenbank

Das Schema liegt vollständig in `supabase/migrations/`. Ablauf für Änderungen:

1. Migration anlegen und lokal testen (`npm run db:reset`, besser
   `npm run db:clone`, dann läuft sie gegen echte Daten).
2. In der Produktion ein Backup ziehen (Admin → Einstellungen → SQL-Backup).
3. Migration in die Produktion einspielen (`npx supabase db push`),
   **danach** den Code deployen.

Neue Tabellen müssen ihre Rechte für `service_role`/`authenticated` selbst
vergeben (`grant …`): neuere Supabase-Versionen tun das nicht mehr
automatisch.

In Produktion laufen die Umgebungsvariablen über Vercel
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
`SESSION_SECRET`).

Die GitHub Action `supabase-keepalive.yml` verhindert, dass das kostenlose
Supabase-Projekt nach 7 Tagen Inaktivität pausiert.
