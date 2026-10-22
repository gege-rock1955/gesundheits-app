-- Erweiterung: Essens-Einträge (Foto, Barcode, schnell), Foto-Speicher, Schmerzwert 0–10.
-- Mehrfach ausführbar.

create table if not exists public.eintraege (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  datum date not null default current_date,
  slot text not null default 'snack',          -- frueh | mittag | abend | snack
  name text not null,
  menge numeric, einheit text,
  kcal numeric, eiweiss numeric, kh numeric, fett numeric,
  quelle text not null default 'manuell',      -- manuell | foto | barcode | zuletzt
  barcode text,
  foto_pfad text,                              -- Pfad im Bucket "fotos"
  foto_gesichert boolean not null default false,
  status text not null default 'fertig',       -- 'offen' = Foto wartet auf Schätzung
  notiz text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists eintraege_datum on public.eintraege (user_id, datum);

alter table public.trainings add column if not exists schmerz_wert int check (schmerz_wert between 0 and 10);

alter table public.eintraege enable row level security;
drop policy if exists eigene_daten on public.eintraege;
create policy eigene_daten on public.eintraege for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
grant select, insert, update, delete on public.eintraege to authenticated;
revoke all on public.eintraege from anon;
drop trigger if exists touch on public.eintraege;
create trigger touch before update on public.eintraege for each row execute function public.tg_touch();

-- Foto-Speicher: privat, max. 2 MB pro Bild, nur eigene Ordner (<user_id>/...)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 2097152, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists fotos_lesen on storage.objects;
drop policy if exists fotos_hochladen on storage.objects;
drop policy if exists fotos_aendern on storage.objects;
drop policy if exists fotos_loeschen on storage.objects;
create policy fotos_lesen on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fotos_hochladen on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fotos_aendern on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy fotos_loeschen on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (storage.foldername(name))[1] = (select auth.uid())::text);

select 'ok' as erweiterung;
