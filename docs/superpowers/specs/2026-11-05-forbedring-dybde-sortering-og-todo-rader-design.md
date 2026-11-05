# Forbedring: dybde + manuell rekkefølge, og mer tilfredsstillende todo-rader

**Dato:** 2026-11-05
**Status:** Godkjent – implementeres (del A = build23, del B = build24)

## Mål

To uavhengige UI-forbedringer, besluttet med Martin:

- **Del A (Forbedring 🌱):** plass til dyptgående påfyll uten å gjøre lista uoversiktlig,
  og mulighet til å styre rekkefølgen selv.
- **Del B (todo-rader):** lavere rad-høyde og en mer tilfredsstillende avkryssing.

---

## Del A – Forbedring (build23)

### Datamodell (`js/logic.js`)
- Nytt felt `depth` på item (Markdown-kilde, nullbar) – søsken til `body`.
- Nytt felt `order` (tall) for manuell rekkefølge. **Lavere tall = høyere opp.**
- `addItem` tar med `depth` og `order` (default `null`), uendret for eksisterende kall.
- `addImprovement({text, body, depth})` gir nye forbedringer `order = min(eksisterende) - 1`
  → legger seg **øverst** (beholder «nyest øverst» som default).
- `improvementItems` sorterer på `order` stigende, med `createdAt` desc som tiebreak.
- `migrate` **backfiller** `order` på forbedringer laget før feltet fantes
  (nyeste får lavest order), kun når ingen har order ennå.
- `setItemDepth(state,{id,depth},ctx)` – speiler `setItemBody` (trimmer, bumper updatedAt).
- `reorderImprovement(state,{id,dir},ctx)` – bytter `order` med naboen over/under i den
  sorterte lista, bumper `updatedAt` på **begge** (LWW-vennlig synk), ingen-op i endene.

### UI (`js/app.js`)
- Kortet: tittel + beskrivelse (`.mdbody`) vises alltid. Har kortet `depth`, vises en diskré
  **«Vis mer ⌄»** → folder ut dybden (`.mddepth`, samme Markdown-render). Expand-tilstand er
  lokal/flyktig (`App.impOpen`, overlever polling, nullstilles ved full reload).
- **▲ / ▼** i kort-hodet flytter kortet opp/ned (skjules i hver sin ende).
- **Inntasting begge steder:** både «Legg til» og «Rediger» har tre felt (tittel + beskrivelse
  + dybde). Lagring kaller `setItemText` + `setItemBody` + `setItemDepth`.
- **Slank «＋ Ny forbedring»-knapp øverst** (lav høyde, `App.impAddOpen`). Trykk folder ut
  skjemaet inline; «Legg til» lukker det igjen → kortlista straks synlig.

### CSS (`index.html`)
- `.mddepth` (gjenbruker mdbody-stilene + venstre kantlinje/innrykk), `.addmini`, `.expand`,
  `.impacts`, `.mini.ord` – i samme mørke/bambus-profil.

---

## Del B – Todo-rader (build24, egen PR)

- **Kompakte rader:** `.row` padding `13px → ~9px`, sirkel `26 → 22px`, uendret touch-vennlig
  høyde (~40px).
- **Juicy avkryssing:** hvit ✓ tegner seg inn i sirkelen (SVG stroke-draw) + en ring-«burst»
  som pulserer utover og fader + litt kraftigere haptikk + så streker den ut og raden glir vekk.
  Via CSS-keyframes + små klasse-triggere i `doComplete` (juster timing deretter).
- Ingen `logic.js`-endring → kun CSS + liten JS; eksisterende tester grønne.

---

## Test & deploy
- Del A: rene jsc-tester (dybde lagres/trimmes, order-sortering, `reorderImprovement` + bounds,
  migrate-backfill). Må være grønn før PR.
- Cache-busting: bump `APP_VERSION`/`APP_BUILD` i `index.html` + `VERSION` i `sw.js`.
- To separate feature-branches fra ferske `origin/main` → PR → squash-merge (GitHub Pages).
