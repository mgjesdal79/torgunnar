# Rutiner: manuell aktivering hver dag (build30)

## Problem
Rutiner ble tidligere auto-generert ut fra ukedager/`leadDay`, med en egen
«sovende»-tilstand for de man bare ville vekke ved behov. Martin vil heller at
**alle** rutiner starter inaktive hver dag og aktiveres manuelt når de skal brukes.

## Løsning
Rutinemodellen blir rent manuell + daglig nullstilling.

### Tre seksjoner (`renderRoutines`)
- **Aktive** – dagens instanser som ikke er fullført (`routineInstancesForDate`, `!done`).
- **Fullførte** – dagens fullførte instanser, i en sammenleggbar seksjon
  (`App.doneRtnOpen`, gjenbruker build28-mønsteret).
- **Inaktive** – alle rutiner uten en aktiv instans i dag (`inactiveRoutines`),
  hver med en «Aktiver»-knapp (`data-rwake` → `L.wakeRoutine`).

### Daglig nullstilling
Kommer «gratis»: `syncRoutines` kaller nå kun
`pruneRoutineInstances(state, today)` som dropper instanser med `date < today`.
Ny dag → ingen instanser → alle rutiner havner i Inaktive. Ingen auto-generering.

### Logikk (`js/logic.js`)
- Ny `inactiveRoutines(state, today)`: rutiner som ikke har en ikke-skippet
  instans for `today`. En rutine man legger bort igjen (skipped) teller som inaktiv.
- `generateRoutineInstances` beholdes (ikke lenger kalt av appen) så eksisterende
  tester står; `sleepingRoutines` blir ubrukt av appen.

### Editor forenklet
Ukedags-chips (`data-ewd`), «Valg»-chips (`data-etgl`: sleeping/leadDay/enabled)
og `WD`/`WD_LABEL` fjernet – meningsløse når aktivering er manuell. Igjen står
tittel + deloppgaver (med dra-og-slipp) + lagre/avbryt/slett. Datamodellfeltene
beholdes med ufarlige defaults for bakoverkompatibilitet.

## Test
`test/suite.js`: to nye tester for `inactiveRoutines` (lister rutiner uten aktiv
instans; bortlagt/skipped teller som inaktiv igjen). 147/147 grønne.
