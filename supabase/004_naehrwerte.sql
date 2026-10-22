-- Ausführliche Nährwerte (KH, Zucker, Fett, gesättigte Fettsäuren, Ballaststoffe, Salz) und Bilder.
-- Mehrfach ausführbar.
alter table public.zutaten
  add column if not exists kh numeric, add column if not exists zucker numeric,
  add column if not exists fett numeric, add column if not exists ges_fett numeric,
  add column if not exists ballast numeric, add column if not exists salz numeric,
  add column if not exists naehr_quelle text,   -- 'Etikett' oder 'Richtwert'
  add column if not exists bild text;            -- Bild vom Etikett (Pfad in der App, z. B. img/milch-naehrwerte.jpg)
alter table public.rezepte add column if not exists bild text;
alter table public.eintraege
  add column if not exists zucker numeric, add column if not exists ges_fett numeric,
  add column if not exists ballast numeric, add column if not exists salz numeric;
select 'ok' as naehrwerte;
