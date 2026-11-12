# Dra-og-slipp på alle lister (build26)

## Problem
build25 ga dra-og-slipp kun på Gjøremål/Jobb (`taskRowHtml`). De andre
re-sorterbare listene brukte fortsatt knapper: Forbedring hadde ▲▼
(`reorderImprovement`), og rutine-editorens deloppgaver hadde ↑/↓.
Langsiktig hadde ingen manuell rekkefølge i det hele tatt.

## Løsning
Generaliser drag-motoren fra build25 og bruk den på tre lister til.

### 1. Generisk drag-motor (`js/app.js`)
Drag kobler nå på attributter i stedet for faste klasser:
- Drop-sone: `[data-droplist]="<kind>"`
- Rad: `[data-row-id]="<id>"`
- Håndtak: `[data-draghandle]="<id>"` (⠿, `touch-action:none`)

`onDrop(kind, orderedIds)` dispatcher på `kind`:
- `items` → `commit(L.reorderItems(state, {orderedIds}, ctx))` (ekte items med
  `order`-felt: gjøremål, jobb, langsiktig, forbedring).
- `subtasks` → omorganiserer flyktig `App.routineEdit.subtasks` etter id og
  re-rendrer editoren (ingen commit før rutinen lagres).

`.dragging`-stilen er gjort generisk (var `.trow.dragging`) så både rader og
`.card.improvement` kan løftes.

### 2. Langsiktig (someday)
- `mediumItems` grupperer fortsatt nag→nudge→chill, men innen hver gruppe styrer
  `byManualOrder` (samme komparator som gjøremål): `order` stigende, order-løse
  (nylig fanget) øverst, nyeste først.
- Hver mase-gruppe er en egen `data-droplist="items"`. Overlappende order-verdier
  på tvers av grupper er harmløst – `renderMedium` filtrerer per gruppe.
- `migrate` backfiller `order` på someday ved første oppgradering (reproduserer
  dagens nyeste-først, så er den manuell).

### 3. Forbedring
- ▲▼-knappene (`data-impup`/`data-impdown`) fjernet; håndtak ⠿ i `.imphead`.
- Kortene ligger i en `data-droplist="items"`-container (ikke `.droplist`-klassen,
  for å unngå rad-stilen – hvert kort er sitt eget `.card`).
- Reordering går nå via den generiske `L.reorderItems` (improvement har allerede
  `order`-felt + sort). `reorderImprovement` beholdes kun for eksisterende tester.

### 4. Rutine-deloppgaver (editor)
- ↑/↓-knappene (`data-eup`/`data-edown`) fjernet; håndtak ⠿ per rad.
- Radene ligger i `data-droplist="subtasks"`; slipp omorganiserer
  `App.routineEdit.subtasks` i minnet og re-rendrer. Lagres med rutinen som før.

## Utelatt (scope)
- I dag / Innboks / Søppelkasse: avledede/aggregerte visninger uten lagret
  rekkefølge – ikke drabare.
- Notater og Ingrid: ikke bedt om.
- Rutine-*instansenes* avkryssbare deloppgaver (dagens sjekkliste) er uendret –
  bare editoren fikk drag.

## Test
`test/suite.js` (jsc): la til someday manuell order via `reorderItems` og
migrate-backfill av someday. 145/145 grønne. Drag-UI testes ikke (som resten av UI).
