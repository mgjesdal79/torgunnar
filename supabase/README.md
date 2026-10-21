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

## Tilgang: romkode (build 18)
- Rommet er IKKE lenger hardkodet i utsendt kode. Koden tastes inn på en låseskjerm
  og lagres kun lokalt (`localStorage['torgunnar:code']`). Rommet utledes av koden:
  `room = 'tgc-' + normalisertKode` (små bokstaver, kun a-z0-9 – hyphen/case spiller ingen rolle).
  Uten riktig kode kan ingen bygge riktig forespørsel → ingen ser dataene.
- Bytt/lås kode: Innstillinger → «Lås / bytt romkode».
- **Engangs-migrering:** enheter som allerede hadde data lokalt (gammel nøkkel) flytter
  notatene til det nye kode-rommet ved første opplåsing. En fersk/feil kode arver IKKE
  de gamle notatene (migreringen trigges kun når lokal gammel-data finnes).
- **Oppryddings-TODO (valgfritt):** den gamle faste rom-raden
  (`room_hash` = SHA-256 av `tg-fb6fd95a-7707-4a9a-911f-e96c74a323ec-c2a67df1`) ligger igjen
  i tabellen. Når begge enheter er migrert kan den slettes i SQL Editor så gamle notater
  ikke kan leses av noen som finner det gamle rom-navnet i git-historikken.

## Kontrakt
- `POST { room, action:"load" }` → `{ data: <blob|null> }`
- `POST { room, action:"save", data }` → `{ ok: true }`
