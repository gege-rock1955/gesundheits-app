# Wochenteller – Hinweise für Claude

Persönliche Gesundheits-App (PWA) ohne Build-Schritt: reines HTML/CSS/JavaScript (ES-Module),
gehostet über GitHub Pages, Daten in Supabase (Login + Row Level Security).
Der Besitzer ist kein Entwickler: Antworten auf Deutsch, einfach, ohne Fachjargon.

## Skills
Unter `.claude/skills/` liegen sieben Engineering-Skills (Quelle und Auswahl: `.claude/skills/README.md`).
Für Oberflächen-Arbeit gilt `frontend-ui-engineering`, vor jedem Commit `code-review-and-quality`,
bei allem rund um Login, Daten und Fotos `security-and-hardening`.

## Aufbau
- `index.html` – Hülle, Menü, Content-Security-Policy (neue fremde Adressen dort eintragen!)
- `core.js` – Zustand `S`, Hilfen (`esc`, `fmt`, Datum), Rechnen (Ziele, Verbrauch, Streak)
- `app.js` – Ansichten (`VIEWS.*`) und Aktionen (`ACT.*`, ausgelöst über `data-act`)
- `add.js`, `training.js`, `koerper.js`, `trends.js`, `profil.js` – einzelne Bereiche
- `demo.js` – Test-Datenbank im Browser für `?demo`
- `style.css` – Design-Tokens in `:root` (hell + dunkel), keine Farben außerhalb der Tokens erfinden
- `sw.js` – Offline-Cache: bei jeder Änderung `C` hochzählen (`wt-v15` → `wt-v16`)
- `supabase/*.sql` – Schema und RLS-Regeln

## Regeln
- Alle Texte aus der Datenbank oder vom Nutzer im HTML mit `esc()` einsetzen.
- Keine Inline-Event-Handler (`onclick=`), stattdessen `data-act` + `ACT.name`; die CSP blockiert sie.
- Knöpfe: echte `<button>`, Tippfläche ≥ 44 px, Icon-Knöpfe mit `aria-label`.
- Text-Kontrast ≥ 4,5:1 in hell UND dunkel.
- Keine persönlichen Daten ins Repository (es ist öffentlich).

## Prüfen
Lokal starten: `python3 -m http.server 8765`, dann `http://localhost:8765/index.html?demo`.
Die Demo braucht keine Datenbank. Vor dem Commit prüfen: keine Fehler in der Konsole, kein
waagrechtes Scrollen bei 320 px und 390 px Breite, hell und dunkel ansehen.
