# PandaCoins – designspec

**Dato:** 2026-10-13
**Status:** Godkjent retning, klar for byggeplan
**Eier:** Martin Gjesdal (personlig ADHD-verktøy)

> Dette er et levende dokument. Martin har eksplisitt sagt «vær beredt på endringer» –
> arkitekturen (ett universelt `item`) er valgt nettopp for å gjøre kursendringer billige.

---

## 1. Formål og kjerneloop

PandaCoins er en personlig webapp som hjelper en voksen med ADHD å **se hva som gjenstår, få
ting ferdigstilt, og trygt punte det man ikke kan gjøre nå**. Kjernen, alt annet er støtte:

> **Se hva som gjenstår → få det ferdig → hvis ikke nå: ett trykk for å punte det, med garanti
> for at det dukker opp igjen når det skal.**

Den vanskeligste ADHD-biten er å *slippe* noe uten å miste det. Derfor er **defer-knappen appens
viktigste knapp**: den gjemmer tingen fra «hva gjenstår», lar den dukke opp igjen i appen når
tiden er inne, **og** fyrer en iOS-påminnelse via snarvei. PandaCoins er fasiten; iOS er alarmen.

Designet lener seg på research-funn for ADHD-apper:
- *«En app du må huske å åpne, glemmer du»* → ambient synlighet (PWA-ikon på hjemskjerm, iOS-ping
  som maser utenfor appen).
- *Fangst må slå glemsel i hastighet* → null-friksjons notering, ingen påkrevde felt.
- *Snooze-til-preset fjerner beslutnings-kost* → +1t / +3t / «velg tid» med ett trykk.
- *Egen bøtte for vage ting* → «På et tidspunkt» (someday) som forsiktig dukker opp av seg selv.
- *Belønning uten skyld* → taktil tilfredsstillelse, ingen valuta, ingen skjøre streaks.

## 2. Ikke-mål (bevisste avgrensninger)

- **Ingen coins / valuta / saldo.** Navnet «PandaCoins» beholdes som kallenavn; pandaen lever,
  men det finnes ingen poengøkonomi. (Droppet etter eksplisitt ønske + research: belønning-som-
  valuta forutsetter selvdisiplin ADHD svekker, og blir lett mas/skyld.)
- **Ingen streaks, ingen straff, ingen «du mistet rekka».** Progresjon er alltid tilgivende.
- **Ingen full Duolingo-gamifisering.**
- **Ingen shop / bank / medaljer** (det var Honniscoins-mekanikk for sønnen).
- **Ingen flerbruker / roller / PIN** i v1 (personlig app, én bruker). Kona sine ting fanges som
  vanlige items, ikke via delt tilgang.
- **Appen eier ikke varsling selv** (ingen upålitelig web-push i v1) – den delegerer til iOS.

## 3. Arkitektur (gjenbruk Honniscoins-ryggraden)

Vanilla JS, **ingen build, ingen rammeverk, ingen npm-avhengigheter.** Samme tre-lags-splitt som
Honniscoins, som allerede fungerer for Martin:

- **`js/logic.js`** – ren logikk, ingen DOM/nett/globaler. Alt er rene funksjoner av `state`.
  Mutasjoner tar `ctx = {now, id}` (injisert for testbarhet) og **returnerer NY state** (alltid
  `clone(state)` først, aldri mutér på plass). Eneste testede fil.
- **`js/store.js`** – persistens/synk: localStorage-cache + Supabase edge-funksjon, `mergeState`-
  fletting, debounce-lagring (~600 ms), polling (~5 s). `loadState` kjører `migrate()` etter
  fletting. Re-rendrer kun når flettingen faktisk endrer lokal state, og aldri mens et
  input/textarea har fokus.
- **`js/app.js`** – all DOM/rendering. Ett `App`-objekt holder visningstilstand (valgt flis, åpne
  kort osv.) – **ikke persistert**.
- **`index.html`** – all CSS inline (panda-tema via CSS-variabler) + `APP_VERSION` +
  `EDGE_FUNCTION_URL`. Bump `APP_VERSION` ved hver deploy.

**Lagring (rom-modell):** hele brukerens data ligger i **én JSON-blob per «rom»**, delt via
URL-hash `#r=<id>`. `window.EDGE_FUNCTION_URL` tom = ren localStorage-modus (utvikling).
Backend = Supabase Edge Function + én Postgres-tabell (`room_hash text primary key, data jsonb,
updated_at timestamptz`). Dette gir **synk telefon↔laptop** uten innlogging – samme oppsett som
Honniscoins. Ingen auth; rom-hash i URL = full tilgang (personlig app).

**Fletting (CRDT-aktig, LWW/union):**
- `settings`: hel-objekt LWW på `settings.updatedAt`.
- `items`: **LWW per id** på `updatedAt`. Sletting = `removed:true`-tombstone (overlever fletting).
- `checkRuns`: union av datoer; per-item LWW på bekreftelses-tidsstempel.
- `log`: append-only **union-by-id**, beskåret til nyeste N (`pruneLog`) i `migrate`.

**Deploy:** GitHub Pages. Installeres som **PWA på iPhone hjemskjerm** (`manifest.json`,
standalone, portrett). Service worker valgfritt i v1 (localStorage-cache gir «offline» uansett).

**Testing:** ren logikk testes DOM-fritt under JavaScriptCore:
`jsc -m test/run-jsc.js` (ingen node/deno/bun i miljøet). Parse-sjekk av app.js: `jsc -m js/app.js`
→ `ReferenceError: document` = OK.

## 4. Datamodell

Hjertet er **ett universelt `item`** – alle fliser er filtrerte visninger over samme liste.

```js
item = {
  id,                 // uuid
  text,               // det du skrev (eneste påkrevde felt ved fangst)
  type,               // 'note' | 'task' | 'reminder' | 'someday' | null (null = uklassifisert/Innboks)
  category,           // kategori-id, f.eks. 'jobb' | 'hjem' (null = Innboks)
  done, doneAt,       // kun task/reminder
  due,                // valgfri frist (task)
  remindAt,           // reminder: når det skal pinges/dukke opp (ISO)
  resurfaceAt,        // defer/someday: når item igjen vises øverst på «I dag» (ISO)
  deferred,           // bool: gjemt fra «hva gjenstår» inntil resurfaceAt
  iosPushedAt,        // sist sendt til iOS-snarvei (unngå dobbel-ping)
  source, routineId, routineDate,   // for rutine-genererte items (som Honniscoins)
  subtasks,           // valgfri [{id, text, done}]
  createdAt, updatedAt, removed
}
```

Toppnivå-`state`:

```js
{
  settings: {
    categories: [{id, label, icon, order}],   // brukerdefinert, omrokkerbart
    nightly: [{id, text, order, enabled}],     // kveldssjekk-malen (fast liste)
    routines: [{id, title, subtasks, schedule, enabled, leadDay, updatedAt}],
    shortcutName: 'PandaReminder',             // navn på iOS-snarveien
    remindPresets: [60, 180],                  // minutter: +1t, +3t (redigerbart)
    somedayNudgeDays: 7,                        // hvor ofte someday dukker opp
    updatedAt,
  },
  items: [],
  checkRuns: {},     // { 'YYYY-MM-DD': { items: { <nightlyId>: { done, at } } } }
  log: [],
}
```

Rutiner er **maler** som genererer `task`-items per aktiv dag (daglig/ukentlig) med deterministiske
id-er `<routineId>-<dato>` (idempotent ved fletting, som Honniscoins). Kveldssjekk er **ikke** et
item – den er en fast mal (`settings.nightly`) + en daglig kjøring (`checkRuns`) fordi den
nullstilles hver kveld og handler om tidsstempel-bevis, ikke fullføring.

## 5. Funksjonalitet

### 5.1 Fang → klassifiser (den viktigste inngangen)
- Stor, alltid tilgjengelig **«＋ Fang en tanke»** (på hjem og inne i hver kategori).
- Rekkefølge: **skriv tekst → (valgfritt) velg type → (valgfritt) kategori → lagre.**
- Teksten alene er nok. Uklassifisert item (`type:null, category:null`) havner i **Innboks**.
- Type-chips: **📝 Notat / ✅ Oppgave / ⏰ Påminnelse / 💛 På et tidspunkt.**
  - Velg **Påminnelse** → +1t / +3t / «i kveld» / «i morgen» / «velg tid» dukker opp (setter
    `remindAt`, kan sende til iOS).
  - Velg **Notat** → frist/avkryssing forsvinner (ren huskelapp).
  - Velg **På et tidspunkt** → ingen frist; `resurfaceAt` settes (standard = i dag + `somedayNudgeDays`).
- Fangst i en kategori-kontekst forhåndsvelger kategorien.

### 5.2 Hjem = kategori-rutenett med badges
- Honniscoins-aktig 3-kolonners flis-rutenett. Øverst: panda + rolig status («3 ting venter i
  dag»), **ingen tall-saldo**.
- Fliser = brukerens **kategorier** + spesial-fliser: **🌙 Kveldssjekk, 🔁 Rutiner,
  💛 På et tidspunkt, 📥 Innboks, 📋 Logg, ⚙️ Innstillinger.**
- **Badge** per flis, tre nivåer:
  - 🔴 rød = haster/i dag (forfalt eller forfaller i dag),
  - 🟢 grønn = åpne ting,
  - ⚪ grå = rolig / ingenting krever deg nå.
- Deferrede items med `resurfaceAt` i framtida teller **ikke** i badge før de dukker opp.
- Kategorier er brukerstyrt: legg til / endre / omrokkere / ikon.

### 5.3 «I dag» (hva krever meg nå)
- Toppseksjon på hjem eller egen visning: alt som forfaller i dag, forfalt, dagens rutine-
  instanser, og **nettopp gjen-oppdukkede** (deferred items hvis `resurfaceAt <= nå`).
- Dette er «se hva som gjenstår»-flaten.

### 5.4 Defer / punt (appens viktigste knapp)
- På ethvert åpent item: hurtig-handling **«Ikke nå»** → velg når det skal tilbake (+1t / +3t /
  i kveld / i morgen / neste uke / velg dato).
- Effekt: `deferred:true` + `resurfaceAt = valgt tid`. Item **gjemmes fra «hva gjenstår»** til da,
  **og** sendes til iOS-snarveien (ping ved `resurfaceAt`).
- Når `resurfaceAt` passeres: item dukker opp igjen øverst på «I dag» (ren avledning av state +
  nå-tid, ingen bakgrunnsjobb nødvendig – beregnes ved render/`migrate`).

### 5.5 Kveldssjekk
- Fast, identisk liste hver kveld (`settings.nightly`), f.eks. ytterdør låst / alarm på / bil låst
  / komfyr av.
- **Trykk-for-å-bekrefte med tidsstempel** (`checkRuns[dato].items[id] = {done:true, at}`).
  Tidsstempelet er beviset mot «lukket jeg egentlig?»-grubling.
- **Rapporter kun det som gjenstår** (ikke-bekreftede), progress-stripe «3 av 5».
- **Nullstilles automatisk hver kveld** (ny `checkRuns`-dato). Aldri falsk «alt gjort» – ukjent
  tilstand forblir ubekreftet.
- Én daglig iOS-påminnelse (via snarvei) om å kjøre lista.

### 5.6 Rutiner (daglig/ukentlig)
- Maler i `settings.routines` genererer avkryssbare `task`-items per aktiv dag.
- `schedule` støtter daglig og ukentlig (ukedags-valg). Valgfrie subtasks; auto-fullføring når alle
  subtasks er huket av (som Honniscoins). `leadDay` = vis dagen før.
- Deterministiske instans-id-er → idempotent generering/fletting. Utløp av gamle åpne instanser
  (`expireStale…`) som i Honniscoins.

### 5.7 «På et tidspunkt» (someday – kona sine fluffy ting)
- Items uten frist. Panda **dukker dem forsiktig opp igjen** via `resurfaceAt` (standard-intervall
  `somedayNudgeDays`), så lista ikke blir en uendelig skyld-bøtte man aldri leser.
- Valgfri kontekst-tag («neste gang hjemme en helg», «neste gang på butikken») – vises som pille,
  resurfacing er fortsatt tidsbasert i v1 (kontekst-trigger er framtid).

### 5.8 iOS-integrasjon (+1t / +3t og pings)
- Appen eier ikke varsling – den **delegerer til iOS** via én brukerinstallert Shortcut
  («PandaReminder»).
- Mekanikk: appen åpner `shortcuts://run-shortcut?name=<shortcutName>&input=<url-enc tekst|tid>`.
  Snarveien lager en Apple-påminnelse (eller kalenderoppføring) på gitt tid.
- Brukes av: Påminnelse-typen, defer/«ikke nå», someday-resurfacing, daglig kveldssjekk-ping.
- `iosPushedAt` hindrer dobbel-sending. **Snarvei-oppskriften dokumenteres i README** (input =
  tekst + offset/absolutt tid → «Add New Reminder»).
- Degradering: på ikke-iOS (laptop) hoppes `shortcuts://` over; in-app-resurfacing virker uansett.

### 5.9 Følelse / belønning (uten valuta)
- Deilig **kryss-animasjon** + liten **haptisk vibrasjon** (`navigator.vibrate` der støttet).
- **Panda reagerer** (nikker/blunker) ved fullføring.
- **Badge blir stille**, progress-stripe fylles, tidsstempel-bevis.
- Rolig palett: bambusgrønn aksent + myk mørk flate, panda-maskot. Store trykkflater, minimal tekst.

## 6. UI-struktur

- Ett `#app`-div; string-byggende render-funksjoner (Honniscoins-stil). Entrypunkt `routeToView()`.
- Navigasjon: hjem-rutenett → flis åpner en visning (kategori-detalj / kveldssjekk / rutiner /
  someday / innboks / logg / innstillinger). Tilbake til rutenett.
- Gjenbrukbare atomer: `.tile` (m/ badge), `.card`/`.row`, `.chk` (rund avkryssing), chip-velgere,
  fang-sheet, sammenleggbare kort (`.rhead`/`.rbody`/`.rchev`) for rutiner.
- Mockup-referanse: `mockups/skisser-v2.html` (kategori-rutenett + fang→klassifiser + kategori-
  detalj). Første retning: `mockups/skisser.html`.

## 7. Byggerekkefølge (inkrementelt, selv om målet er «alt»)

Martin valgte «alt på én gang» som mål, men vi bygger slik at noe står raskt:

1. **Fundament:** `logic.js`/`store.js`/`app.js`/`index.html`-skjelett, `item`-modell, localStorage,
   migrate, tester. Fang→klassifiser + Innboks.
2. **Kategori-rutenett + badges + kategori-detalj + «I dag».** (Kjerneloopen synlig.)
3. **Defer/«ikke nå» + resurfacing** (in-app). Appens viktigste knapp.
4. **iOS-snarvei-integrasjon** (påminnelse, defer-ping, Shortcut-oppskrift i README).
5. **Kveldssjekk** (mal + daglig kjøring + tidsstempel + nullstilling).
6. **Rutiner** (maler → instanser, daglig/ukentlig).
7. **På et tidspunkt** (someday + forsiktig resurfacing).
8. **Synk** (Supabase edge + rom-blob + fletting) – koble på når v1 står lokalt.
9. **PWA-polish** (manifest, ikoner, haptikk, panda-reaksjoner) + deploy GitHub Pages.

## 8. Testing

- `test/suite.js` – rene logikk-tester under `jsc`. Dekk: item-livssyklus (fang/klassifiser/
  done/defer), badge-/«hva gjenstår»-avledning, resurfacing-tidslogikk, kveldssjekk nullstilling +
  tidsstempel, rutine-generering/idempotens/utløp, fletting (LWW per id, tombstones, union-log),
  migrate.
- Injiser `ctx={now,id}` for deterministiske tidstester.

## 9. Åpne spørsmål / ting som sannsynligvis endrer seg

- Navnet PandaCoins (coins droppet) – beholdes inntil videre.
- Eksakt badge-terskel for «haster» vs «åpen».
- Om «I dag» er egen flis/visning eller toppseksjon på hjem-rutenettet.
- Kontekst-basert resurfacing («neste gang på butikken») – utsatt til v2.
- Service worker / ekte offline – utsatt, localStorage dekker v1.
- Snarvei-detaljer (hvordan sende absolutt vs relativ tid) – verifiseres mot faktisk iOS Shortcut.

---

**Konvensjoner:** Norsk i UI og commit-meldinger. Deploy-flyt og miljø-hooks (dcg/rampart/
pipelock, APP_VERSION-bump, cache-buster) følger samme mønster som Honniscoins.
