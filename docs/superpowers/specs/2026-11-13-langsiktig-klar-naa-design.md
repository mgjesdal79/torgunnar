# Langsiktig: «Klar nå» + «Resten» (build38)

## Problem
Langsiktig-flisen (💛) gir en badge med antall (f.eks. «2»). Når man går inn er lista
gruppert på insistens (📣 Masete → 👋 Dult → 😴 Chill), og hvilke dult som faktisk er
«klar nå» står bare som en liten metatekst («👋 klar nå» vs «👋 om N d») per rad. Man må
scanne hver rad for å finne det badgen egentlig peker på.

## Løsning
To seksjoner, der den øverste er nøyaktig det badgen teller:

- **✨ Klar nå (N)** = masete (`insistence === 'nag'`) + forfalte dult (`nudgeDue`).
  Samme filter som `mediumBadge`, så tallet matcher alltid badgen. Masete først, så
  forfalte dult (eldst `resurfaceAt` øverst).
- **📋 Resten** = alt annet åpent someday: kommende dult (ikke forfalt) sortert på
  nærmeste `resurfaceAt` (snart øverst), deretter chill (`chill`/null) etter eksisterende
  `byManualOrder`.

Auto-sortert – **dra-og-slipp fjernes i denne visningen** (forutsigbart og alltid i tråd
med badgen). Dra-og-slipp i andre visninger (Gjøremål/Jobb/Forbedring/rutiner) er urørt.

## Datamodell
Uendret. Fortsatt `type:'someday'` + `insistence` (nag/nudge/chill) + `resurfaceAt`/
`cadenceDays`. Ingen migrering.

## Endringer
- `js/logic.js`:
  - `mediumReadyItems(state, now)` – «Klar nå».
  - `mediumRestItems(state, now)` – «Resten».
  - `mediumBadge` refaktorert til `mediumReadyItems(...).length` (samme filter, én kilde).
  - `mediumItems` beholdt uendret (brukt av konvertering/tester).
- `js/app.js`:
  - `renderMedium` bruker de to nye funksjonene, to `<h2>`-seksjoner, tom seksjon skjules,
    begge tomme → «Ingenting her ennå»-melding.
  - `mediumRowHtml` uten dra-håndtak / `droplist`; meta via ny `mediumMeta` (nag `📣`,
    forfalt dult `👋`, kommende dult `👋 om N d`, chill `😴`). «I dag»-knapp beholdt.
- `test/suite.js`: tester for begge nye funksjoner (rekkefølge, utelatelser, badge-match).

## Rad-meta
| Tilstand | Meta |
|---|---|
| nag | `📣` |
| forfalt dult | `👋` |
| kommende dult | `👋 om N d` |
| chill | `😴` |

## Deploy
build38: bump `APP_VERSION`+`APP_BUILD` i `index.html` og `VERSION` i `sw.js`.
