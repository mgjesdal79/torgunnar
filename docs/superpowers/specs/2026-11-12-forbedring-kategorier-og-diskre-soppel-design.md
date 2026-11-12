# Forbedring-kategorier + diskré søppeltelling (build31)

## Problem
1. Det kommer stadig flere forbedringer, og det er naturlig å sortere dem i
   grupper («Oppgaver», «Egenpleie», «Anerkjennelse» …). I dag er alt én flat liste.
2. Søppelkassa har en badge-boble som skriker. Martin vil bort fra badges i
   Tor Gunnar – søppel først: bare et diskret tall, ingen boble.

## Løsning

### Kategorier på Forbedring (fri tekst + forslag)
- Hver forbedring får et valgfritt `category`-felt (string | null), lagret på item.
- Add- og rediger-skjemaet får et kategori-input med `<datalist>` som foreslår
  allerede brukte kategorier → lett gjenbruk, ingen skrivefeil. Nye kategorier
  oppstår bare ved å skrive dem. Ingen egen administrasjon/CRUD.
- Lista grupperes etter kategori med **synlige overskrifter** (skjuler ingenting):
  navngitte kategorier alfabetisk først, «Uten kategori» til slutt.
- Hver gruppe er sin egen `data-droplist="items"` → dra-og-slipp omorganiserer
  innen gruppen (samme order-mekanikk som før; order-kollisjon på tvers av grupper
  er harmløst fordi `improvementGroups` sorterer på kategori først).

#### Logikk (`js/logic.js`)
- `addImprovement` tar nå imot `category` (trimmes; tom → null).
- `improvementCategories(state)` → distinkte, ikke-tomme kategorinavn, sortert (nb).
- `improvementGroups(state)` → `[{ category, items }]`, navngitte først (alfabetisk),
  `null`-gruppen sist. Rekkefølge innen gruppe arver `improvementItems` (order).
- Redigering lagrer kategori via eksisterende `setItemCategory`.
- Ingen migrering: gamle forbedringer uten felt havner i «Uten kategori».

### Diskré søppeltelling
- `tileHtml` får en femte parameter `sub` (liten, dempet tekst under etiketten).
- Søppelkasse-tilen sender `badge = null` og `sub = antall` (tomt ved 0) →
  ingen badge-boble, bare `.subcount` (11px, `--faint`) under «Søppelkasse».
- Første steg mot et badge-fritt Tor Gunnar.

## Test
`test/suite.js`: kategori på addImprovement, `improvementCategories`,
`improvementGroups` (rekkefølge + tom state). 151/151 grønne (jsc).
build31 (index.html + sw.js bumpet).
