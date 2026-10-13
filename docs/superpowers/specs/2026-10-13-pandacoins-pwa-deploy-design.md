# PandaCoins – PWA-ikon + offline + publisering (design)

**Dato:** 2026-10-13
**Mål:** Få den ferdige PandaCoins-appen på telefonen som en ekte PWA: eget 🐼-ikon på
hjem-skjermen, fullskjerm, og fungerende offline — publisert på GitHub Pages (samme oppsett
som Honniscoins).

**Status fundament:** Appen (fang→klassifiser, kategori-rutenett, «I dag», innboks med
redigering, fullfør, defer/resurfacing, localStorage) er ferdig og merget til `main`,
37/37 tester grønne. Mangler kun: appikon, offline (service worker), publisering.

---

## 1. Appikon — panda på bambusgrønn (byttbart)

**Designvalg (bekreftet):** Hvitt panda-fjes på bambusgrønn (`#5fbf74`) avrundet bakgrunn,
svarte ører + øyeflekker, mørk nese.

**Viktig krav fra Martin:** ikonet skal være lett å bytte senere. Derfor:
- SVG-kilden lagres i repoet som `icon-src.svg` (redigerbar kilde).
- Ett regenererings-skript/kommando produserer alle PNG-ene fra SVG-en.
- Bytte ikon = erstatt `icon-src.svg`, kjør kommandoen på nytt, commit.

**Teknisk:**
- SVG bygges av **grunnformer** (`<circle>`, `<ellipse>`, `<rect rx>`) — IKKE kompliserte
  `<path>` med lange tallrekker (pipelock-hooken gir falske SSN-treff på lange desimalrekker
  i path-data). Panda-fjes lar seg lage helt med sirkler/ellipser.
- `rsvg-convert` (allerede installert, `/opt/homebrew/bin/rsvg-convert`) rendrer PNG:
  - `icon-192.png` (192×192), `icon-512.png` (512×512) — manifest
  - `apple-touch-icon.png` (180×180) — iOS hjem-skjerm
  - `favicon.png` (32×32) — nettleserfane
- **Maskable:** motivet holdes innenfor en «safe zone» (ca. 80 % sentrert) så Android ikke
  beskjærer ørene. Samme 512-ikon brukes som både `any` og `maskable` i manifest (som
  Honniscoins), forutsatt nok luft rundt motivet.

## 2. Manifest + index.html

- `manifest.json`: legg til `icons`-array:
  - `icon-192.png` 192×192 `any`
  - `icon-512.png` 512×512 `any`
  - `icon-512.png` 512×512 `maskable`
  - (behold eksisterende `name`, `short_name`, `display:standalone`, farger)
- `index.html` `<head>`: legg til
  - `<link rel="apple-touch-icon" href="apple-touch-icon.png">`
  - `<link rel="icon" type="image/png" href="favicon.png">`
  - behold `<meta name="theme-color" content="#0c0d12">` (statuslinje matcher app-bakgrunn)

## 3. Offline — service worker

- Ny fil `sw.js` som cacher **app-skallet**: `index.html`, `js/logic.js`, `js/store.js`,
  `js/app.js`, `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`,
  `favicon.png`.
- Cache-navn knyttes til app-versjon, f.eks. `pandacoins-v<APP_VERSION>`. Ved `activate`
  slettes caches som ikke matcher gjeldende navn (rydder gammelt ved versjonsbump).
- Strategi: **cache-first** for app-skallet (statiske filer, enkelt og robust offline).
  Brukerdata ligger i localStorage, ikke i cache, så dataintegritet er uberørt.
- Registreres fra `index.html` (etter oppstart, `navigator.serviceWorker.register('sw.js')`,
  pakket i feature-sjekk). Scope = app-rot.
- **Versjonsrutine:** bump `window.APP_VERSION` i `index.html` ved hver deploy → nytt
  cache-navn → service worker henter friske filer. (Samme disiplin som Honniscoins.)

## 4. Publisering — GitHub Pages

- Nytt **offentlig** repo `pandacoins` under `mgjesdal79` (offentlig kreves for gratis Pages).
  Opprettes med `gh repo create`.
- Push `main` til `origin`.
- Slå på GitHub Pages: kilde = `main`, mappe = `/` (rot).
- Resultat-URL: **`https://mgjesdal79.github.io/pandacoins/`**
- På telefon: Safari → åpne URL → Del → «Legg til på Hjem-skjerm».

**Miljø-forbehold (ikke omgå):**
- Hvis `git push` til `main` blokkeres av en sikkerhets-hook, meld fra til Martin — ikke omgå.
- GitHub Pages har 1–2 min latens og cacher per fil; verifiser at URL-en svarer etter deploy.
- Appen kjører i localStorage-modus (`window.EDGE_FUNCTION_URL=''`). Synk telefon↔laptop
  (Supabase-rom via `#r=`, som Honniscoins) er en **senere plan**, ikke del av denne.

## Avgrensning (YAGNI)

- Ingen synk/backend nå (egen senere plan).
- Ingen push-varsler / iOS-snarvei nå (egen senere plan).
- Ingen bygge-steg/bundler — rene statiske filer, som i dag.
- Ingen automatisk CI-deploy — manuell `git push` + Pages holder for ett personlig prosjekt.
