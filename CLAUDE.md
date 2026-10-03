# Hinweise für Claude

Kontext, der in jeder Sitzung gilt. Details zu Setup und Datenbank stehen in der README.

## Das Kiosk-Tablet

- Gerät: **XORO MegaPAD 2154 V7**, 21,5 Zoll, Full HD, Android 13, Touch.
- Es hängt im Lager **hochkant**. Die Bildschirmgröße ist **1080 × 1920** (Breite × Höhe).
- Kunden und Fahrer bedienen es per Finger. Tasten sind groß, in der Regel mindestens
  56 px hoch.
- Die Android-Tastatur soll möglichst nicht aufgehen. PIN, Mengen und Stunden laufen über
  eigene Zifferntasten, Baustellen über Tasten. Nur zum Suchen oder Anlegen einer neuen
  Baustelle darf getippt werden.
- Schriftgröße ist pro Gerät umschaltbar: A (normal), A+ (large), A++ (xlarge). Jede
  Änderung muss bei allen drei Größen ohne Überlappung funktionieren.

## Prüfen

- Playwright läuft im Projekt `kiosk-xoro-hochkant` mit 1080 × 1920, Touch
  (`playwright.config.ts`). Screenshots für Kunden oder zum Prüfen immer in dieser
  Auflösung und als ganze Seite machen, nicht ausgeschnitten.
- `e2e/kiosk-layout.spec.ts` prüft bei allen drei Schriftgrößen auf seitliches Scrollen,
  überlappende Schaltflächen und Text, der aus seinem Knopf ragt. Neue Kiosk-Seiten dort
  ergänzen.
- `e2e/screenshots.spec.ts` fotografiert bei jedem CI-Lauf alle Seiten (normal und die
  Kiosk-Seiten in A++) und die Vorzeigebilder mit „Muster Bau GmbH“. Sie liegen als
  Artefakt `screenshots` am Lauf. Jedes Bild durchläuft dieselbe Layout-Prüfung. Neue
  Seiten dort ergänzen. Nach UI-Änderungen die
  Bilder aus dem Artefakt ansehen.
- Vor jedem Push: `npx tsc --noEmit -p tsconfig.json`, `npm test`, `npm run build`.
  Die E2E-Tests (`npm run e2e`) brauchen die lokale Supabase (`npm run db:start`). In der
  Cloud-Umgebung lädt Docker die Supabase-Images nicht, dort laufen sie nur in der CI.

## Arbeitsweise mit PRs

- PRs werden per **Squash** gemergt. Vor jedem Push prüfen, ob der PR des Branches noch
  offen ist. Ist er schon gemergt, den Branch auf `main` bringen und einen **neuen** PR
  aufmachen, statt auf den gemergten zu pushen.
- Kein Force-Push. Einen gemergten Branch per Merge von `main` nachziehen.
- Oberfläche, Commit-Nachrichten und PR-Beschreibungen auf Deutsch.
