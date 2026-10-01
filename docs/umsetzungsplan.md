# Umsetzungsplan

Stand: 01.10.2026 · Grundlage: [plan-kundentermin.md](plan-kundentermin.md)
(Punktnummern „P1“ … „P20“ beziehen sich darauf) · Status: **zum
Durchsprechen, noch nichts umgesetzt**

## Überblick

Die 20 Punkte werden in **6 Pakete** geschnitten. Jedes Paket ist für sich
deploybar und testbar, sodass Gaiser früh Verbesserungen sieht und
Datenbankänderungen in kleinen, überschaubaren Schritten in die Produktion
gehen.

| Paket | Inhalt | Punkte | Datenbank? | Größe |
| --- | --- | --- | --- | --- |
| **0** ✅ | Sicherheit + offene Review-Fixes live bringen | P0, P3 (Sofortmaßnahme), P16 (teilweise) | ja (klein) | S |
| **1** ✅ | Kiosk-Abläufe: Login, Abmelden, Admin-Zugang, aktuelle Daten | P1, P2, P4, P5, P13, P17, P20 | ja (klein) | M |
| **2** ✅ | Datenmodell aufräumen | P8, P9, P14, P15, P16 | ja | M |
| **3** ✅ | Kiosk-Oberfläche: Lesbarkeit, Tabellen, Login-Seite | P6, P7, P12, P18 | nein | L |
| **4** ✅ | Baustellen pro Firma + Mitarbeiter-Login + Lieferschein-Fotos | P3, P19 | ja | L |
| **5** | E-Mail-Versand + Admin-Passwort | P10, P11 | ja | L |

Größe: S ≈ ein halber bis ein Tag, M ≈ 2–3 Tage, L ≈ 4–6 Tage, jeweils
inklusive Tests. Grobe Schätzung, die sich nach den Antworten des Kunden
noch verschiebt.

**Warum diese Reihenfolge:**

- Paket 0 schließt Sicherheitslücken, die **heute** in der Produktion
  bestehen, und bringt die schon fertigen Review-Fixes live (auf dem
  Tablet läuft noch der alte Stand).
- Paket 1 vor 3: Erst müssen die Abläufe am Kiosk stimmen (niemand bleibt
  im Admin-Login hängen), dann wird die Optik überarbeitet.
- Paket 2 vor 3: Ohne Privatpreis und Tarifgruppe (P8) werden Preisliste
  und Kundentabelle schmaler. Es lohnt nicht, sie vorher umzubauen.
- Paket 3 vor 4: Die neuen Mitarbeiter-Seiten werden gleich mit den
  großen, kiosktauglichen Bausteinen gebaut.
- Paket 5 zuletzt: hängt vom E-Mail-Feld (P9), von SMTP-Zugangsdaten des
  Kunden und ggf. von der E-Rechnungs-Klärung ab.

---

## Querschnitt: Bausteine, die mehrere Punkte brauchen

Diese Grundlagen werden einmal gebaut und dann überall verwendet:

1. **Eine Anmelde-Logik für drei Rollen** (Kunde, Mitarbeiter, Admin)
   - Server: `requireSession({ roles: [...] })` ersetzt `requireAnySession`
     und `requireAdminSession` schrittweise; liefert Rolle, Firma bzw.
     Mitarbeiter-ID.
   - Client: **ein** Abmelde-Ablauf `useLogout()`: abmelden, abwarten, Cache
     leeren, zur Kunden-Login-Seite (P4, P5, P17).
   - **Ein** Inaktivitäts-Wächter für alle Rollen mit eigener Zeit pro Rolle
     (heute nur für Kunden in `kunde.tsx`; neu für Admin P13 und Mitarbeiter
     P19). Einstellbar unter Admin → Einstellungen.
   - Alle geschützten Seiten leiten ohne Sitzung auf `/` um, nie auf
     `/admin` (P17).
2. **Kiosk-Bausteine** (Paket 3, später auch für P19/P10)
   - `Button`, `TextField`, `NumberField` (mit Ziffernblock), `Select`,
     `Dialog` in großer, kontrastreicher Ausführung statt der heute pro Seite
     wiederholten Tailwind-Klassen.
   - Bearbeiten in einem Dialog statt in der Tabellenzeile (P12).
3. **Server-seitige Suche** für Firmen (P1) und Baustellen (P3) nach
   demselben Muster: Mindestlänge, wenige Treffer, nur nötige Felder.
4. **PDF-Erzeugung für Browser und Server** (P10): die Funktionen in
   `delivery-note-utils.ts` liefern das PDF als Daten; Download und
   Mail-Anhang nutzen denselben Code.

---

## Paket 0 – Sicherheit und offene Fixes live bringen

> **Stand:** lokal umgesetzt und getestet (Branch `kundentermin`), noch
> nicht in der Produktion. Migration:
> `20261002000000_package0_security_and_cleanup.sql`. §13b wird über eine
> neue Migration entfernt (statt die evtl. schon eingespielte
> `20261001000000` zu ändern).

**Ziel:** Lücken in der Produktion schließen, Review-Fixes ausrollen.

1. **Vorab, nur lesend (SQL Editor):** die Prüfabfragen aus P0, P3, P14 und
   P16 einmal ausführen. Die Ergebnisse bestimmen Details der weiteren
   Migrationen.
2. **P16 vorziehen:** In der noch nicht eingespielten Migration
   `20261001000000_atomic_document_workflow.sql` den §13b-Parameter aus
   `create_invoice` entfernen, und im Dialog „Rechnung erstellen“ das
   Häkchen entfernen. (Die Darstellung alter §13b-Rechnungen bleibt.)
3. **P0:** Neue Migration: `companies_public` nur lesend für `anon`.
4. **P3 Sofortmaßnahme:** `listConstructionSites` gibt Kunden nur ihre
   eigenen Baustellen (aus ihren Vorgängen), Admins die der gewählten Firma.
   Kein Datenbankumbau.
5. Lokal: `npm run db:clone`, alles durchklicken (Rechnung, Storno,
   bezahlt, Kunden-Login, Baustellenvorschläge).
6. **Deploy:** Backup → Migrationen `20261001000000`, `20261001010000`,
   P0-Migration einspielen → Code deployen → am Tablet prüfen.

---

## Paket 1 – Kiosk-Abläufe

> **Stand:** lokal umgesetzt und im Browser getestet (Branch `kundentermin`).
> Migration `20261002010000_package1_kiosk.sql` **direkt nach** dem Deploy
> des Codes einspielen (sie entfernt die öffentliche Firmenliste, die der
> alte Login noch liest). Die geänderte Keepalive-Action braucht die
> Funktion `keepalive()` aus dieser Migration.
> Standardwerte (änderbar): Suche ab 2 Zeichen, Treffer irgendwo im Namen,
> max. 8 Treffer; unbenutzter Admin-Login 60 s; Admin-Inaktivität 10 min
> (Einstellungen); Nachladen 60 s, Listen 30 s; Versionsprüfung alle
> 5 min, Neuladen nach 30 s Leerlauf auf der Login-Seite.

**Ziel:** Am Kiosk landet man immer auf der Kunden-Login-Seite; Firmen
sind nicht mehr auflistbar; der Admin-Bereich ist versteckt.

1. **Querschnitt 1 bauen:** `useLogout()`, Inaktivitäts-Wächter für
   Kunde + Admin, Umleitungen auf `/`.
   - P4: Kunden-Abmelden wartet, Ersatzseiten „Bitte zuerst einloggen“
     entfallen (`kunde.neuer-vorgang.tsx`, `kunde.vorgaenge.tsx`,
     `kunde.rechnungen.tsx`).
   - P5/P13/P17: Admin-Abmelden, Admin-Inaktivität (neue Einstellung, kleine
     Migration in `signup_settings`), Ablauf der Admin-Sitzung → `/`; 8
     Admin-Unterseiten umstellen.
   - P17: unbenutzter Admin-Login kehrt nach 60 s zurück; Button „Zurück“.
2. **P17 versteckter Zugang:** Link entfernen, 5× Tippen aufs Logo
   (innerhalb 3 s) öffnet `/admin`.
3. **P1 + P2 Firmensuche:** neue Server-Funktion `searchCompanies`
   (ab 2 bzw. 3 Zeichen, max. ~8 Treffer); neues Suchfeld, das beim Tippen
   öffnet (behebt P2), Pfeiltasten/Enter, Escape. Laden der kompletten
   Firmenliste für Nicht-Angemeldete entfernen (`app-state.tsx`).
   - Migration: `companies_public` für `anon` sperren; **gleichzeitig** die
     GitHub-Keepalive-Action auf einen eigenen `keepalive()`-Aufruf
     umstellen.
4. **P20 Daten aktuell halten:** regelmäßiges Nachladen (sichtbare Seite,
   ca. 60 s; Listen 30 s), zentrale Daten bei Seitenwechsel neu abrufen,
   Versionsprüfung mit automatischem Neuladen im Leerlauf.
5. Tests: Playwright-Skripte für Abmelden (Kunde/Admin, Desktop/Mobil-Menü),
   Inaktivität (verkürzte Zeiten), Suchfeld inkl. P2-Szenario, Geste aufs
   Logo, „Kunde woanders angelegt → erscheint ohne Neuladen“, „neue Version
   → Kiosk lädt im Leerlauf neu“.

---

## Paket 2 – Datenmodell aufräumen

> **Stand:** lokal umgesetzt und im Browser getestet (Branch `kundentermin`).
> Migration `20261002020000_package2_data_model.sql` **vor** dem Deploy
> einspielen (alte Spalten bleiben, der alte Code läuft weiter). Die
> Folge-Migration „alte Preisspalten + Tarifgruppe entfernen“ (Migration B)
> wird erst nach dem Deploy und einer Kontrolle angelegt.
> Zusätzlich erledigt: P12 für **Kunden, Material und LKW** (Bearbeiten im
> Dialog, Tabellen ohne Breitenproblem); Baustellen folgen in Paket 3.
> Gefunden und behoben: Die öffentliche Preisliste hatte die Überschriften
> vertauscht (Verkaufsware stand unter „Anlieferungen“) und zeigte Preise im
> englischen Format („€ 8.00“).
> PLZ-Daten: GeoNames (CC BY 4.0, Quellenangabe unter den PLZ-Feldern),
> aktualisierbar mit `node scripts/update-postal-codes.mjs`.

**Ziel:** ein Preis, keine Tarifgruppe, E-Mail und konfigurierbare
Kundennummern; Ort aus PLZ.

1. **P8 Ein Preis (zwei Deploys):**
   - Migration A: `products.price`, `trucks.price`, befüllt mit dem
     Gewerbepreis.
   - Code: nur noch `price`; Admin-Masken, Preisliste, Registrierung,
     Preisberechnung, Typen.
   - Deploy, kontrollieren.
   - Migration B (später): alte Preisspalten und `companies.price_category`
     entfernen.
   - Vorher Liste der betroffenen bisherigen Privatkunden für Gaiser.
2. **P9 E-Mail:** `companies.email`; Pflichtfeld bei Registrierung und im
   Admin; Kunden ohne E-Mail in der Liste markieren.
3. **P14 Kundennummern:** `numbering_settings.customer_number_template`;
   Format `{NUMMER}`, nächste Nummer 10600 (per Migration gesetzt);
   Einstellungsabschnitt mit Vorschau; Vergabe überspringt belegte Nummern.
4. **P15 PLZ → Ort:** PLZ-Datensatz (nach Lizenzprüfung) als Tabelle oder
   Datei, Server-Funktion `lookupPostalCode`; Auswahl bei mehreren Orten;
   in Registrierung und Admin-Formular.
5. **P16 Rest:** falls die Prüfabfrage 0 §13b-Rechnungen ergibt, die
   Darstellung und die Spalte ganz entfernen; sonst nichts weiter.

---

## Paket 3 – Kiosk-Oberfläche

> **Stand:** lokal umgesetzt und getestet (Branch `kundentermin`), keine
> Migration. Getestet mit 1080 × 1920 (angenommene Xoro-Größe, **am Gerät
> noch zu prüfen**). Umgesetzt: Zoomen erlaubt; große Bildschirme im
> Hochformat automatisch 125 % Schrift (= 20 px), Schalter A / A+ / A++ pro
> Gerät (wird gespeichert); dunklere Texte und Platzhalter; Listen schalten
> nach verfügbarem Platz zwischen Tabelle und Karten (keine überlaufenden
> Tabellen bei großer Schrift); Login-Seite einspaltig mit Preisliste;
> PIN-Feld zeigt Punkte statt Ziffern (Kiosk); volle Belegnummern; Mengen im
> deutschen Format; Baustellen im Dialog bearbeiten; größere Buttons,
> Eingabefelder, Kacheln und Auswahlkästchen.

**Ziel:** auf dem Xoro hochkant gut lesbar und gut bedienbar.

0. **Vorbereitung:** Viewport des Xoro messen (whatismyviewport.com am
   Gerät), als feste Testgröße in die Playwright-Skripte;
   Vorher-Screenshots aller Seiten.
1. **P6 Grundlagen:** Zoom erlauben; Grundschrift anheben (Ziel ~20 px am
   Kiosk); Kontrast (grau → dunkelgrau); Querschnitt 2 (Kiosk-Bausteine).
2. **P18 Login-Seite neu:** eine Spalte, großes Formular, Preisliste
   darunter (Komponente aus `preisliste.tsx` herausgelöst; Seite bleibt je
   nach Kundenantwort zusätzlich bestehen).
3. **P12 Tabellen:** Kundentabelle mit weniger Spalten und flexiblem Namen;
   Karten statt Tabelle bei zu wenig Breite; Bearbeiten im Dialog für
   Kunden, Material, LKW, Baustellen; Ziffernblock für Zahlenfelder; die
   anderen Tabellen auf das gleiche Breitenproblem prüfen.
4. **P7 Belegnummern:** volle Nummern statt `shortDocId`, Spalte
   „Dateien“ mit Umbruch; `DocButton`/`DocLinkButton` zusammenführen.
5. **Formular „Neuer Vorgang“:** große Material-Kacheln, großes Mengenfeld,
   große Buttons (wird in Paket 4 auch von Mitarbeitern genutzt).
6. Nachher-Screenshots in Xoro- und Handygröße, dann Test am Gerät.

---

## Paket 4 – Baustellen pro Firma, Mitarbeiter, Lieferschein-Fotos

> **Stand:** lokal umgesetzt und im Browser getestet (Branch `kundentermin`).
> Migration `20261003000000_package4_sites_employees_photos.sql` **vor** dem
> Deploy einspielen, vorher `npm run db:clone` als Generalprobe.
> Gewählte Standards (änderbar): Unbenutzte Altbaustellen bleiben „ohne
> Kunde“ (nur Admin sieht sie, zuordnen oder löschen); Fotos werden vorerst
> unbegrenzt aufbewahrt; Fahrer-Login sichtbar auf der Startseite
> („Mitarbeiter-Anmeldung (Fahrer)“), Name antippen + PIN, Inaktivitäts-Logout
> wie bei Kunden. Abweichung vom Plan: Fotos werden auf dem Gerät auf
> ~0,3–0,5 MB verkleinert und über den eigenen Server hochgeladen (keine
> Upload-Links nötig). Unterwegs behoben: Nach dem Login konnte die nächste
> Seite kurz „nicht angemeldet“ sehen und zur Startseite springen (betraf
> potenziell alle drei Logins). `db:clone` ist jetzt eine Generalprobe fürs
> Deployment (siehe README).

**Ziel:** Fahrer buchen selbst und laden Deponie-Belege hoch; Baustellen
sind sauber pro Firma getrennt.

1. **P3 Baustellen pro Firma (Datenbank):**
   - Migration: `construction_sites.company_id`; Bestand automatisch
     zuordnen (eine Firma → zuordnen; mehrere → je Firma eine Kopie,
     Vorgänge umhängen; keine → je nach Kundenantwort löschen/zuordnen);
     Eindeutigkeit `(company_id, lower(name))`.
   - **Vorher mehrfach gegen `db:clone` testen** und die Zuordnung mit dem
     Ergebnis der Prüfabfrage abgleichen.
   - Code: Baustellen-Funktionen pro Firma, Assistent zeigt nur die
     Baustellen der gewählten Firma, Admin → Baustellen mit Firmenspalte
     und -filter.
2. **P19 Mitarbeiter:**
   - Migration: `employees` (Name, PIN-Hash, aktiv, PIN-Sperre),
     `records.created_by_employee_id`, Rechte.
   - Admin → Mitarbeiter (anlegen, PIN zurücksetzen, deaktivieren).
   - Login „Mitarbeiter“: Name + PIN, eigene Sitzung (Querschnitt 1),
     kurzer Inaktivitäts-Logout.
   - Mitarbeiter-Bereich: „Neuer Vorgang“ mit Kundenauswahl (Assistent
     wiederverwenden), „Meine Buchungen“ (letzte Tage),
     „Lieferscheine hochladen“.
   - In Admin → Vorgänge: Spalte bzw. Filter „gebucht von“.
3. **P19 Lieferschein-Fotos:**
   - Migration: Tabelle `delivery_note_photos`, privater Storage-Bucket mit
     Zugriff nur über den Server.
   - Aufnahme: am Kiosk Live-Kamerabild, sonst Kamera-Upload-Feld; mehrere
     Fotos; Verkleinerung auf dem Gerät (~2000 px JPEG).
   - Upload über zeitlich begrenzte Upload-Links direkt in den Speicher.
   - Admin → Lieferschein-Eingang: Filter Datum/Fahrer/(Kunde), Ansicht,
     Download, „erledigt“.
   - **Vorab entscheiden:** Speicher (Supabase Pro vs. Löschfrist) und
     Aufbewahrungsfrist (Steuerberater).
   - Test der Kamera **am Xoro** (Kiosk-Programm muss Kamera erlauben).

---

## Paket 5 – E-Mail-Versand und Admin-Passwort

**Voraussetzungen:** SMTP-Zugangsdaten von Gaiser; Entscheidung
E-Rechnung (ZUGFeRD ja/nein); E-Mail-Adressen der Kunden gepflegt (P9).

1. **Lokale Absicherung zuerst (P10.4):** Mailpit in der lokalen Supabase
   aktivieren, `db:clone` überschreibt SMTP-Einstellungen, Server
   verweigert lokal echten Versand.
2. **Querschnitt 4:** PDF-Erzeugung für Browser und Server.
3. **P10.1 Einstellungen → E-Mail:** SMTP (Passwort verschlüsselt),
   Testmail, Template mit Platzhaltern und Live-Vorschau.
4. **P10.2 Versand:** Aktion „Per E-Mail senden“ in der Rechnungsliste,
   Vorschau-Dialog mit Warnungen, Versand einzeln mit Fortschritt,
   Versandprotokoll, Vermerk „gesendet am …“.
5. Falls nötig: **ZUGFeRD** (Rechnungsdaten als XML ins PDF eingebettet).
   Eigener Unterpunkt, Aufwand je nach gewähltem Profil.
6. **P11 Admin-Passwort:** „Mein Konto“ mit Passwort ändern; optional
   „Passwort vergessen“ (braucht SMTP in Supabase) und Admin-Verwaltung.

---

## Migrationen in der Übersicht

In dieser Reihenfolge, jeweils **erst Migration, dann Code-Deploy**, vorher
Backup:

| # | Paket | Migration | Risiko |
| --- | --- | --- | --- |
| 1 | 0 | `atomic_document_workflow` (schon fertig, §13b-Parameter vorher raus) | mittel, getestet |
| 2 | 0 | `explicit_data_api_grants` (schon fertig) | keins (in Prod wirkungslos) |
| 3 | 0 | `companies_public` nur lesend | gering |
| 4 | 1 | Admin-Inaktivitäts-Einstellung | gering |
| 5 | 1 | `companies_public` sperren + `keepalive()` | gering, Keepalive-Action gleichzeitig ändern |
| 6 | 2 | ein Preis: neue Spalten | gering |
| 7 | 2 | E-Mail, Kundennummer-Format/-Start 10600, ggf. PLZ-Tabelle | gering |
| 8 | 2 | ein Preis: alte Spalten + Tarifgruppe entfernen (nach Kontrolle) | mittel, nicht umkehrbar → Backup |
| 9 | 4 | Baustellen pro Firma inkl. Datenumzug | **hoch**, mehrfach gegen `db:clone` testen |
| 10 | 4 | Mitarbeiter, `created_by_employee_id`, Lieferschein-Fotos | gering |
| 11 | 5 | E-Mail-Einstellungen, Versandprotokoll | gering |

## Testvorgehen (für alle Pakete)

- Entwicklung ausschließlich lokal, mit `npm run db:clone` gegen den
  aktuellen Datenstand.
- Unit-Tests für Logik (Preise, Nummern, Zeitzonen, Platzhalter),
  Playwright-Skripte für die Abläufe, Screenshots in Xoro- und Handygröße.
- Vor jedem Produktions-Deploy: SQL-Backup, Migration einspielen, Deploy,
  kurzer Test am Kiosk-Tablet.

## Vor dem Start zu klären

Die offenen Fragen stehen gesammelt in
[plan-kundentermin.md](plan-kundentermin.md) bei den einzelnen Punkten.
**Blockierend** für den Start der Pakete sind nur:

- Paket 0: keine.
- Paket 1: 2 oder 3 Zeichen für die Firmensuche (P1).
- Paket 2: Bestätigung „ein Preis = netto“ (P8); Lizenz PLZ-Daten (P15).
- Paket 3: gemessener Viewport des Xoro (P6).
- Paket 4: Umgang mit unbenutzten Baustellen (P3); Speicher/Aufbewahrung
  der Fotos (P19).
- Paket 5: SMTP-Zugangsdaten; E-Rechnung ja/nein (P10).
