# Kompakte todo-rader + dra-og-slipp (build25)

## Problem
Gjøremåls- og jobblista (`taskRowHtml`) bygget for mye høyde: hver todo lå i sin egen
`.card` med en alltid synlig handlingslinje (`⏰ Sett tid`, `Legg i Påminnelser`, `Ikke nå`).
I tillegg fantes ingen måte å flytte en item raskt oppover lista på.

## Løsning
Gjelder **Gjøremål** og **Jobb** (begge bruker `taskRowHtml`). Hjem/«I dag»/Langsiktig/Notater
er uendret.

### 1. Kompakt layout
- Alle rader samles i **ett felt** (`.card.droplist`) med tynne skillelinjer – ingen ramme per rad.
- Hver rad: `⠿` drahandtak · `◯` avkryssing · tekst · `⌵` ekspander (helt til høyre).
- Reminder-tid vises fortsatt som liten meta-tekst på raden når satt.
- Trykk `⌵` folder ut et inline-panel (`.rowpanel`) med `⏰ Sett tid`, `Legg i Påminnelser`
  og `Ikke nå`. «Sett tid» åpner den eksisterende tidsvelgeren inne i panelet.
- Ekspandert tilstand er flyktig UI (`App.rowOpen`, nullstilles ved full render, som `App.impOpen`).

### 2. Dra-og-slipp
- Synlig drahandtak `⠿`. Pointer-basert drag (fungerer på touch; native HTML5-drag er upålitelig).
  Raden flyttes i DOM live mens man drar; ved slipp leses id-rekkefølgen og `L.reorderItems`
  skriver ny `order`.
- Datamodell: `order`-felt på items (samme mønster som Forbedring/`reorderImprovement`).
  `taskItems`/`jobItems` sorterer nå på `order` (lavest øverst); items uten `order` (nylig fanget)
  legger seg øverst, nyeste først.
- **`migrate`** backfiller `order` på gjøremål/jobb ved første oppgradering og reproduserer den
  gamle sorteringen (timede først, så nyeste), slik at lista ser identisk ut – deretter er den manuell.
- **Atferdsendring:** et klokkeslett (`remindAt`) flytter ikke lenger raden til toppen; manuell
  rekkefølge styrer. Tiden vises fortsatt som meta og driver iOS-påminnelser som før.
- Synk (LWW): `reorderItems` bumper `updatedAt` kun på items som faktisk flyttet → minst mulig støy.

## Ikke med (YAGNI)
- Auto-scroll når man drar mot skjermkanten (lista er kort nok i praksis; kan legges til senere).

## Test
Ren logikk i `js/logic.js` dekkes av `test/suite.js` (order-sortering, `reorderItems`,
migrate-backfill). Drag-UI i `app.js` er ikke enhetstestet (som resten av UI-et).
