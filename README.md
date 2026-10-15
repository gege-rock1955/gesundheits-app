# Wochenteller – persönliche Gesundheits-App

Web-App (PWA) für iPhone und Android: Wochen-Ernährungsplan, Einkaufsliste mit Vorrat,
Favoriten-Radar für Supermarkt-Angebote und Trainingspläne mit Satz-Logging.

- **Daten:** eigene Supabase-Datenbank (Region Frankfurt), geschützt durch Login und Row Level Security.
- **App:** statische Dateien (`index.html`, `app.js`, `style.css`), gehostet über GitHub Pages.
- **KI:** austauschbar. Claude (oder ein anderes Modell) greift nur über die Datenbank zu.

## Installation aufs iPhone
1. Die Seite in **Safari** öffnen.
2. Teilen-Symbol → **Zum Home-Bildschirm**.

## Datenbank
- `supabase/001_schema.sql` – Tabellen, RLS-Regeln, Rechte.
- Persönliche Startdaten werden nicht im Repository gespeichert.

Im Code stehen keine Passwörter. Der Publishable Key in `config.js` ist für den Browser bestimmt.
