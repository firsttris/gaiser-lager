# Assets für serverseitig erzeugte PDFs (E-Rechnung)

| Datei | Herkunft | Lizenz |
| --- | --- | --- |
| `Logo.jpeg` | Kopie von `public/assets/Logo.jpeg` | Gaiser |
| `LiberationSans-Regular.ttf`, `LiberationSans-Bold.ttf` | Liberation Fonts 2.1.5 (metrisch identisch zu Helvetica/Arial, das Layout bleibt gleich) | SIL Open Font License 1.1 |
| `srgb-icc.ts` (Base64) | ICC-Profil „sRGB2014“ (v2), aus dem npm-Paket `pdfkit` | © International Color Consortium, frei weitergebbar |

PDF/A-3 (Voraussetzung für ZUGFeRD) verlangt eingebettete Schriften und ein
Farbprofil; die Standardschrift Helvetica von jsPDF wird nicht eingebettet.
