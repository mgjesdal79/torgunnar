# Tor Gunnar – design & roadmap

**Dato:** 2026-10-16
**Status:** Levende designdokument (kan tas opp igjen). Bygget videre på PandaCoins-fundamentet.

## Hva dette er

Tor Gunnar er Martins «positive ADHD-alterego» 🦸‍♂️ — en personlig app som holder styr på det
som gjenstår, både privat og på jobb, og som sørger for at ting faktisk blir ferdig eller flyttet
til et sted der det dukker opp igjen når det skal. Dette er en **videreutvikling** av den allerede
live PandaCoins-appen, ikke et nytt prosjekt.

**Kjerneintensjon (Martins ord, fra fundamentet):** «et godt system for å se hva som gjenstår, og
at ting blir ferdigstilt. og hvis det er noe jeg ikke kan gjøre her og nå – enkelt å flytte det til
noe annet sånn at det dukker opp når det skal.»

## Bærende prinsipper

- **Pull, ikke push.** Appen maser ikke uoppfordret. Unntaket er bevisste, selvvalgte
  påminnelser (iOS) og det han selv åpner. Rutiner ligger bak egen knapp UTEN badge.
- **Ingen coins/belønning/streaks.** Tilfredsstillelsen ligger i at ting blir gjort og badgen/raden
  forsvinner. (Allerede slik i fundamentet.)
- **Lav friksjon ved fangst.** Skriv ned raskt, klassifiser når du vil (fang→klassifiser finnes).
- **Det kommer tilbake når det skal.** Snooze/«remind me» (Slack-stil) finnes alt som
  defer/resurfacing; den gjenbrukes til mer.
- **Privat er default**, jobb er sekundært (men samme maskineri for todos).
- **Store, tydelige treffeflater.** Ikke gamlis-modus, men klare lister, lett å krysse ut, lett å
  treffe knapper.

## Rebrand (fase 0)

- Navn: **Tor Gunnar** (overalt i UI, manifest, tittel).
- Ikon: **superhelt-emoji** (🦸‍♂️) rendret til PNG via samme byttbare pipeline som panda-ikonet
  (`icon-src.svg` → `tools/gen-icons.sh`). Martin lager eget cover senere → bare bytt `icon-src.svg`
  og regenerer.
- **Behold samme repo/URL** (`mgjesdal79.github.io/pandacoins/`) så en allerede installert PWA ikke
  brytes. Kun navn + ikon endres.

## Allerede bygget (fundamentet – ikke bygg på nytt)

- Fang→klassifiser (universal `item`-modell med `type`), innboks med redigering
- Kategorier med visning, «I dag»-liste
- Fullfør/kryss ut, gjenåpne, slett (tombstone)
- **Defer/snooze med resurfacing** (= «bli aktiv igjen på tidspunkt X», badge forsvinner)
- Notat-type
- localStorage, PWA, service worker, publisert og installerbar

## Funksjoner (design)

### 1. Rutiner (FASE 1 – først ut) 🔁

Tilpasset fra Honniscoins' modne rutine-modell, strippet for poeng/godkjenning/forelder-barn.

- **Pull, ikke push:** Rutiner bor bak **egen 🔁-knapp UTEN badge**. De maser aldri; Martin henter
  dem ved behov.
- **Maler:** `settings.routines = [{id, title, subtasks:[{id,text}], weekdays:['mon'..'sun'],
  enabled, leadDay, sleeping, updatedAt}]`. Tittel + liste deloppgaver. Eks «Kveldssjekk»:
  Lås ytterdør · Sjekk ladere · Lås bil · Alarm på · Skru av lys.
- **Tre smaker (samme motor):**
  1. **Faste (planlagte):** valgte ukedager → riktig rutine ligger klar på Rutiner-flata de dagene
     (men badger ikke). «Hver kveld med mindre jeg trykker den bort» = alle dager + avvis/skip dagens.
  2. **Sovende (`sleeping:true`, på forespørsel):** ingen faste dager, ligger i ro. **«Vekk»**-knapp
     lager en instans for i dag; sovner igjen når ferdig. (Eksempel: minstejente-henting — varierer
     uke til uke.)
  3. **«Vis fra dagen før» (`leadDay`):** materialiserer morgendagens instans → seksjon
     «For i morgen 🌙».
- **Instans (dagens rutine):** `{source:'routine', routineId, routineDate, subtasks:[{id,text,done}]}`.
  Avkryssbar deloppgave-liste, «X av N gjort» + progress-stripe, **kollapser når alt er huket av**.
- **Opprydding:** gårsdagens åpne instanser merkes automatisk `skipped` (dag-bundet), så de ikke
  henger og blokkerer nye (mirror av `expireStaleRoutineInstances`).
- **Redigering:** dra-og-slipp rekkefølge på deloppgaver, legg til/fjern, på/av, slett. Sammenleggbare
  mal-kort.
- **Visning:** 🔁 Rutiner-flate med seksjoner «I dag/klar» · «For i morgen 🌙» · «Sovende (vekk ved
  behov)». Ingen badge noe sted.
- **Logikk (rene fn, speiler Honniscoins):** `addRoutine`, `updateRoutine`, `deleteRoutine`,
  `generateRoutineInstances(state, today)`, `wakeRoutine(state,{id},ctx)` (NY: materialiser sovende
  instans i dag), `expireStaleRoutineInstances`, `toggleRoutineSubtask`, `allSubtasksDone`.

### 2. Mellomlang liste – «masete vs. chill» 💤

Ting kona nevner som ikke skal gjøres nå («Husk nye støvler til datter»). Løser «jeg aner ikke
hvordan jeg rigger meg til senere» ved at **saken husker det for deg** og kommer tilbake i egen rytme.

- Gjenbruk defer/resurfacing-motoren, men gjør den **gjentakende per sak** med tre maste-nivåer:
  - **Chill** – ligger bare klar, ingen badge, dukker opp når du åpner lista.
  - **Dult** – kommer tilbake / badger med valgt mellomrom (f.eks. hver uke).
  - **Masete** – badger daglig / dukker opp i «I dag» til du gjør den eller snoozer.
- Felt på item, f.eks. `insistence: 'chill'|'nudge'|'nag'` + eksisterende `resurfaceAt`/cadence.

### 3. iOS-påminnelser (spesifikke, på tidspunkt) ⏰

- UI: **+/- knapper for timer og dager** fram i tid, med **live dato + klokke** under som viser hvor
  man lander. Trykk **Lagre**.
- Sender ferdig oppsatt påminnelse til iPhone-**Påminnelser** via en iOS-**Snarvei** (Shortcut),
  satt opp som tidssensitiv. (Bygger ut `setReminder` + snarvei-handoff fra fundamentets plan.)

### 4. Planlegger / ad-hoc sjekklister 🗓

Som iPhone-Notater-sjekklistene Martin lager når han blir overveldet.

- Lag raskt en liste, **legg til/fjern/omrokkér** (dra-og-slipp), kryss av.
- **Kollapser når ferdig**, lett å fjerne hele lista. Trenger sjelden historikk → engangsbruk, kastes.

### 5. Notat-graveyard 🗑

- Notater er mest midlertidige. Lett å slette → havner i **graveyard** (mykt slettet) → **permanent
  slettet 30 dager senere** (angrevindu). Bygger på eksisterende tombstone (`removed`), + `removedAt`
  + opprydding i migrate etter 30 dager.

### 6. Privat / Jobb-split 🏠💼

- To øverste kontekster: **Privat (default ved åpning)** og **Jobb**. Samme todo-maskineri i begge
  (spesifikke + mellomlang sikt). Privat er den største delen.
- Mulig modell: en `context: 'privat'|'jobb'` på item + enkel topp-bryter/to flater. Kategorier
  lever inni konteksten.

### Distraksjon (tips, ikke nødvendigvis funksjon)

- Installer Tor Gunnar på hjem-skjermen og åpne **den direkte** (forbi app-grid-et) → land rett i
  lista.
- iOS **Fokus-modus** bundet til en hjem-skjerm-side med bare Tor Gunnar + Påminnelser.
- Back-Tap / Dock-snarvei så én bevegelse åpner den.
- I appen: åpne rett i **Privat «I dag»** (null navigering). Evt. en «én ting av gangen»-fokusvisning
  senere.

## Roadmap (Martins valgte rekkefølge)

- **Fase 0 – Rebrand:** Tor Gunnar + superhelt-emoji-ikon (byttbart), samme URL.
- **Fase 1 – Rutiner:** pull-bak-knapp (ingen badge), faste + sovende + «vis fra dagen før»,
  deloppgaver, kollaps, opprydding. ← *først ut etter rebrand*
- **Fase 2 – Mellomlang liste** med chill/dult/masete-rytme.
- **Fase 3 – iOS-påminnelser** (+/- stepper → Snarvei → Påminnelser).
- **Fase 4 – Planlegger / ad-hoc sjekklister.**
- **Fase 5 – Notat-graveyard** (30-dagers purge).
- **Fase 6 – Privat/Jobb-split** + større/tydeligere design-pass.

(Rekkefølge 2–6 er et forslag og kan omprioriteres når Martin tar opp igjen planen.)

## Utsatt / åpne spørsmål

- **Synk telefon↔laptop** (Supabase-rom via `#r=`, som Honniscoins). Uttalt ønske fra før; egen
  senere bit. Appen kjører localStorage-modus (`EDGE_FUNCTION_URL=''`) inntil da.
- Fase 6 design-pass: nøyaktig layout for Privat/Jobb-bryter avklares når vi kommer dit.

## Avgrensning (YAGNI)

- Bygg én fase av gangen (Martins eksplisitte ønske). Ingen stor big-bang-ombygging.
- Ingen coins/gamification.
- Ingen backend før synk-fasen.
