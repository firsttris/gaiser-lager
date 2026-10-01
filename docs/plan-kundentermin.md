# Plan: Änderungen aus dem Kundentermin

Stand: 01.10.2026 · Status: **geplant, noch nicht umgesetzt** ·
Reihenfolge und Pakete: [umsetzungsplan.md](umsetzungsplan.md)

Ablauf für jeden Punkt: lokal umsetzen und testen (`npm run db:clone` für echte
Daten), Migrationen vor dem Deploy in die Produktion einspielen (vorher Backup).

---

## 0. Dringend: Firmenliste ist vermutlich öffentlich beschreibbar

**Befund (lokal nachgestellt, in der Produktion noch nicht geprüft):**
Die View `companies_public` (Firmen-ID + Name für die Login-Suche) wurde in
`20260727120000_drop_company_short_code.sql` neu angelegt, ohne ihre Rechte
neu zu setzen. Das Produktionsprojekt vergibt an neue Tabellen/Views
automatisch *alle* Rechte an `anon`. Die View läuft mit den Rechten ihres
Besitzers (umgeht RLS) und ist automatisch beschreibbar.

Mit nachgestellten Produktionsrechten konnte lokal **jeder mit dem
öffentlichen Schlüssel aus dem Browser Firmen umbenennen**
(`PATCH /rest/v1/companies_public`). Firmen ohne Vorgänge ließen sich
vermutlich auch löschen.

**Prüfen (nur lesend, im Supabase-Dashboard → SQL Editor):**

```sql
select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'companies_public'
order by grantee, privilege_type;
```

Steht bei `anon` mehr als `SELECT` (z. B. `UPDATE`, `DELETE`, `INSERT`),
ist die Lücke offen.

**Fix (Migration):**

```sql
revoke all on public.companies_public from anon, authenticated;
grant select on public.companies_public to anon, authenticated;  -- entfällt mit Punkt 1
```

Wird durch Punkt 1 ohnehin ersetzt, sollte aber **vorab und unabhängig**
eingespielt werden, weil der Fix klein ist und sofort wirkt.

---

## 1. Firmensuche beim Kunden-Login erst ab 2 Buchstaben

**Anforderung:** Die Liste soll nicht schon beim Klick ins Feld erscheinen,
sondern erst ab 2 getippten Zeichen, und dann nur die passenden Firmen
zeigen. Niemand soll einfach durchblättern können, welche Kunden es gibt.

**Ist-Zustand:** Beim Laden der Startseite holt der Browser die *komplette*
Firmenliste (`publicCompaniesQueryOptions` in `src/server/companies.ts`,
direkt aus `companies_public`) und filtert lokal. Ein Klick ins leere Feld
zeigt sofort alle Firmen. Selbst wenn die Oberfläche erst ab 2 Zeichen
etwas anzeigt, liegt die ganze Liste im Netzwerk-Tab des Browsers und ist
mit dem öffentlichen Schlüssel direkt abrufbar.

**Vorschlag: Suche auf den Server verlagern**

- Neue Server-Funktion `searchCompanies(query)`:
  - lehnt weniger als 2 Zeichen ab (leere Liste),
  - liefert höchstens ~8 Treffer (nur `id` + `name`),
  - läuft mit dem Service-Key auf dem Server.
- Login-Feld (`src/routes/index.tsx`): Ab 2 Zeichen wird gesucht (mit
  kurzer Verzögerung beim Tippen), darunter gibt es keine Liste und keinen
  Hinweistext mit Namen.
- Die vollständige Firmenliste wird für nicht angemeldete Besucher nicht
  mehr geladen (`app-state.tsx`: `publicCompaniesQuery` entfällt; geprüft
  werden muss, wo `companies` ohne Admin-Login sonst noch verwendet wird).
- Migration: `companies_public` für `anon` sperren bzw. View entfernen.
- **Achtung, Abhängigkeit:** Die GitHub Action `supabase-keepalive.yml`
  pingt genau diese View. Sie muss auf etwas anderes umgestellt werden,
  z. B. eine kleine Funktion `keepalive()`, die nur `1` zurückgibt, sonst
  pausiert das Supabase-Projekt nach 7 Tagen.

**Grenzen (ehrlich):** Wer systematisch alle Zwei-Buchstaben-Kombinationen
durchprobiert (~700 Anfragen), kann die Liste trotzdem rekonstruieren. Das
lässt sich erschweren, aber nicht ganz verhindern:

- mindestens 3 statt 2 Zeichen,
- wenige Treffer pro Anfrage,
- Rate-Limit pro IP (siehe Frage unten).

**Fragen an den Kunden:**

- [ ] 2 oder 3 Zeichen Mindestlänge?
- [ ] Treffer irgendwo im Namen („bau“ findet „Testbau“) oder nur am
      Wortanfang („Tes…“)?
- [ ] Wie viele Treffer maximal anzeigen?
- [ ] Alternative mit maximalem Schutz: gar keine Liste, Kunde meldet sich
      mit **Kundennummer + PIN** an. Gewünscht oder zu umständlich?

---

## 2. Bug: Firmenliste erscheint irgendwann nicht mehr

**Reproduziert** (lokal im Browser):

1. Ins Firmenfeld klicken, tippen, eine Firma aus der Liste wählen.
2. Ohne das Feld zu verlassen den Namen ändern bzw. weitertippen.
3. → Die Liste erscheint nicht mehr, egal was man tippt. Erst nach Klick
   außerhalb des Feldes und zurück funktioniert es wieder.

**Ursache:** `src/routes/index.tsx`. Die Liste ist an „Feld hat Fokus“
gekoppelt (`isCompanyFieldFocused`). Beim Auswählen wird dieser Zustand auf
`false` gesetzt (Zeile 115). Das Feld behält aber den echten Fokus, weil der
Klick auf den Eintrag den Fokuswechsel verhindert (`onMouseDown …
preventDefault`, Zeile 111). Danach kommt kein neues Focus-Ereignis mehr,
der Zustand bleibt `false`, und die Liste bleibt zu.

**Fix:** Die Liste öffnet beim Tippen (`onChange` → offen) und nicht nur
beim Fokussieren. Sie schließt bei Auswahl, Escape oder Verlassen des
Feldes. Bei der Gelegenheit: Bedienung mit Pfeiltasten + Enter.

Wird zusammen mit Punkt 1 umgesetzt, weil dieselbe Komponente neu gebaut
wird.

---

## 3. Baustellen gehören immer zu genau einer Firma

**Anforderung:** Beim Anlegen eines Vorgangs („Neuer Vorgang“) dürfen nur
die Baustellen der jeweiligen Firma vorgeschlagen werden, nie die einer
anderen Firma.

**Ist-Zustand (betrifft die Produktion bereits):**

- Die Tabelle `construction_sites` hat keine Firmenzuordnung. Eine Baustelle
  ist global und nur über ihren Namen eindeutig (`lower(name)`).
- `listConstructionSites` (`src/server/construction-sites.ts`) liefert
  **jedem angemeldeten Kunden alle Baustellen aller Firmen**. Die
  Vorschlagsliste im Formular (`wizard-flow.tsx`, `truck-wizard-flow.tsx`)
  zeigt also Adressen anderer Kunden an. Das ist auch ein
  Datenschutzproblem.
- Beim Anlegen sucht `findOrCreateConstructionSite` die Baustelle nur über
  den Namen. Tippt Firma B dieselbe Adresse wie Firma A, landet ihr Vorgang
  an **derselben** Baustelle. Benennt der Admin die Baustelle später um,
  ändern sich die (offenen) Vorgänge beider Firmen.

### Sofortmaßnahme ohne Datenbankänderung (kann vorab live gehen)

`listConstructionSites` gibt Kunden nur noch Baustellen zurück, die in ihren
**eigenen** Vorgängen vorkommen (über `records.construction_site_id` mit
`company_id` = eingeloggte Firma). Das schließt die Datenschutzlücke sofort.
Neue Baustellen können Kunden weiterhin frei eintippen. Admins sehen im
Formular „Neuer Vorgang“ entsprechend nur die Baustellen der gewählten
Firma.

### Saubere Lösung: Baustelle bekommt eine Firma

**Datenbank (Migration):**

- `construction_sites.company_id` (Pflichtfeld, Verweis auf `companies`).
- Eindeutigkeit pro Firma statt global: `unique (company_id, lower(name))`.
  Dieselbe Adresse darf es also bei zwei Firmen geben, als zwei getrennte
  Baustellen.
- Bestehende Daten automatisch zuordnen:
  - Baustelle nur von **einer** Firma benutzt → dieser Firma zuordnen.
  - Von **mehreren** Firmen benutzt → pro Firma eine eigene Kopie anlegen
    und die Vorgänge jeweils auf ihre Kopie umhängen. Der in den Vorgängen
    gespeicherte Name bleibt unverändert, Rechnungen ändern sich also nicht.
  - Von **niemandem** benutzt (z. B. die Beispiel-Baustellen „Nordring 12,
    Berlin“ / „Hafenallee 8, Potsdam“ aus der Erstinstallation) → löschen
    oder vorher vom Admin zuordnen lassen (siehe Fragen).
- Vorher lokal mit `npm run db:clone` gegen den echten Datenstand testen.

**Code:**

- `construction-sites.ts`: Liste, Anlegen, Umbenennen und Löschen immer pro
  Firma; `findOrCreateConstructionSite(companyId, name)`.
- `records.ts`: Beim Anlegen eines Vorgangs die Baustelle der Firma des
  Vorgangs verwenden bzw. anlegen.
- `wizard-flow.tsx`, `truck-wizard-flow.tsx`: Vorschläge nur für die
  aktuelle Firma (Kunde: eigene Firma; Admin: im Formular gewählte Firma).
- Admin → Baustellen (`admin.baustellen.tsx`): Firma als Spalte und Filter,
  beim Anlegen muss eine Firma gewählt werden.
- Admin → Kunden: Löschen einer Firma muss ihre (unbenutzten) Baustellen
  mitlöschen.

**Bestandsaufnahme vorab (nur lesend, Supabase → SQL Editor):** Wie viele
Baustellen werden von mehreren Firmen benutzt, wie viele von gar keiner?

```sql
select s.name,
       count(distinct r.company_id) as firmen,
       string_agg(distinct r.company_name, ', ') as welche
from public.construction_sites s
left join public.records r on r.construction_site_id = s.id
group by s.id, s.name
order by firmen desc, s.name;
```

**Fragen an den Kunden:**

- [ ] Dürfen Kunden beim Vorgang weiterhin **neue** Baustellen frei
      eintippen, oder nur aus einer vom Admin gepflegten Liste wählen?
- [ ] Unbenutzte Baustellen ohne Firma: löschen oder einzeln zuordnen?
- [ ] Gibt es den Fall „eine Baustelle, mehrere Firmen“ (z. B. zwei
      Subunternehmer auf demselben Bau)? Mit der Lösung oben wären das zwei
      getrennte Einträge. Passt das?

---

## 4. Nach dem Abmelden direkt zur Kunden-Login-Seite

**Anforderung:** Nach „Abmelden“ soll der Kunde sofort auf der
Login-Seite (Firma + PIN) landen und nicht auf einer Zwischenseite
„Bitte zuerst einloggen“ mit Button „Zum Login“.

**Ursache (aus dem Code abgeleitet):** Ein Timing-Problem beim Abmelden.

1. Der Button „Abmelden“ (`src/components/top-nav.tsx`, Desktop- und
   Mobil-Menü) startet das Abmelden, wartet aber nicht darauf, und
   navigiert sofort zu `/`.
2. Die Login-Seite (`src/routes/index.tsx`, Zeile 21–23) hält den Kunden
   in diesem Moment noch für angemeldet und leitet ihn zurück zu
   `/kunde/neuer-vorgang`.
3. Kurz danach ist das Abmelden abgeschlossen, und „Neuer Vorgang“ zeigt
   seinen Ersatzinhalt „Bitte zuerst einloggen“ + „Zum Login“.

Der automatische Logout bei Inaktivität (`src/routes/kunde.tsx`) ist nicht
betroffen: Er wartet auf das Abmelden und lädt dann die Startseite neu.

**Fix:**

- „Abmelden“ wartet auf das Abmelden und geht erst dann zur Login-Seite
  (gleiches Vorgehen wie beim Inaktivitäts-Logout, für beide Menüs).
- Die Ersatzseiten „Bitte zuerst einloggen“ in `kunde.neuer-vorgang.tsx`,
  `kunde.vorgaenge.tsx` und `kunde.rechnungen.tsx` entfallen. Wer dort
  ohne Anmeldung landet (z. B. abgelaufene Sitzung), wird direkt auf die
  Login-Seite umgeleitet.
- Im Browser testen: Abmelden über Desktop- und Mobil-Menü, Inaktivitäts-
  Logout, Aufruf einer Kundenseite ohne Anmeldung.

---

## 5. Auch nach dem Admin-Abmelden zur Kunden-Login-Seite

**Anforderung:** Meldet sich ein Admin ab, landet er ebenfalls auf der
Kunden-Login-Seite (Firma + PIN), nicht auf dem Admin-Login und nicht auf
einer Zwischenseite.

**Ist-Zustand:** „Abmelden“ im Admin-Bereich (`src/routes/admin.tsx`,
Desktop- und Mobil-Menü) meldet nur ab und navigiert nirgendwohin. Die
aktuelle Seite (z. B. `/admin/vorgaenge`) zeigt dann das Admin-Login-
Formular an, das in `admin.tsx` eingebaut ist.

**Fix:** Wie bei Punkt 4: auf das Abmelden warten, dann zur Startseite `/`
(Kunden-Login). Gemeinsame Abmelde-Logik für Kunde und Admin, damit beide
gleich funktionieren.

**Abgrenzung:** Das Admin-Login-Formular selbst bleibt unter `/admin`
erreichbar (Link „Zum Admin-Bereich“ auf der Startseite), sonst könnte sich
kein Admin mehr anmelden. Geändert wird nur, wohin man **nach dem
Abmelden** kommt.

**Entschieden:** Auch wenn die Admin-Sitzung abläuft, geht es zur
Kunden-Login-Seite, nie zum Admin-Login (siehe Punkt 17: der Kiosk darf
nicht auf dem Admin-Login hängen bleiben).

---

## 6. Bessere Lesbarkeit (LKW-Fahrer, Tablet)

**Anforderung:** Viele Fahrer sehen nicht gut bzw. tragen Brille. Die
Schrift wirkt insgesamt zu klein, auch auf dem Tablet.

**Ist-Zustand:**

- **Zoomen ist abgeschaltet.** `src/routes/__root.tsx` setzt
  `maximum-scale=1, user-scalable=no`. Auf Tablet und Handy kann man nicht
  mit zwei Fingern vergrößern.
- **Fast alles ist kleiner als die Standardgröße:** rund 200× `text-sm`
  (14 px) und 90× `text-xs` (12 px), aber nur 2× Normalgröße (16 px).
  Dazu feste Kleinstgrößen in `src/styles.css` (0.69rem, 0.75rem, 0.9rem).
- **Wenig Kontrast:** rund 75× hellgraue Schrift (`text-slate-400/500`),
  z. B. für Uhrzeiten, Hinweise und Menüpunkte. Bei Sonne oder schlechtem
  Licht ist das oft schlechter lesbar als zu kleine Schrift.

**Maßnahmen (Vorschlag, in dieser Reihenfolge):**

1. **Zoomen wieder erlauben.** Eine Zeile, kein Risiko. Grundsätzlich
   sinnvoll für Barrierefreiheit.
2. **Kontrast erhöhen:** Informative Texte von hellgrau auf dunkelgrau
   (`slate-400/500` → `slate-600/700`). Rein dekorative Elemente bleiben
   hell.
3. **Alles etwas größer:** Grundschriftgröße der ganzen App anheben (z. B.
   16 px → 18 px). Weil Tailwind mit `rem` arbeitet, wachsen Schrift,
   Abstände und Buttons gleichmäßig mit. Ein Wert, einheitliches Ergebnis.
   Danach auf Tablet und Handy durchsehen, wo Tabellen oder Menüs zu breit
   werden, und dort gezielt nachbessern.
   - Alternative: nur den **Kundenbereich** (Login, „Neuer Vorgang“,
     Vorgänge) vergrößern, den Admin-Bereich (Büro, Bildschirm) lassen.
4. **Größere Bedienflächen** im Formular „Neuer Vorgang“: Material-
   Auswahl, Mengenfeld und „Weiter“/„Vorgang anlegen“ als große Buttons,
   gut mit dem Daumen bzw. mit Handschuhen zu treffen.
5. Optional: **Schalter „Schrift größer“ (A / A+)** oben in der Leiste;
   die Einstellung merkt sich das Gerät.

**Gerät vor Ort:** großes **Xoro-Tablet im Kiosk-Modus, hochkant**. Das
hat Folgen für die Maßnahmen oben:

- Großer Bildschirm, aber im Stehen aus etwas Abstand bedient → Schrift und
  Buttons müssen deutlich größer sein als für ein Handy. Maßnahme 3 und 4
  haben Vorrang, eher 20 px als 18 px Grundschrift.
- Im Kiosk-Modus ist Zoomen oft vom Kiosk-Programm gesperrt. Maßnahme 1
  hilft dann dort nicht (für Handys trotzdem sinnvoll).
- Hochkant liegt die Breite (bei Full-HD 1080 px) genau im Bereich, in dem
  die App zwischen Tablet- und Desktop-Layout umschaltet. Tabellen und das
  Formular gezielt für diese Größe prüfen. Testgröße: Bildschirm hochkant,
  in Originalauflösung, per Browser-Simulation und am Gerät.
- **Gemeinsam genutztes Gerät:** Die Fahrer melden sich nacheinander am
  selben Tablet an. Deshalb sind Punkt 4 (sauberes Abmelden direkt zum
  Login) und der automatische Logout bei Inaktivität hier besonders
  wichtig. Den Inaktivitäts-Timeout (Admin → Einstellungen) eher kurz
  halten.

**Beobachtungen vom Foto am Gerät (Admin → Kunden):**

- Die App nutzt die volle Breite, aber Schrift, Eingabefelder und Buttons
  sind auf Laptop-Größe ausgelegt und wirken auf dem großen Bildschirm
  winzig. Die Grundschrift muss deutlich hoch (eher 20 px).
- Die Scheibe **spiegelt stark** (Bäume/Himmel). Hellgraue Schrift
  (Platzhalter wie „z.B. 77815“, Beschreibungstexte, Spaltenköpfe) ist
  dadurch kaum lesbar. Maßnahme 2 (Kontrast) ist hier mindestens so
  wichtig wie die Größe.
- Kleine Icon-Buttons (Bearbeiten/Löschen) sind für Touch zu klein und zu
  dicht beieinander, Fehlgriffe beim Löschen sind leicht möglich.
- Login-Seite (Foto 3): Die Spiegelung (Hof, Bäume, Person davor) überdeckt
  fast alles; lesbar bleiben nur große, dunkle Elemente (Logo, Überschrift,
  schwarzer Button). Das spricht klar für **große, kräftige Schrift** und
  dunkle Texte statt Grau.

**Am Gerät selbst (kein Code, aber vermutlich der größte Gewinn):**

- [ ] **Entspiegelungsfolie** (matt/Anti-Glare) für das Display bzw. die
      Scheibe davor.
- [ ] **Bildschirmhelligkeit** auf Maximum stellen (Android-Einstellungen /
      Kiosk-Programm), automatische Helligkeit aus.
- [ ] Wenn möglich: Aufstellort bzw. Winkel so, dass der helle Hof sich
      nicht spiegelt, oder ein kleines Vordach/Blendschutz.

**Vorgehen:** Vorher/Nachher-Screenshots auf der Bildschirmgröße des Xoro
hochkant sowie auf Handygröße, danach am echten Gerät gegenprüfen.

**Fragen an den Kunden:**

- [ ] Genaues Xoro-Modell bzw. Bildschirmgröße und Auflösung? (Am Gerät
      kann man auch `https://whatismyviewport.com` öffnen und die angezeigte
      Breite × Höhe notieren, das ist genau der Wert, für den ich teste.)
- [ ] Welches Kiosk-Programm bzw. welcher Browser läuft darauf? Ist Zoomen
      dort erlaubt?
- [ ] Nutzen die Fahrer außerdem eigene Handys, oder nur das Tablet?
- [ ] Wird draußen bzw. in der Sonne abgelesen? Dann hat Kontrast Vorrang.
- [ ] Ganze App größer oder nur der Kundenbereich?
- [ ] Ist ein Schalter „Schrift größer“ gewünscht, oder reicht es, wenn
      alles grundsätzlich größer ist?

---

## 7. Belegnummern in den Listen vollständig anzeigen

**Anforderung:** In der Spalte „Dateien“ (Vorgänge, Rechnungen, Kunden- und
Admin-Bereich) fehlt bei den Nummern das Jahr. Im PDF und im Dateinamen
steht die Nummer vollständig.

**Ursache:** Kein Datenfehler, sondern eine absichtliche Verkürzung nur
für die Anzeige: `shortDocId` in `src/components/history-table.tsx`
(verwendet von `HistoryTable` und `DocLinkButton`). Sie behält vom
Datumsteil nur die letzten 4 Stellen (Monat + Tag):

| Echte Nummer | Angezeigt |
| --- | --- |
| `LS-20261001-0002` | `LS-1001-0002` |
| `RG-20261001-0002` | `RG-1001-0002` |
| `ST-20261001-7` | `ST-1001-7` |

**Dabei gefundene Fehler:**

- Auch die laufende Nummer wird auf 4 Stellen gekürzt. Ab Nummer 10.000
  zeigt die Liste eine **falsche** Nummer an (`…-10023` → `…-0023`).
- Ändert der Admin das Nummernformat (Einstellungen → Nummernkreise),
  liefert die Verkürzung unvorhersehbare Ergebnisse, weil sie ein festes
  Format „Präfix-Datum-Nummer“ annimmt.
- Wer die angezeigte Nummer in die Suche abtippt (`LS-1001-0002`), findet
  nichts, weil die Suche mit der echten Nummer arbeitet.

**Fix:**

- Überall die vollständige Nummer anzeigen; `shortDocId` entfällt.
- Spalte „Dateien“ so gestalten, dass die längeren Nummern passen (Umbruch
  untereinander statt nebeneinander, ggf. etwas breitere Spalte). Mit
  Punkt 6 (größere Schrift) zusammen auf Tablet und Handy prüfen.
- Doppelten Code zusammenführen: `DocButton` (in `history-table.tsx`) und
  `DocLinkButton` sind praktisch identisch.

---

## 8. Nur noch ein Preis (Privatpreis entfällt)

**Anforderung:** Die Unterscheidung „Preis privat“ / „Preis Gewerbe“
entfällt komplett. Es gibt nur noch **einen Preis**, und zwar den bisherigen
**Gewerbepreis**. Die Beschriftung lautet dann einfach „Preis“. Gilt für
Preisliste, Admin-Masken und das Datenmodell.

**Alle Kunden sind gewerblich.** Damit entfällt auch die **Tarifgruppe**
vollständig: bei der Kundenregistrierung, im Admin unter Kunden und im
Datenmodell (`companies.price_category`).

**Ist-Zustand:**

- Materialien (`products`): vier Preisspalten
  (`pickup_private_price`, `pickup_business_price`, `dropoff_private_price`,
  `dropoff_business_price`). Davon ist je nach Typ (Abholung/Anlieferung)
  ohnehin nur ein Paar belegt.
- LKW (`trucks`): `private_price`, `business_price`.
- Firmen (`companies`): `price_category` („private“/„business“) entscheidet,
  welcher Preis beim Vorgang berechnet wird.
- Kunden wählen bei der Registrierung ihre **Tarifgruppe selbst** (siehe
  Review-Befund 9). Das entfällt damit automatisch.

**Datenbank (Migration, in zwei Schritten für ein sicheres Deployment):**

1. Vor dem Deploy: neue Spalten `products.price` und `trucks.price`, befüllt
   mit dem bisherigen **Gewerbepreis** (bei Materialien je nach Typ der
   Abhol- bzw. Anlieferpreis). Alte Spalten bleiben vorerst stehen, damit
   der alte Code bis zum Deploy weiterläuft.
2. Nach dem Deploy und einer Kontrolle: alte Preisspalten und
   `companies.price_category` entfernen.

Bestehende Vorgänge und Rechnungen sind **nicht betroffen**: Jeder Vorgang
speichert seinen Einzelpreis beim Anlegen (`records.unit_price`), alte
Rechnungen bleiben also exakt gleich.

**Code (betroffene Stellen):**

- Server: `products.ts`, `trucks.ts`, `records.ts` (Preisberechnung wird
  einfacher: kein Blick mehr auf die Firma), `price-list.ts`,
  `companies.ts`, `customer-auth.ts` (Registrierung).
- Admin: Material (`admin.material.tsx`), LKW (`admin.lkw.tsx`): je nur
  noch ein Preisfeld. Kunden (`admin.kunden.tsx`): Feld „Tarifgruppe“
  entfällt.
- Kunde: Preisliste (`preisliste.tsx`, eine Preisspalte), Registrierung
  (`registrieren.tsx`, Auswahl „Tarifgruppe“ entfällt), Anzeige des
  Einheitspreises im Formular (`wizard-flow.tsx`, `truck-wizard-flow.tsx`).
- Typen, Formulare, Hilfsfunktionen: `types.ts`, `app-state.tsx`,
  `use-product-form.ts`, `use-truck-form.ts`, `use-company-form.ts`,
  `company-form-inputs.tsx`, `money.ts` (`parsePrices` → ein Preis).

**Hinweis für den Kunden:** Bisherige **Privatkunden** zahlen ab der
Umstellung den Gewerbepreis. Der ist bei Abholungen meist niedriger (z. B.
Mutterboden 8,50 € statt 12,50 €), bei Anlieferungen teils gleich. Vor der
Umstellung erstelle ich eine Liste aller betroffenen Firmen und Preise.

**Fragen an den Kunden:**

- [ ] Kurz bestätigen: Der eine Preis ist **netto**, auf der Rechnung kommen
      19 % USt dazu (bzw. §13b), also wie heute beim Gewerbepreis. Da alle
      Kunden gewerblich sind, ist das der Normalfall; Bruttoangaben für
      Verbraucher sind nicht nötig.
- [ ] Soll die öffentliche Preisliste den Hinweis „Alle Preise netto zzgl.
      USt.“ tragen?

---

## 9. E-Mail-Adresse pro Kunde (für Rechnungen und Lieferscheine)

**Anforderung:** Jeder Kunde bekommt ein Feld **E-Mail**, an das später
Rechnungen und vermutlich auch Lieferscheine geschickt werden.

**Jetzt umsetzen (Datenfeld):**

- Datenbank: Spalte `companies.email` (Text). Für bestehende Kunden zunächst
  leer, darum in der Datenbank optional; Pflicht nur in den Formularen.
- Registrierung (`registrieren.tsx`, `customer-auth.ts`): neues Pflichtfeld
  „E-Mail für Rechnungen“, mit Formatprüfung.
- Admin → Kunden (`admin.kunden.tsx`, `companies.ts`,
  `company-form-inputs.tsx`, `use-company-form.ts`): Feld beim Anlegen und
  Bearbeiten; in der Kundenliste anzeigen und Kunden **ohne** E-Mail
  hervorheben, damit der Bestand nachgepflegt werden kann.
- Backup und `db:clone` brauchen keine Anpassung (übernehmen neue Spalten
  automatisch).
- Datenschutz: Die Adresse ist nur für Admins und die eigene Firma
  sichtbar, nie in der öffentlichen Firmensuche (Punkt 1).

Der eigentliche Versand ist Punkt 10.

**Fragen an den Kunden:**

- [ ] Eine Adresse für alles, oder getrennt (Rechnungen → Buchhaltung,
      Lieferscheine → Bauleitung)? Mehrere Empfänger pro Adresse?
- [ ] Bestandskunden ohne E-Mail: pflegt das Büro nach, oder sollen Kunden
      beim nächsten Login nach ihrer E-Mail gefragt werden?
- [ ] Darf der Kunde seine E-Mail selbst ändern, oder nur das Büro?
---

## 10. Rechnungen per E-Mail an Kunden senden

**Anforderung:** Im Admin unter „Rechnungen“ eine oder mehrere Rechnungen
per Checkbox auswählen → „Per E-Mail senden“ → **Vorschau** prüfen →
bestätigen → Versand an die E-Mail des jeweiligen Kunden (Punkt 9).
Angehängt wird **nur die Rechnung als PDF**, keine Lieferscheine. Dazu
SMTP-Einstellungen und ein bearbeitbares E-Mail-Template in der App.

### 10.1 Einstellungen → E-Mail (neue Seite im Admin)

**SMTP-Zugang:** Server, Port, Verschlüsselung (SSL/TLS bzw. STARTTLS),
Benutzer, Passwort, Absendername und -adresse, optional Antwortadresse und
**BCC an das Büro** (Archivkopie jeder versendeten Rechnung). Dazu ein
Button „**Testmail senden**“ an eine frei eingegebene Adresse.

- Gespeichert in einer neuen Einstellungstabelle (wie `signup_settings`),
  nur über den Server zugänglich.
- Das **SMTP-Passwort verschlüsselt** speichern (Schlüssel als
  Umgebungsvariable in Vercel), nie an den Browser zurückgeben; im Formular
  nur „gesetzt / ändern“.

**E-Mail-Template:** Betreff und Text mit Platzhaltern, die beim Versand
ersetzt werden, z. B.

| Platzhalter | Beispiel |
| --- | --- |
| `{KUNDE}` | Muster Bau GmbH |
| `{RECHNUNGSNUMMER}` | RG-20261001-0007 |
| `{RECHNUNGSDATUM}` | 01.10.2026 |
| `{BETRAG}` | 1.725,02 € |
| `{BAUVORHABEN}` | Hauptstraße 5, Bühl |
| `{ZAHLUNGSZIEL}` | 15.10.2026 |

Mit Live-Vorschau neben dem Editor (Beispielkunde). Ein sinnvolles
Standard-Template ist vorbelegt.

### 10.2 Versand aus der Rechnungsliste

- Neue Aktion „**Per E-Mail senden**“ in der bestehenden Auswahlleiste
  (Checkboxen gibt es schon).
- **Vorschau-Dialog** vor dem Versand, nichts geht ohne Bestätigung raus:
  - pro Rechnung: Empfänger, Betreff, fertiger Text, Anhang (Dateiname,
    anklickbar zum Ansehen des PDFs),
  - Warnungen, die den Versand der betroffenen Rechnung verhindern:
    **Kunde ohne E-Mail** (mit Link zum Nachtragen), **stornierte
    Rechnung**,
  - Hinweis, wenn eine Rechnung **schon einmal gesendet** wurde (wann, an
    wen). Erneutes Senden nur mit eigenem Häkchen,
  - Button „**N E-Mails senden**“ / „Abbrechen“.
- Versand **eine Mail pro Rechnung**, nacheinander mit Fortschritt und
  Ergebnis pro Rechnung (gesendet / Fehler mit Grund). Fehler bei einer
  Rechnung stoppen nicht die anderen.
- **Versandprotokoll** (neue Tabelle): Rechnung, Kunde, Empfänger, Betreff,
  Zeitpunkt, Ergebnis, Fehlermeldung. In der Rechnungsliste erscheint ein
  Vermerk „gesendet am …“.

### 10.3 Technik

- **PDF auf dem Server erzeugen:** Heute entstehen die PDFs im Browser
  (`delivery-note-utils.ts`, jsPDF). jsPDF läuft auch auf dem Server (lokal
  bereits getestet); die Funktionen werden so umgebaut, dass sie das PDF als
  Daten zurückgeben statt es herunterzuladen, und das Logo ohne
  Browser-Funktionen laden. Download im Browser und Mail-Anhang nutzen
  dann **denselben** Code, das PDF ist also identisch.
- **SMTP-Versand** mit `nodemailer` aus einer Server-Funktion (nur Admin).
  Vercel erlaubt ausgehende Verbindungen auf Port 465/587.
- Pro Rechnung ein eigener Server-Aufruf, damit große Auswahlen nicht in
  Zeitlimits von Vercel laufen.

### 10.4 Schutz in der Entwicklung (wichtig)

Nach `npm run db:clone` stehen lokal die **echten Kunden-E-Mails** und die
**echten SMTP-Zugangsdaten** in der Datenbank. Damit lokal nie eine echte
Mail an einen Kunden geht:

- `db:clone` überschreibt die SMTP-Einstellungen lokal mit dem lokalen
  Test-Postfach (Mailpit, gehört zur lokalen Supabase).
- Zusätzlich verweigert der Server gegen die lokale Datenbank jeden Versand
  an andere Server als Mailpit (doppelte Absicherung, wie die
  Dev-Server-Sperre).
- Lokal versendete Mails sind dann unter `http://127.0.0.1:54324`
  einsehbar, ideal zum Testen von Template und Anhang.
- Dafür nötig: In `supabase/config.toml` unter `[local_smtp]` den SMTP-Port
  freigeben (`smtp_port = 54325`), und `scripts/db.mjs` darf Mailpit beim
  Start nicht mehr weglassen (`mailpit` aus `EXCLUDED_SERVICES` streichen).

### 10.5 Fragen an den Kunden

- [ ] Welcher Mail-Anbieter hostet `gaiser-abbruch.de` (z. B. IONOS, Strato,
      Microsoft 365, Google)? Gibt es SMTP-Zugangsdaten bzw. ein eigenes
      Postfach wie `rechnung@gaiser-abbruch.de`? (Bei Microsoft 365 ist
      SMTP-Anmeldung oft abgeschaltet und muss freigegeben werden.)
- [ ] Eine Mail pro Rechnung, oder mehrere Rechnungen desselben Kunden in
      **einer** Mail bündeln?
- [ ] Sollen auch **Stornorechnungen** per Mail verschickt werden können?
- [ ] BCC-Kopie ans Büro gewünscht (empfohlen als Nachweis/Archiv)?
- [ ] Reiner Text oder einfache gestaltete Mail mit Logo/Signatur?
- [ ] Was ist mit „Kundenobjekt“ gemeint: die Baustelle (Bauvorhaben) oder
      etwas anderes? Entsprechend die Platzhalter anpassen.
- [ ] **E-Rechnungspflicht (mit dem Steuerberater klären):** Nach meinem
      Stand müssen Firmen Rechnungen an andere Firmen ab 2027 (Vorjahres-
      umsatz über 800.000 €) bzw. ab 2028 (alle) als **E-Rechnung**
      ausstellen (ZUGFeRD/XRechnung). Ein reines PDF per Mail reicht dann
      nicht mehr. Wenn das Gaiser betrifft, sollte die Rechnung gleich als
      ZUGFeRD-PDF (PDF mit eingebetteten Rechnungsdaten) erzeugt werden;
      das sollte in diesen Punkt einfließen, statt später nachgebaut zu
      werden.

---

## 11. Admin: Passwort ändern (und vergessen)

**Ist-Zustand (geprüft):** Admins können sich nur anmelden
(`src/server/admin-auth.ts`). Es gibt **keine** Möglichkeit, das Passwort in
der App zu ändern, kein „Passwort vergessen“ und keine Admin-Verwaltung.
Neue Admins werden heute im Supabase-Dashboard angelegt und per SQL in
`admin_users` eingetragen.

**11.1 Passwort ändern (Kern dieses Punkts)**

- Admin → Einstellungen → Abschnitt „Mein Konto“: aktuelles Passwort, neues
  Passwort, Wiederholung.
- Server-Funktion (nur angemeldete Admins): prüft zuerst das **aktuelle**
  Passwort (erneute Anmeldung), setzt dann das neue (Supabase Auth). Das
  neue Passwort muss eine Mindestlänge haben (Vorschlag: 12 Zeichen) und
  darf nicht gleich dem alten sein.
- Danach werden **alle anderen Sitzungen** dieses Admins abgemeldet (z. B.
  auf einem anderen Gerät). Die aktuelle bleibt angemeldet bzw. wird neu
  ausgestellt.
- Lokal testbar mit dem Dev-Admin (`admin@gaiser.local`).

**11.2 Passwort vergessen (optional)**

- Link „Passwort vergessen?“ im Admin-Login → Supabase schickt einen
  Link per Mail → Seite zum Setzen des neuen Passworts.
- Voraussetzung: In Supabase (Dashboard → Authentication) muss ein
  **eigener SMTP-Server** hinterlegt sein. Der eingebaute Mailversand von
  Supabase ist stark begrenzt und nur zum Testen gedacht. Dafür könnten
  dieselben Zugangsdaten wie in Punkt 10 genutzt werden.
- Ohne 11.2 bleibt als Notlösung: Passwort im Supabase-Dashboard
  zurücksetzen (kann nur, wer Zugang zum Supabase-Projekt hat).

**11.3 Admins verwalten (optional)**

- Liste der Admins, neuen Admin per E-Mail einladen, Admin entfernen
  (nicht sich selbst, nicht den letzten).

**Fragen an den Kunden:**

- [ ] Wie viele Personen brauchen Admin-Zugang? Nutzen sich mehrere Leute
      **einen** gemeinsamen Login? (Dann ist 11.3 sinnvoll, damit jeder
      einen eigenen hat; sonst weiß man nicht, wer was gemacht hat.)
- [ ] Wird „Passwort vergessen“ gebraucht, oder reicht es, wenn ihr im
      Notfall zurücksetzt?

---

## 12. Kundentabelle: Name verschwindet, Spalten überlappen (Tablet hochkant)

**Befund (Foto vom Xoro-Tablet, Admin → Kunden):** Die Spaltenköpfe
„Kundenname“ und „Kd.-Nr.“ liegen übereinander, und in **allen Zeilen
fehlen die Firmennamen**.

**Ursache:** `src/routes/admin.kunden.tsx`, Tabelle ab Zeile 354. Die
Tabelle hat ein festes Spaltenlayout. Alle Spalten außer „Kundenname“ haben
feste Breiten (zusammen rund 59rem ≈ 944 px). „Kundenname“ bekommt nur
„20 %“ dessen, was übrig bleibt. Auf dem Tablet hochkant bleibt praktisch
nichts übrig: Die Spalte schrumpft auf null, die Überschrift läuft in die
Nachbarspalte, die Namen sind unsichtbar.

**Wechselwirkung mit Punkt 6:** Die festen Breiten sind in `rem` angegeben.
Wird die Schrift größer, werden diese Spalten breiter und das Problem
**schlimmer**. Darum zusammen mit Punkt 6 umsetzen.

**Fix (Vorschlag):**

- Weniger, sinnvollere Spalten: **Name** (flexibel, mit Mindestbreite) |
  **Kd.-Nr.** | **Adresse** (Straße und „PLZ Ort“ zweizeilig in einer
  Spalte) | **PIN** | **Aktionen**. Die Spalte „Tarifgruppe“ entfällt
  ohnehin (Punkt 8).
- Name darf umbrechen statt abgeschnitten zu werden.
- Unterhalb einer Mindestbreite: Kartenansicht wie auf dem Handy (gibt es
  in der Datei schon für kleine Bildschirme) statt einer gequetschten
  Tabelle.
- **Bearbeiten nicht mehr direkt in der Tabellenzeile** (Foto 2): Heute
  verwandelt „Bearbeiten“ die Zeile in Eingabefelder. Auf dem Tablet ist
  dann das Namensfeld unsichtbar, die Kundennummer liegt darüber, PLZ
  („7653“), Ort („Baden-Ba“) und Tarifgruppe („Unterneh“) sind
  abgeschnitten, und die Bildschirmtastatur verdeckt die untere Hälfte.
  Stattdessen öffnet „Bearbeiten“ ein **eigenes Formular** (Dialog bzw.
  Seitenbereich) mit denselben großen Feldern wie „Neuen Kunden anlegen“,
  mit „Speichern“/„Abbrechen“ oben, damit die Tastatur nichts verdeckt.
  Gleiches gilt für Material, LKW und Baustellen, die ebenfalls in der
  Zeile bearbeitet werden.
- **Passende Bildschirmtastatur:** Zahlenfelder (Kundennummer, PLZ, PIN,
  Preise, Mengen) bekommen den Ziffernblock (`inputMode="numeric"` bzw.
  `"decimal"`). Auf dem Foto erscheint beim Bearbeiten der Kundennummer die
  volle Buchstabentastatur.
- Gleiches Muster (eine Prozent-Spalte neben vielen festen) prüfen und ggf.
  anpassen: `admin.material.tsx`, `admin.lkw.tsx`, Vorgangs- und
  Rechnungsliste (`history-table.tsx`, `document-list-table.tsx`).
- Test: alle Admin- und Kundentabellen in der Breite des Xoro hochkant
  (siehe Punkt 6), vor und nach der Schriftvergrößerung, mit Screenshots.

---

## 13. Admin-Sitzung am Kiosk-Tablet

**Befund (Foto):** Am Kiosk-Tablet war der **Admin-Bereich** geöffnet.
Die Admin-Sitzung bleibt bis zu **12 Stunden** gültig, und den automatischen
Logout bei Inaktivität gibt es bisher **nur für Kunden**. Lässt jemand das
Tablet im Admin-Bereich stehen, kann der nächste Fahrer Rechnungen
stornieren, Kunden löschen usw.

**Vorschlag:**

- Inaktivitäts-Logout auch für den Admin-Bereich (Hinweis mit Countdown
  wie bei Kunden, danach Abmelden → Kunden-Login, siehe Punkt 5). Eigene,
  etwas längere Zeit einstellbar (z. B. 10 Minuten).
- Optional: Admin-Bereich am Kiosk-Gerät gar nicht anbieten (Link „Zum
  Admin-Bereich“ auf der Startseite ausblenden, wenn die App im Kiosk-
  Modus läuft, z. B. über eine eigene Kiosk-Adresse).

**Fragen an den Kunden:**

- [ ] Wird der Admin-Bereich bewusst am Kiosk-Tablet benutzt, oder war das
      nur zum Zeigen?
- [ ] Wie lange darf eine Admin-Sitzung ohne Aktivität offen bleiben?

---

## 14. Kundennummern in den Einstellungen festlegen (weiter ab 10600)

**Anforderung:** In den Einstellungen festlegen können, wie Kundennummern
erzeugt werden. Die nächsten Nummern sollen bei **10600** beginnen und
aufsteigend weitergehen (10600, 10601, …). Bisher werden sie von Hand
eingetragen (z. B. 10295, 10398, 10570).

**Ist-Zustand:**

- Wird beim Anlegen keine Kundennummer eingetragen (Admin: „leer =
  automatisch“, und immer bei der Selbstregistrierung), vergibt die App eine.
  Das Format ist aber fest im Code verdrahtet: `K-{NUMMER}`, 4-stellig
  → `K-0001`, `K-0002` (`src/server/customer-number.server.ts`). Das passt
  nicht zu den echten Nummern.
- Den Zähler gibt es in der Datenbank schon (`numbering_settings.
  next_customer_number`, wird sicher hochgezählt), er ist aber in den
  Einstellungen **nicht** sichtbar oder änderbar.

**Umsetzung:**

- Einstellungen → Nummernkreise: neuer Abschnitt **Kundennummer**, genauso
  wie Rechnungs- und Lieferscheinnummer: Format (Standard `{NUMMER}`, also
  reine Zahl), **nächste Nummer** (hier: 10600), Live-Vorschau.
- Migration: Spalte für das Format (`customer_number_template`) in
  `numbering_settings`; Format und Zähler beim Einspielen direkt auf
  `{NUMMER}` / 10600 setzen, damit es ab dem Deploy stimmt.
- `customer-number.server.ts` liest Format und Zähler aus der Datenbank
  statt aus festen Werten.
- **Keine doppelten Nummern:** Da weiter von Hand Nummern eingetragen werden
  können, überspringt die automatische Vergabe Nummern, die schon vergeben
  sind (z. B. wenn jemand 10600 bereits manuell vergeben hat). Zusätzlich
  verhindert die eindeutige Kundennummer aus der Review-Migration doppelte
  Einträge. Beim Speichern prüfen die Einstellungen, ob die eingetragene
  „nächste Nummer“ schon vergeben ist, und zeigen einen Hinweis mit der
  höchsten vorhandenen Nummer.
- Bestehende Kunden behalten ihre Nummern. Falls es Kunden mit
  automatisch vergebenen `K-0001`-Nummern gibt, listet die Bestandsaufnahme
  sie auf (siehe Frage).

**Bestandsaufnahme vorab (nur lesend, Supabase → SQL Editor):**

```sql
-- höchste numerische Kundennummer, automatisch vergebene K-Nummern, Dubletten
select max(customer_number::bigint) filter (where customer_number ~ '^\d+$') as hoechste_nummer,
       count(*) filter (where customer_number like 'K-%') as k_nummern,
       count(*) - count(distinct customer_number) as dubletten
from public.companies;
```

**Fragen an den Kunden:**

- [ ] Reine Zahl (`10600`) ohne Präfix, richtig?
- [ ] Gibt es schon Kunden mit automatisch vergebenen `K-0001`-Nummern? Sollen
      die eine richtige Nummer ab 10600 bekommen?
- [ ] Soll man Kundennummern weiterhin von Hand eintragen können, oder nur
      noch automatisch vergeben?

---

## 15. Ort automatisch aus der PLZ ausfüllen

**Anforderung:** Nach Eingabe der PLZ wird der Ort automatisch ausgefüllt,
sowohl bei der **Selbstregistrierung** (`registrieren.tsx`) als auch beim
**Anlegen/Bearbeiten durch den Admin** (`admin.kunden.tsx` /
`company-form-inputs.tsx`).

**Recherche (getestet am 01.10.2026):**

| Dienst | Ergebnis für 77815 | Bewertung |
| --- | --- | --- |
| **OpenPLZ API** (`openplzapi.org`) | Baden-Baden, Bühl, Bühlertal | kostenlos, ohne Schlüssel, offene Daten, vollständig. Liefert auch Straßen. |
| Zippopotam (`zippopotam.us`) | nur Bühl | unvollständig, nicht empfohlen |

**Wichtig:** Eine PLZ gehört oft zu **mehreren Orten** (77815 → Baden-Baden,
Bühl, Bühlertal; 77830 → Bühl, Bühlertal). Der Ort darf also nicht blind
gesetzt werden.

**Verhalten im Formular:**

- Sobald 5 Ziffern eingegeben sind, wird nachgeschlagen.
- **Ein** Ort → wird direkt eingetragen.
- **Mehrere** Orte → kleine Auswahl unter dem Feld („Bühl / Bühlertal /
  Baden-Baden“), ein Tippen trägt ihn ein.
- Hat der Benutzer den Ort schon selbst eingetragen, wird er **nicht**
  überschrieben (nur Vorschlag anzeigen).
- Das Ortsfeld bleibt immer frei bearbeitbar. Unbekannte PLZ oder Dienst
  nicht erreichbar → einfach von Hand ausfüllen, kein Fehler.

**Technik, zwei Varianten:**

1. **Live über OpenPLZ**, Abfrage über unseren Server (nicht direkt aus dem
   Browser, damit die IP der Nutzer nicht an Dritte geht und wir
   zwischenspeichern können). Wenig Aufwand, aber abhängig von einem
   fremden kostenlosen Dienst.
2. **PLZ-Daten mitliefern** (empfohlen): einmalig die Liste aller deutschen
   PLZ mit Orten (rund 8.000 PLZ, einige 100 KB) in die App bzw. Datenbank
   übernehmen und auf dem eigenen Server nachschlagen. Schnell, keine
   externe Abhängigkeit, funktioniert immer. PLZ ändern sich selten; die
   Liste kann z. B. jährlich per Skript aktualisiert werden.
   - Vor dem Einbau die **Lizenz** der Datenquelle prüfen (OpenPLZ bzw.
     GeoNames; Namensnennung ggf. im Impressum).

**Optional:** Straßen-Vorschläge passend zur PLZ (OpenPLZ kann das), damit
weniger Tippfehler in Adressen landen.

**Fragen an den Kunden:**

- [ ] Nur deutsche Adressen, oder auch Kunden aus Frankreich/Österreich/
      Schweiz? (Bühl liegt nah an Frankreich; OpenPLZ deckt DE/AT/CH ab,
      Frankreich nicht.)
- [ ] Straßen-Vorschläge gewünscht?

---

## 16. Reverse Charge (§13b) entfällt

**Anforderung:** Rechnungen ohne Umsatzsteuer nach §13b (Reverse Charge)
werden nicht mehr gebraucht. **Alle Rechnungen mit 19 % USt.**

**Ist-Zustand:** §13b steckt in 9 Dateien:

- Dialog „Rechnung erstellen“ mit Häkchen „Reverse Charge (§13b UStG)“
  (`admin.vorgaenge.tsx`),
- Rechnungs- und Storno-PDF mit eigenem §13b-Text ohne USt
  (`delivery-note-utils.ts`),
- Kennzeichnung „§13b“ in den Rechnungslisten (`history-utils.ts`,
  `admin.rechnungen.tsx`, `kunde.rechnungen.tsx`, `kunde.vorgaenge.tsx`),
- Datenbank: Spalte `records.invoice_reverse_charge`, View
  `invoice_groups`, Parameter der Funktion `create_invoice`.

**Wichtig: alte §13b-Rechnungen bleiben gültig.** Bereits gestellte
§13b-Rechnungen müssen beim erneuten Herunterladen **unverändert** (ohne
USt, mit §13b-Hinweis) erscheinen, und ihre Stornierung muss ebenfalls
ohne USt laufen. Sonst stimmt der Beleg nicht mehr mit dem überein, was der
Kunde bekommen hat. Deshalb:

- **Entfernt** wird nur die Möglichkeit, **neue** §13b-Rechnungen zu
  erstellen (Häkchen im Dialog, Parameter beim Erstellen).
- **Bleibt** (nur noch zum Lesen): die Datenbankspalte, die
  PDF-Darstellung für alte §13b-Rechnungen und deren Storno, die
  Kennzeichnung in der Liste. Gibt es in der Produktion **keine einzige**
  §13b-Rechnung, kann alles komplett entfernt werden (siehe Abfrage).

**Gute Gelegenheit:** Die Migration `20261001000000_atomic_document_workflow`
ist noch **nicht** in der Produktion. Der §13b-Parameter von
`create_invoice` kann dort vor dem ersten Einspielen direkt entfernt werden,
statt später eine weitere Migration zu brauchen.

**Bestandsaufnahme vorab (nur lesend, Supabase → SQL Editor):**

```sql
select count(distinct invoice_id) as rc_rechnungen
from public.records
where invoice_reverse_charge;
```

**Frage an den Kunden:**

- [ ] Wurden schon §13b-Rechnungen verschickt? (Wenn die Abfrage 0 ergibt,
      erübrigt sich das.)

---

## 17. Zugang zum Admin-Bereich verstecken (Kiosk)

**Anforderung:** Fahrer sollen nicht versehentlich in den Admin-Bereich
geraten und dort verwirrt vor dem Admin-Login stehen. Der Zugang soll
versteckt sein, z. B. **5× auf das Gaiser-Logo tippen**.

**Ist-Zustand:** Auf der Kunden-Login-Seite steht ein sichtbarer Link „Zum
Admin-Bereich“ (`src/routes/index.tsx`, Zeile 165). Sonst gibt es keinen
Link dorthin.

**Umsetzung:**

- Link „Zum Admin-Bereich“ entfernen.
- **Versteckte Geste:** 5× auf das Logo der Login-Seite tippen, innerhalb
  von 3 Sekunden → Admin-Login öffnet sich. Kein sichtbarer Hinweis, kein
  Effekt bei einzelnen Tippern. (Alternative: Logo 3 Sekunden gedrückt
  halten. Beides funktioniert mit Touch und Maus.)
- Am Büro-PC bleibt `…/admin` direkt aufrufbar (Lesezeichen).
- Hinweis: Das Verstecken schützt vor Verwirrung, nicht vor Missbrauch.
  Der Schutz ist weiterhin das Admin-Passwort.

**Kiosk darf nie auf dem Admin-Login hängen bleiben (kritisch):**
Bleibt das Tablet auf dem Admin-Login stehen, kann sich kein Fahrer
anmelden. Deshalb landet man **in jedem Fall** wieder auf der
Kunden-Login-Seite:

- nach „Abmelden“ im Admin-Bereich (Punkt 5),
- nach automatischem Admin-Logout wegen Inaktivität (Punkt 13),
- wenn die Admin-Sitzung abläuft (entschieden: Kunden-Login, nicht
  Admin-Login; erledigt die offene Frage aus Punkt 5). Dafür müssen die 8
  Admin-Unterseiten (`admin.vorgaenge.tsx`, `admin.rechnungen.tsx`,
  `admin.kunden.tsx`, `admin.material.tsx`, `admin.lkw.tsx`,
  `admin.baustellen.tsx`, `admin.einstellungen.tsx`,
  `admin.neuer-vorgang.tsx`) ohne gültige Sitzung auf `/` statt wie heute
  auf `/admin` umleiten,
- **neu:** wenn der Admin-Login **geöffnet, aber nicht benutzt** wird
  (z. B. 60 Sekunden ohne Eingabe) → automatisch zurück zur Kunden-Login-
  Seite, plus ein Button „Zurück“ auf der Admin-Login-Seite.

**Fragen an den Kunden:**

- [ ] 5× Tippen aufs Logo oder lieber lange gedrückt halten?
- [ ] Wie lange darf der unbenutzte Admin-Login offen bleiben (Vorschlag:
      60 Sekunden)?

---

## 18. Preisliste direkt unter dem Kunden-Login

**Anforderung:** Die Preisliste nicht mehr auf einer eigenen Seite,
sondern direkt **unter dem Kunden-Login** anzeigen. Auf dem Tablet hochkant
ist dort viel freier Platz.

**Ist-Zustand:** Eigene Seite `/preisliste` (`src/routes/preisliste.tsx`)
mit zwei Tabellen „Anlieferungen“ und „Abfuhren“, erreichbar über den Link
„Preisliste anschauen“ auf der Login-Seite. Die Daten kommen öffentlich,
ohne Anmeldung (`src/server/price-list.ts`).

**Umsetzung:**

- Die Tabellen der Preisliste als eigene Komponente aus `preisliste.tsx`
  herauslösen und auf der Login-Seite (`src/routes/index.tsx`) unter dem
  Anmeldeformular einbauen. Link „Preisliste anschauen“ entfällt.
- Passt gut zu Punkt 8: Mit nur noch **einem Preis** ist die Tabelle
  schmal (Material | Einheit | Preis) und gut lesbar, auch mit größerer
  Schrift (Punkt 6).
- Reihenfolge auf der Seite: Login oben (Hauptaufgabe), darunter die
  Preisliste. Auf dem Tablet hochkant untereinander; auf breiten
  Bildschirmen ggf. nebeneinander.
- **Login-Bereich für den Kiosk neu aufteilen** (Foto 3, Login-Seite am
  Gerät): Heute belegt der Login nur das **obere Fünftel** des
  Bildschirms, der Rest ist leer. Überschrift („Material ohne Umwege“)
  und Formular stehen nebeneinander, das Formular ist dadurch schmal und
  winzig. Neu: **eine Spalte über die volle Breite**, Logo und kurze
  Überschrift oben, darunter das Formular mit großen Feldern und großem
  „Anmelden“-Button (Punkt 6), dann die Preisliste. Links
  („Registrieren“) groß genug zum Antippen.
- Hinweis „Alle Preise netto zzgl. USt.“ (siehe Frage in Punkt 8).
- Die Seite `/preisliste` bleibt zusätzlich bestehen, falls sie verlinkt
  ist (Website, QR-Code), oder entfällt (siehe Frage).

**Fragen an den Kunden:**

- [ ] Soll `/preisliste` als eigene Adresse erhalten bleiben (z. B. für einen
      Link von der Firmenwebsite oder einen QR-Code am Tor)?
- [ ] Materialbilder in der Preisliste anzeigen? (Fotos sind pro Material
      schon hinterlegbar, Admin → Material.)

---

## 19. Mitarbeiter-Login für LKW-Fahrer (+ Lieferscheine fotografieren)

**Anforderung:**

1. Eigener **Login für Mitarbeiter** (LKW-Fahrer).
2. Fahrer können dieselben drei Vorgänge anlegen wie heute: **Material
   bringen**, **Material holen**, **LKW-Stunden** buchen.
3. Fahrer bringen viele **Papier-Lieferscheine** mit. Die sollen sie
   **abfotografieren und hochladen** können.

### 19.1 Rolle „Mitarbeiter“

Neue, dritte Rolle neben Kunde und Admin, mit bewusst wenig Rechten:

| Darf | Darf nicht |
| --- | --- |
| Vorgänge für **jeden Kunden** anlegen (Kunde auswählen, wie Admin → „Neuer Vorgang“) | Rechnungen, Storno, Einstellungen, Kunden/Material/LKW bearbeiten |
| Lieferscheine fotografieren und hochladen | Preise oder Kundendaten ändern |
| die eigenen Buchungen der letzten Tage sehen (Kontrolle, Lieferschein erneut herunterladen) | Vorgänge anderer Mitarbeiter ändern |

- **Datenbank:** Tabelle `employees` (Name, PIN-Hash, aktiv/inaktiv,
  PIN-Sperre wie bei Kunden). In jedem Vorgang wird gespeichert, **welcher
  Mitarbeiter** ihn gebucht hat (`records.created_by_employee_id`), damit
  das Büro nachvollziehen kann, wer was eingetragen hat.
- **Admin → Mitarbeiter:** anlegen, PIN zurücksetzen, deaktivieren (z. B.
  wenn jemand ausscheidet). Kein Löschen, damit die Zuordnung in alten
  Vorgängen erhalten bleibt.
- **Login:** Vorschlag **Name auswählen + PIN** (wie bei Kunden): schnell am
  Kiosk, kein Passwort tippen. Eigene Sitzung mit **kurzem
  Inaktivitäts-Logout**, weil sich mehrere Fahrer das Tablet teilen;
  danach zurück zur Kunden-Login-Seite (wie Punkt 17).
- Erreichbar über einen Bereich „Mitarbeiter“ auf der Login-Seite (oder
  versteckt wie der Admin-Zugang, siehe Frage).
- Technisch baut das auf der bestehenden Kunden-Anmeldung auf (eigenes
  Session-Cookie, Prüfung in `requireAnySession`), und der Assistent „Neuer
  Vorgang“ wird wiederverwendet. Der Preis ergibt sich aus dem gewählten
  Kunden (nach Punkt 8 ohnehin nur noch einer).

### 19.2 Lieferscheine fotografieren und hochladen

**Geht das in der Web-App? Ja.** Ohne App-Store und ohne Installation:

- **Einfachste Variante:** Upload-Feld, das auf Handy/Tablet direkt die
  **Kamera öffnet** (`<input type="file" accept="image/*"
  capture="environment">`). Mehrere Fotos nacheinander, Vorschau, dann
  hochladen.
- **Kiosk-Variante:** **Live-Kamerabild** in der App (Browser-Kamera-
  Zugriff), Lieferschein davorhalten, „Foto aufnehmen“ tippen. Braucht
  HTTPS (ist gegeben) und die Kamera-Freigabe im Kiosk-Programm.

**Wichtig, am Gerät klären:** Wall-montierte Kiosk-Displays haben meist nur
eine **Frontkamera** (beim Foto vom Gehäuse ist rechts vermutlich eine
Kamera-Öffnung zu sehen). Ein Papier vor eine Frontkamera zu halten
funktioniert, ist aber unhandlich, vor allem bei vielen Lieferscheinen.
Deutlich praktischer: Der Fahrer nutzt die App auf **seinem Handy**
(Rückkamera, scharfe Fotos, auch direkt im LKW). Oder es kommt ein kleiner
**Dokumentenscanner** neben das Tablet.

**Ablauf (Vorschlag):**

1. Mitarbeiter → „Lieferscheine hochladen“.
2. Kunde auswählen (optional: zugehöriger Vorgang), Fotos aufnehmen
   (beliebig viele), optional Notiz.
3. Fotos werden **auf dem Gerät verkleinert** (ca. 2000 px, JPEG): etwa
   300–500 KB pro Foto statt 3–8 MB, aber gut lesbar. Spart Upload-Zeit
   und Speicher.
4. Upload direkt in einen **privaten** Speicherbereich (Supabase Storage,
   nicht öffentlich wie die Materialbilder), über zeitlich begrenzte
   Upload-Links. Große Dateien laufen damit nicht durch die
   Vercel-Funktionen (dort ist die Anfragegröße begrenzt).
5. **Admin → Lieferschein-Eingang:** Liste nach Datum/Kunde/Fahrer,
   Fotos ansehen und herunterladen, als „erledigt“ markieren.

**Speicherplatz und Kosten beachten:** Der kostenlose Supabase-Tarif hat
**1 GB** Dateispeicher. Beispiel: 50 Fotos am Tag × 400 KB ≈ 20 MB/Tag ≈
**5 GB/Jahr**. Das heißt: Wechsel auf den bezahlten Tarif (Supabase Pro,
derzeit ca. 25 $/Monat inkl. 100 GB) oder Fotos nach einer Frist löschen.
Bei der Frist beachten: Wenn die Lieferscheine Buchungsbelege sind, gelten
Aufbewahrungspflichten von mehreren Jahren (mit dem Steuerberater klären).

**Datenbank:** Tabelle `delivery_note_photos` (Speicherpfad, Kunde,
optional Vorgang, hochgeladen von Mitarbeiter, Zeitpunkt, Notiz, Status
„erledigt“) plus privater Storage-Bucket mit Zugriff nur für Admins und
die hochladende Person.

**Geklärt beim Termin:**

- Das Kiosk-Tablet **hat eine Kamera** → am Kiosk die Variante mit
  Live-Kamerabild; auf dem Handy öffnet das Upload-Feld die Rückkamera.
  Beides wird eingebaut.
- Die Lieferscheine sind **Belege von Deponien u. ä.**, also fremde Belege,
  keine Gaiser-Lieferscheine. Sie landen in einem **Eingangskorb fürs
  Büro** (Fahrer, Datum, Fotos, Notiz). Die Zuordnung zu einem Kunden bzw.
  einer Baustelle ist optional (siehe Frage unten).

### 19.3 Fragen an den Kunden

- [ ] Soll ein Deponie-Lieferschein einem **Kunden/einer Baustelle**
      zugeordnet werden (z. B. um Entsorgungskosten weiterzuberechnen), oder
      reicht der Eingangskorb mit Fahrer + Datum? Feste Liste der Deponien
      zum Auswählen gewünscht?
- [ ] Welche Kamera hat das Xoro (vorne/hinten), und erlaubt das
      Kiosk-Programm den Kamerazugriff im Browser?
- [ ] Wie viele Fahrer? Eigener Login pro Fahrer (empfohlen: man sieht, wer
      was gebucht hat) oder ein gemeinsamer Mitarbeiter-Login?
- [ ] Login mit **Name + PIN** am Kiosk ok?
- [ ] Wie viele Lieferscheine fallen ungefähr pro Tag an? (für die
      Speicherplanung)
- [ ] Wie lange müssen die Fotos aufbewahrt werden?
- [ ] Mitarbeiter-Zugang sichtbar auf der Login-Seite, oder versteckt wie
      der Admin-Zugang?
- [ ] Sollen Fahrer bei LKW-Stunden noch mehr angeben (z. B. Kennzeichen,
      Start/Ende statt nur Stunden)?

---

## 20. Daten aktualisieren sich am Kiosk nicht (neue Kunden fehlen)

**Meldung:** Der Kunde hat zu Hause Kunden angelegt; am Tablet waren sie
nicht da.

**Geprüft (lokal im Browser, Seite offen gelassen, Kunde „von woanders“
angelegt):**

| Situation | Firmenliste neu geladen? |
| --- | --- |
| Seite neu laden | ja |
| Seitenwechsel innerhalb der App | **nein** |
| Seite bleibt offen (auch nach über 1 Minute) | **nein** |
| Bildschirm aus/an bzw. App gewechselt | ja |

**Ursache:** TanStack Query lädt **nicht laufend** nach, sondern nur bei
bestimmten Ereignissen: wenn eine Seite ihre Daten neu einbindet, wenn das
Fenster wieder in den Vordergrund kommt, nach eigenen Änderungen. Ein
Regelmäßig-Nachladen ist nirgends eingestellt.

- Ein Kiosk ist **dauerhaft im Vordergrund**, das Vordergrund-Ereignis
  kommt also nie.
- Firmen, Materialien, LKW und Baustellen werden **einmal ganz oben** in der
  App geladen (`AppStateProvider` in `src/state/app-state.tsx`), nicht pro
  Seite. Seitenwechsel lösen dort kein Nachladen aus. Am Tablet bleiben
  sie auf dem Stand des letzten Neustarts. Betroffen: Firmensuche beim
  Login, Admin → Kunden, Material- und LKW-Auswahl im Formular.
- Listen mit eigenem Abruf (Vorgänge, Rechnungen) laden beim **Öffnen** der
  Seite neu, aber nicht, solange man auf der Seite bleibt.
- Der Service Worker (`public/sw.js`) speichert nichts zwischen, er ist
  nicht die Ursache.

**Verwandtes Problem: neue Versionen kommen nicht an.** Aus demselben
Grund läuft am Kiosk nach einem Deploy weiter der **alte Programmstand**,
bis die Seite neu geladen wird. Deshalb zeigte das Tablet beim Termin noch
die Version vor dem Review.

**Fix:**

1. **Regelmäßig nachladen, solange die Seite sichtbar ist:** Standard für
   alle Abfragen z. B. alle 60 Sekunden (Listen wie Vorgänge/Rechnungen
   ggf. 30 Sekunden). Die Datenmenge ist klein, das ist für Supabase
   unproblematisch.
2. **Bei jedem Seitenwechsel** die zentral geladenen Daten (Firmen,
   Materialien, LKW, Baustellen) neu abrufen.
3. Die Firmensuche beim Login wird mit P1 ohnehin eine Server-Suche und ist
   damit **immer aktuell**.
4. **Neue Version automatisch laden:** Die App fragt regelmäßig die
   aktuelle Versionsnummer ab. Ist eine neuere live, lädt sie sich neu,
   aber nur, wenn gerade niemand etwas eingibt (z. B. auf der Login-Seite
   ohne Eingabe bzw. nach dem Inaktivitäts-Logout). So gehen keine halb
   ausgefüllten Formulare verloren.
5. Zusätzliche Absicherung am Gerät: im Kiosk-Programm ein **nächtlicher
   Neustart der Seite** (die meisten Kiosk-Programme können das).

(Sofortige Übertragung per „Live-Updates“ über Supabase Realtime wäre
möglich, ist hier aber nicht nötig. Regelmäßiges Nachladen ist einfacher und
robuster.)

---

## 21. Weitere Punkte vom Termin

_(werden ergänzt)_

---

## Offene Fragen an den Kunden (allgemein)

- [ ] ~~Privatpreise netto oder brutto?~~ Erledigt durch Punkt 8 (Privatpreis
      entfällt). Die Netto-/Brutto-Frage steht dort für den einen Preis.
- [ ] Rate-Limit pro IP für Login und Firmensuche gewünscht? Braucht einen
      kleinen Zusatzdienst (z. B. Upstash Redis über Vercel) oder eine
      Tabelle in der Datenbank.

## Bereits umgesetzt, aber noch nicht in Produktion

Vor dem nächsten Deploy in die Produktion einspielen (Reihenfolge beachten):

1. `20261001000000_atomic_document_workflow.sql`: Rechnung/Storno/bezahlt
   als Transaktion, Dokumentdaten, PIN-Sperre.
2. `20261001010000_explicit_data_api_grants.sql`: ausdrückliche Rechte,
   in der Produktion wirkungslos.
3. Danach erst den Code deployen.
