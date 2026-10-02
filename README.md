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
| `npm run db:clone` | Produktion **nur lesend** auslesen und lokal einspielen (inkl. Admin-Logins und Materialbilder). Gleichzeitig **Generalprobe fürs Deployment**: lokal wird nur der Migrationsstand der Produktion aufgebaut, die Daten geladen und danach die noch nicht eingespielten Migrationen darüber ausgeführt |
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
- E-Mails (Rechnungsversand, Testmail) gehen gegen die lokale DB **immer**
  an das lokale Mailpit (http://127.0.0.1:54324), nie an einen echten
  Server. `db:clone` löscht zusätzlich das SMTP-Passwort aus der Kopie.

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
- **Rechnungs-PDFs** entstehen auf dem Server (`src/server/e-invoice.ts`) als
  ZUGFeRD-E-Rechnung (Profil EN 16931, PDF/A-3 mit eingebetteter Schrift).
  Geprüft mit dem Mustang-Validator; ohne vollständige Kundenanschrift gibt
  es ein normales PDF. Stornorechnungen ebenso (Typ 381 mit Bezug auf die
  Rechnung). Lieferscheine und Lieferschein-Stornos erzeugt der Browser.
- **E-Mail-Versand:** SMTP-Daten und Vorlage unter Einstellungen → E-Mail.
  Das SMTP-Passwort liegt AES-verschlüsselt in der Datenbank, der Schlüssel
  wird aus `SESSION_SECRET` abgeleitet (wer `SESSION_SECRET` ändert, muss das
  Passwort neu eingeben). Jeder Versuch steht in `invoice_emails`.
- **Admin-Passwort vergessen** (`/passwort-vergessen`): Supabase erzeugt das
  Einmal-Token, die Mail geht über die eigenen SMTP-Einstellungen. Der Link
  wird nie aus dem Host-Header gebaut, sondern aus `APP_URL` bzw. auf Vercel
  automatisch aus `VERCEL_PROJECT_PRODUCTION_URL` (Systemvariablen müssen im
  Vercel-Projekt freigegeben sein, Standard). Eigene Domain? → `APP_URL`
  setzen, z.B. `https://dashboard.gaiser-abbruch.de`.
- **Vorgänge** speichern Produkt-, Baustellen- und Firmennamen als Kopie.
  Umbenennungen in den Stammdaten wirken nur auf noch nicht abgerechnete
  Vorgänge, gestellte Rechnungen bleiben unverändert.

## Datenbank

Das Schema liegt vollständig in `supabase/migrations/`, eine Datei pro
Änderung, eingespielt in der Reihenfolge des Zeitstempels im Dateinamen.

### Migration lokal entwickeln und testen

```bash
npx supabase migration new <kurzer_name>   # legt supabase/migrations/<zeitstempel>_<kurzer_name>.sql an
# SQL schreiben, dann lokal einspielen:
npx supabase migration up --local
```

Vor dem Deploy auf zwei Arten prüfen:

- `npm run db:reset`: leere lokale Datenbank, alle Migrationen von vorn.
  Zeigt, dass die Migrationen auf einer frischen Datenbank durchlaufen.
- `npm run db:clone`: **Generalprobe**. Baut lokal den Migrationsstand der
  Produktion nach, lädt die Produktionsdaten (nur lesend) und spielt danach
  die noch nicht eingespielten Migrationen darüber. Muss mit
  „✔ Neue Migrationen laufen fehlerfrei auf dem aktuellen Datenstand“ enden.

Beide Befehle überschreiben nur die lokale Datenbank.

Regeln:

- Eine Migration, die schon in der Produktion eingespielt ist, wird **nie**
  mehr geändert. Korrekturen kommen als neue Migration.
- Neue Tabellen vergeben ihre Rechte selbst (`grant …`, siehe unten).

### Migrationen in die Produktion einspielen

Läuft von Hand vom eigenen PC, mit der Supabase CLI. Es gibt bewusst keinen
CI-Job dafür.

**Einmalig einrichten** (falls noch nicht geschehen):

```bash
npx supabase login                            # Browser-Login bei Supabase
npx supabase link --project-ref <project-ref> # verknüpft das Repo mit dem Produktionsprojekt
```

Die Project-Ref steht im Supabase-Dashboard unter Project Settings → General.
`db push` fragt nach dem Datenbank-Passwort (Project Settings → Database).

**Ablauf bei jedem Deploy mit neuen Migrationen.** Vercel deployt
automatisch, sobald etwas auf `main` landet. Deshalb gilt: **erst
migrieren, dann mergen.** Am besten abends, wenn niemand am Kiosk arbeitet.

```bash
# 1. Generalprobe lokal
npm run db:clone

# 2. Backup der Produktion: in der Produktions-App
#    Admin → Einstellungen → „SQL-Backup herunterladen“
#    (außerhalb des Repos ablegen – enthält Kundendaten und PIN-Hashes)

# 3. Welche Migrationen fehlen in der Produktion? (nur lesend)
npx supabase migration list --linked

# 4. Trockenlauf: zeigt, was eingespielt würde
npx supabase db push --linked --dry-run

# 5. Einspielen
npx supabase db push --linked
```

6. Direkt danach den Pull Request auf `main` mergen. Vercel baut und
   deployt (2–3 Minuten).
7. Prüfen: Ganz unten auf jeder Seite steht
   „Produktion · Version <commit> · Stand …“. Das Kürzel muss zum neuesten
   Deployment in Vercel passen. Das Kiosk-Tablet lädt neue Versionen von
   selbst neu (auf der Kunden-Anmeldung, nach 30 s ohne Eingabe). Beim
   ersten Deploy nach Paket 1 muss es einmal von Hand neu geladen werden.
8. Kurz durchklicken: als Kunde und als Fahrer anmelden, eine Rechnung
   herunterladen.

Zwischen Schritt 5 und dem fertigen Deploy läuft für ein paar Minuten noch
der alte Code gegen das neue Schema. Deshalb abends.

**Nie** `npx supabase db reset --linked` ausführen: Das löscht die
Produktionsdatenbank. Lokale Befehle laufen immer über `npm run db:*` oder
mit `--local`.

Neue Tabellen müssen ihre Rechte für `service_role`/`authenticated` selbst
vergeben (`grant …`): neuere Supabase-Versionen tun das nicht mehr
automatisch.

In Produktion laufen die Umgebungsvariablen über Vercel
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
`SESSION_SECRET`, optional `APP_URL` bei eigener Domain). Die SMTP-Daten für
den E-Mail-Versand sind keine Umgebungsvariablen: Gaiser trägt sie in der
App ein (Admin → Einstellungen → E-Mail).

Die GitHub Action `supabase-keepalive.yml` verhindert, dass das kostenlose
Supabase-Projekt nach 7 Tagen Inaktivität pausiert.
