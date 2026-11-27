# Flyt – flerstegs-oppgaver med ball-indikator

**Dato:** 2026-11-27
**Status:** Godkjent design, klar for implementasjonsplan
**Omfang:** Bunke A (Flyt-typen + synlighet i Gjøremål). Bunke B (ombygging av
Langsiktig / «aktive = ekte Gjøremål») er bevisst **parkert** til en egen runde.

## Bakgrunn / problem

Dagens todo er binær: `done: true/false` (+ `doneAt`). Noen ting er clear-cut
(gjort / ikke gjort), men andre er en **prosess over tid** med flere steg, der man
ofte står og **venter på noen** (f.eks. «søke om Memoplanner» → venter på
tilbakemelding fra fastlege). Slike hører ikke hjemme i en avkryssingsliste – de
seiger den til og forsvinner mellom de raske tingene.

Løsningen er en egen type, **Flyt**: nesten en «one-off rutine» – samme byggekloss
(deloppgaver du huker av), men stegene defineres on the fly i stedet for å komme på
en ukedag. En todo kan gjøres om til en flyt på samme måte som den i dag kan bli
notat eller langsiktig.

Begrepet er valgt av Martin: **«Flyt»** (kort, rolig, norsk). Flisen heter *Flyt*;
et enkelt element er *en flyt*.

## 1. Datamodell

- Ny item-type **`flow`** (ved siden av `task`/`job`/`someday`/`note`/`improvement`).
- Flyten får et ordnet steg-array:
  ```
  steps: [ { id, text, owner, done } ]
  ```
  der `owner` er **`'meg'`** eller **`'ekstern'`**.
- **Ekstern er binær** (ikke navn på hvem). Detaljen bor i selve steg-teksten, f.eks.
  «Vent på svar fra fastlege» → `owner: 'ekstern'`. Færre felt å fylle ut.
- Vanlige felt gjelder som før: `done`, `doneAt`, `removed`, synk-felt (LWW).
- **Ball utledes** (ikke lagret): eier av *første ukryssa steg*.
  - Første åpne steg `owner: 'meg'` → **din tur**.
  - Første åpne steg `owner: 'ekstern'` → **venter på andre**.
  - Ingen åpne steg igjen → regnes som **din tur** (du kan avslutte / legge til steg).
  Ren funksjon, f.eks. `ballOwner(flow) -> 'meg' | 'ekstern'`.

### Konvertering
- En todo blir en flyt via samme meny som «gjør om til notat / langsiktig»
  (`setItemType(..., 'flow')`). Teksten blir flytens tittel; den starter uten steg.
- Man kan også lage en **ny flyt direkte** fra Flyt-flisen.
- Ved konvertering bort fra `flow` nullstilles/ignoreres `steps` på samme måte som
  andre type-spesifikke felt håndteres i `setItemType` i dag.

## 2. Flyt-flisen (forsida)

- Egen flis **Flyt** med **diskré tall** under (antall aktive flyter) – ikke badge
  (følger build31-linja: Tor Gunnar skal vekk fra badges).
- Hver flyt = **ekspanderbart kort**:
  - Kollapset: tittel + **ball-status** («din tur» varm / «venter på andre» dempet)
    + neste åpne steg som undertekst.
  - Ekspandert: alle steg med avkryssing + **meg/ekstern-merke** per steg.
- **Sortering:** «din tur» øverst, «venter på andre» under.
- **Redigering** gjenbruker subtask-mønsteret fra rutiner:
  - legg til / omdøp / slett steg,
  - **dra-sortér** steg (dra-og-slipp finnes allerede, build26/27),
  - sett `owner` (meg/ekstern) per steg.

## 3. Flyt i Gjøremål (totalen)

Underliggende ønske: Gjøremål skal «sitte på totalen» – man skal ikke miste
oversikt bare fordi noe er flyttet ut i en egen flis.

- Flytene vises **også i Gjøremål**, som en **egen liten gruppe nederst** under en
  diskré «Flyt»-overskrift.
- De er **navigerings-rader uten checkbox**: tittel + ball-prikk. Trykk → **hopper
  til flyten (ekspandert) under Flyt-flisen** – ingen avkryssing i Gjøremål.
- Slik sitter Gjøremål på totalen uten at flyt-stegene roter til selve
  avkryssingslista.

## 4. Fullføring

- **Auto-ferdig når siste steg hukes av** (som rutiner: `done = allStepsDone`,
  `doneAt = now`).
- I tillegg en **«Avslutt»-knapp** for å lukke en flyt tidlig (manuelt `done`).
- Ferdige flyter går til **Fullført**.

## 5. Senere (ikke i denne runden)

- **Nudge/påminnelse på et enkelt steg.** Modellen (owner + steg) er klar for det,
  men funksjonen bygges ikke nå (YAGNI).
- **Bunke B:** ombygging av Langsiktig (aktive = ekte Gjøremål med nudge, resten =
  en liste mellom Gjøremål og Fullført). Egen brainstorm/spec senere. Berøres ikke
  her – build38 splitta nettopp Langsiktig i «Klar nå» + «Resten».

## 6. Test

- Ren logikk i `js/logic.js` testes med jsc
  (`.../jsc -m test/run-jsc.js`): `ballOwner`, konvertering til/fra `flow`,
  steg-CRUD + omorganisering, auto-ferdig når alle steg er huka av, manuell avslutt.
- `js/app.js` (UI) testes ikke, som før.

## 7. Deploy (PWA cache-busting)

Ved implementering: bump versjon tre steder (`APP_VERSION` + `APP_BUILD` i
`index.html`, `VERSION` i `sw.js`). Les gjeldende build fra `origin/main` (ikke
disk) og legg +1. Feature-branch → PR → squash-merge (dcg blokkerer push til main).
