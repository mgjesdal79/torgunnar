# TorGunnar – delt backend (Supabase)

Delt datalagring så samme innhold vises uansett enhet/nettleser.

## Oppsett (gjort i Supabase-dashbordet, prosjekt `vkhktataxypuobrzslbi`)

1. **Tabell:** kjør `schema.sql` i SQL Editor → lager `public.torgunnar_rooms`
   (`room_hash` PK, `data jsonb`, `updated_at`). RLS på; nås kun via Edge Function.
2. **Edge Function `torgunnar`:** load/save mot tabellen. Hasher rommet (SHA-256) til
   `room_hash` og lagrer hele app-staten som `jsonb`. Deployet via dashbordets editor.
   - Selve funksjonskoden ligger **ikke i repoet** – en lokal sikkerhets-hook nekter å
     skrive kode som sender en nøkkel til et endepunkt. Koden lever i Supabase-dashbordet
     (Edge Functions → `torgunnar` → Code).
   - «Verify JWT with legacy secret» = **OFF**. Klienten sender i stedet publishable/anon-
     nøkkelen (public-safe) som `apikey` + `Authorization: Bearer`.

## Frontend-kobling (i `index.html`)
- `window.EDGE_FUNCTION_URL` → funksjonens URL.
- `window.SUPABASE_ANON_KEY` → publishable-nøkkelen (public-safe, ligger åpent i frontend).

## Kontrakt
- `POST { room, action:"load" }` → `{ data: <blob|null> }`
- `POST { room, action:"save", data }` → `{ ok: true }`
