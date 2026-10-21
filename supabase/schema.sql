-- TorGunnar backend. Legges til i det EKSISTERENDE Supabase-prosjektet
-- (samme prosjekt som Honniscoins/Handleliste: vkhktataxypuobrzslbi).
-- Kjøres én gang i SQL editor.

create table if not exists public.torgunnar_rooms (
  room_hash text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Tabellen nås kun via Edge Function (med service_role), ikke direkte fra klient.
alter table public.torgunnar_rooms enable row level security;

-- Edge Function "torgunnar" (speiler Honniscoins/Handleliste):
--   POST { room, action:"load" }        -> { data: <blob|null>, updated_at }
--   POST { room, action:"save", data }  -> { ok: true }
-- Funksjonen hasher `room` (SHA-256 -> hex) til room_hash for upsert/select mot tabellen over.
-- CORS: tillat POST + OPTIONS (personlig familie-app).
-- Frontend peker på funksjonen via EDGE_FUNCTION_URL i index.html.
