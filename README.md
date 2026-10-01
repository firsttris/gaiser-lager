# Gaiser Lager

Kundenportal und Verwaltung für das Lager der Gaiser GmbH Erdbau und Abbruch:
Kunden legen Abhol-, Anlieferungs- und LKW-Vorgänge an und laden ihre
Lieferscheine/Rechnungen herunter; im Admin-Bereich werden Vorgänge
abgerechnet, storniert und Stammdaten (Material, LKW, Kunden, Baustellen)
gepflegt.

Stack: TanStack Start (React 19, Router, Query), Tailwind CSS, Supabase
(Postgres + Auth), jsPDF für die Dokumente, Deployment auf Vercel (Nitro).

## Entwicklung

```bash
npm install
cp .env.example .env   # Werte eintragen, siehe unten
npm run dev            # http://localhost:3000
npm test               # Unit-Tests (Vitest)
npx tsc --noEmit       # Typecheck
npm run build
```

### Umgebungsvariablen

| Variable | Zweck |
| --- | --- |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | öffentlich, landen im Browser-Bundle |
| `SUPABASE_SECRET_KEY` | nur Server, umgeht Row Level Security |
| `SESSION_SECRET` | verschlüsselt die Session-Cookies (`openssl rand -base64 32`) |

> **Achtung:** Das in `.env` eingetragene Supabase-Projekt ist die
> Produktionsdatenbank. Für Tests eine lokale Datenbank verwenden.

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

Das Schema liegt vollständig in `supabase/migrations/`. Neue Migrationen
werden mit der Supabase CLI eingespielt (`npx supabase db push`) — vorher
gegen eine lokale Datenbank testen und vor dem Einspielen in Produktion ein
Backup ziehen (Admin → Einstellungen → SQL-Backup).

Die GitHub Action `supabase-keepalive.yml` verhindert, dass das kostenlose
Supabase-Projekt nach 7 Tagen Inaktivität pausiert.
