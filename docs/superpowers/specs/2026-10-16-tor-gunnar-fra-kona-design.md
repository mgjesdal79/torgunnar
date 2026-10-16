# Tor Gunnar – «Fra kona» (design)

Dato: 2026-10-16
Status: Godkjent av Martin
Fase: 2.5 (bygges som build 6)

## Mål

Et sted hvor kona kan legge igjen lapper til Martin, én og én, direkte i appen på
Martins enhet. Martin triagerer hver lapp og konverterer den til vanlige typer –
«På et tidspunkt», oppgave, påminnelse osv. Behandlede lapper forsvinner fra
kona-flaten og flyter inn i det vanlige systemet.

## Avklarte beslutninger

- **Levering:** Kona skriver direkte i appen på Martins (felles) enhet. Ingen
  backend, ingen delingslenke, ingen synk.
- **Inngang:** Egen «Fra kona»-tile + egen skjerm inne i appen. Begge bruker appen
  100 % likt – ingen egen kona-modus, ingen lås, ingen `#kona`-rute.
- **Livssyklus:** Triage-innboks. «Fra kona» viser kun *ubehandlede* lapper. Så
  snart en lapp får en type, forsvinner den fra kona-flaten og dukker opp i det
  vanlige systemet (I dag / På et tidspunkt / kategori / påminnelse).

## Datamodell

- Item har allerede feltet `source` (default `null`) i modellen.
- Konas lapper opprettes med `source: 'kona'` og `type: null`.
- `addItem` utvides til å ta imot valgfri `source`-param (default `null`).
  Bakoverkompatibelt: eksisterende saker og eksisterende kall får `source: null`.
- `source`-merket blir liggende på saken etter konvertering (metadata). Det
  påvirker ikke lenger hvor saken vises (fordi den da har en `type`), men kan
  valgfritt vises som en liten «💬 fra kona»-note der saken havner.

## Logikk (`js/logic.js`, ren og testbar)

- `addItem(state, { text, type, category, source }, ctx)` – ny `source`-param.
- `isKonaPending(item)` – hjelper: `source === 'kona' && type == null && !done && !removed`.
- `konaItems(state)` – alle ubehandlede kona-lapper, nyeste først
  (`createdAt` synkende, som `mediumItems`).
- `konaBadge(state)` – `{ count, level }` der `count` = antall ubehandlede
  kona-lapper, `level = count ? 'open' : 'calm'`.
- `inboxItems(state, now)` – **ekskluderer** kona-lapper, slik at ubehandlede
  kona-lapper IKKE også dukker opp i hoved-Innboksen. En untyped sak vises i
  Innboks kun hvis `source !== 'kona'`.

### Konvertering (gjenbruk – ingen ny logikk)

Konvertering skjer via det eksisterende rediger-arket (`openEdit` →
`classifyItem` / `setReminder` / `setInsistence`). Når `type` settes ≠ null,
blir `isKonaPending` usann, og lappen forsvinner fra `konaItems`. Ingenting nytt
trengs for selve konverteringen.

## UI (`js/app.js`)

### Hjem-tile
- Ny flis `💬 Fra kona` med `data-view="kona"`, badge fra `konaBadge(App.state)`.
- Plasseres sammen med de andre spesial-flisene (Innboks, I dag, På et tidspunkt,
  Rutiner, Innstillinger).

### Skjerm (`renderKona`)
- `headerBar('💬 Fra kona')`.
- Capture-rad øverst: tekstfelt + «Legg til»-knapp som oppretter
  `source:'kona'`, `type:null`. (Egen enkel inline-capture, ikke hoved-arket.)
- Liste over ubehandlede kona-lapper (`konaItems`). Hver rad:
  - lappens tekst
  - **«Behandle»** → åpner det vanlige rediger-arket (`openEdit`) der Martin
    setter type / påminnelse / insistence.
  - **«✕»** → avvis/slett (`deleteItem`).
- Tom tilstand: «Ingen lapper fra kona akkurat nå 🌱».

### Uendret
- Hoved-«Fang en tanke»-arket røres ikke (ingen «fra kona»-avkrysning der).
- Innboks-skjermen er uendret bortsett fra at kona-lapper filtreres vekk via
  `inboxItems`.

## Cache / versjon

- `sw.js` `VERSION` → `'6'`.
- `index.html` `APP_VERSION` → `'6'`.

## Testing (`test/suite.js`, kjøres med jsc)

- `addItem` med `source:'kona'` setter feltet; uten `source` → `null`.
- `konaItems` returnerer kun ubehandlede kona-lapper, nyeste først.
- `konaItems` utelater kona-lapper som har fått en type (behandlet).
- `konaItems` utelater `done`/`removed`.
- `konaBadge` teller riktig og gir `level` 'open'/'calm'.
- `inboxItems` ekskluderer ubehandlede kona-lapper, men beholder vanlige
  untypede saker.
- Konvertering: etter `classifyItem(..., type:'someday')` er lappen ute av
  `konaItems` og inne i `mediumItems`.

## Avgrensning (YAGNI)

- Ingen kona-modus, lås eller egen rute.
- Ingen backend eller synk.
- Ingen endring i hoved-fang-arket.
- Tilen heter fast «Fra kona» (ikke konfigurerbart navn).
- Ingen egen «behandlet»-logg (behandlede lapper forsvinner, slik beslutningen sier).
