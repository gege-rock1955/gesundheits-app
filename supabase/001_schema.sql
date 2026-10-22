-- Gesundheits-App – Grundschema v1
-- Jede Zeile gehört einem Nutzer (user_id = auth.uid()); RLS sperrt alles andere.

create or replace function public.tg_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ===== Ernährung =====
create table if not exists public.zutaten (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  einheit text not null default 'g',          -- 'g' (auch ml) oder 'Stk'
  packung numeric, pack_name text,
  kcal numeric default 0, eiweiss numeric default 0,  -- pro 100 g bzw. pro Stück
  bereich text, haltbar_tage int,
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

create table if not exists public.rezepte (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null, kurz text,
  portionen int not null default 1,
  zutaten jsonb not null default '[]',        -- [{id, menge}]
  zubereitung text,
  quelle text,                                -- z. B. Instagram, Screenshot
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

create table if not exists public.wochen (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  woche text not null,                        -- ISO-Woche, z. B. 2026-W42
  plan jsonb not null default '{}',           -- {mo:{rezept,salat}, ...}
  kantine_tag jsonb not null default '{}',    -- {mo:{kcal,eiweiss,notiz}}
  updated_at timestamptz default now(),
  primary key (user_id, woche)
);

create table if not exists public.bestand (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  zutat_id text not null,
  menge numeric not null default 0,
  updated_at timestamptz default now(),
  primary key (user_id, zutat_id)
);

create table if not exists public.einstellungen (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, key)
);

-- ===== Einkauf / Angebote =====
create table if not exists public.favoriten (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null, lager text, regel text,
  im_plan boolean default false, referenz text,
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

create table if not exists public.angebote (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  fav text, haendler text, produkt text, preis text, grundpreis text,
  bedingung text, bis date, pruefen text,
  gefunden_am timestamptz default now(),
  primary key (user_id, id)
);

create table if not exists public.filialen (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  haendler text, name text, via text, url text, aktiv boolean default true,
  primary key (user_id, id)
);

-- ===== Fitness =====
create table if not exists public.geraete (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  foto_url text,
  gewicht_schritt numeric default 5,          -- kg pro Stufe
  gewicht_min numeric default 0, gewicht_max numeric,
  notiz text,
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

create table if not exists public.uebungen (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  geraet_id text,
  muskeln text[] default '{}',                -- z. B. {latissimus,bizeps}
  animation_url text,
  hinweis text,
  sehnen_belastung boolean default false,     -- Achillessehne
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

create table if not exists public.trainingsplaene (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null,
  name text not null,
  tage jsonb not null default '[]',           -- [{name, uebungen:[{uebung_id,saetze,wdh_min,wdh_max,hinweis}]}]
  aktiv boolean default true,
  updated_at timestamptz default now(),
  primary key (user_id, id)
);

create table if not exists public.trainings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  plan_id text, tag_name text,
  datum date not null default current_date,
  schmerz boolean, notiz text,
  created_at timestamptz default now()
);

create table if not exists public.saetze (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  training_id uuid not null references public.trainings on delete cascade,
  uebung_id text not null,
  nr int not null,
  gewicht numeric, wdh int,
  created_at timestamptz default now()
);
create index if not exists saetze_uebung on public.saetze (user_id, uebung_id, created_at desc);

-- ===== Tageswerte (Apple Health über Kurzbefehle, Kantine, Shake usw.) =====
create table if not exists public.tageswerte (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  datum date not null,
  quelle text not null,                        -- 'health', 'kantine', 'manuell' …
  werte jsonb not null default '{}',           -- {schritte, aktiv_kcal, kcal, eiweiss}
  updated_at timestamptz default now(),
  primary key (user_id, datum, quelle)
);

-- ===== RLS, Rechte, Trigger =====
do $$
declare t text;
begin
  foreach t in array array['zutaten','rezepte','wochen','bestand','einstellungen','favoriten','angebote','filialen','geraete','uebungen','trainingsplaene','trainings','saetze','tageswerte']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists eigene_daten on public.%I', t);
    execute format('create policy eigene_daten on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
  foreach t in array array['zutaten','rezepte','wochen','bestand','einstellungen','favoriten','geraete','uebungen','trainingsplaene','tageswerte']
  loop
    execute format('drop trigger if exists touch on public.%I', t);
    execute format('create trigger touch before update on public.%I for each row execute function public.tg_touch()', t);
  end loop;
end $$;
