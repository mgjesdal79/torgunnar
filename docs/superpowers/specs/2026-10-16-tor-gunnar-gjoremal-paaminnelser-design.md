# Tor Gunnar – Gjøremål, Langsiktig, Apple Påminnelser + opprydding (design)

Dato: 2026-10-16
Status: Godkjent av Martin
Bygges som build 7.

## Mål

Rydde opp i typer og forsiden, og innføre at gjøremål med tidspunkt kan skyves til
**Apple Påminnelser** (siden web-appen ikke kan varsle på iPhone). Tidspunktet
lever også i Tor Gunnar (ingen synk tilbake – akseptert).

## Avklarte beslutninger

- **Ett-stegs fang** (ikke to steg). Større input-felt (~2 linjer, textarea).
  Rett under input: tre type-valg, ingen hopp til ny boks.
- **Typer ved fang:** ✅ **Gjøremål** (default valgt) · 💛 **Langsiktig** · 📝 **Notat**.
  - Gjøremål → `type:'task'`, Langsiktig → `type:'someday'`, Notat → `type:'note'`.
  - Langsiktig folder ut chill/dult/masete (insistence) inline, som i dag.
  - Ingen kategori-chips, ingen dato-rad i fang-arket.
- **Tid settes etterpå på et gjøremål** via knapp «⏰ Sett tid» (hurtigvalg +
  eksakt dato/klokkeslett). Tiden lagres i appen (vises i «I dag»), og en knapp
  «⏰ Legg i Påminnelser» skyver den til Apple Påminnelser (knapp-push, ikke auto).
- **Kategorier fjernes** (Jobb/Hjem/Handle). Erstattes av type-fliser. Eksisterende
  saker beholdes, mister kategori-merket.
- **Rename:** «Fra kona» → **Ingrid**; «På et tidspunkt» → **Langsiktig**.

## Forside (fliser)

> 📥 Innboks · 📌 I dag · ✅ Gjøremål · 💛 Langsiktig · 📝 Notater · 💬 Ingrid · 🔁 Rutiner · ⚙️ Innstillinger

- **Gjøremål**-flisen er den private todo-lista (badge = antall åpne gjøremål).
- **Notater**-flis uten badge.
- Kategori-fliser fjernes.

## Datamodell

- Ingen nye item-felt. Bruker eksisterende `type`, `remindAt`, `due`, `iosPushedAt`.
- `defaultState().settings.categories` settes til `[]`. `shortcutName` default endres
  fra `'PandaReminder'` til `'TorGunnar'`.
- Kategori-logikk (`addCategory`/`updateCategory`/`deleteCategory`/`reorderCategories`/
  `categoryItems`/`categoryBadge`) beholdes i `logic.js` (ubrukt av UI) for å slippe
  å rive testet kode; all kategori-UI fjernes.

## Logikk (`js/logic.js`, ren og testbar)

- `taskItems(state, now)` – åpne gjøremål: `type==='task' && !done && !removed &&
  isResurfaced`. Sortering: de med `remindAt` først, stigende på tid; deretter resten
  nyeste `createdAt` først.
- `noteItems(state)` – `type==='note' && !removed`, nyeste først.
- `scheduleTask(state, { id, at }, ctx)` – setter `remindAt = at` og `due =
  at.slice(0,10)`; setter `type='task'` hvis mangler. (Så gjøremålet dukker opp i
  «I dag» på rett dato og fyrer i «I dag» når tiden er inne.)
- `markPushedToIos(state, { id }, ctx)` – setter `iosPushedAt = ctx.now`.
- `buildShortcutUrl(shortcutName, { title, due })` – ren bygger. Apples faktiske
  skjema krever `input=text` + egen `text`-param (ikke `input=<tekst>`):
  `shortcuts://run-shortcut?name=<enc(name)>&input=text&text=<enc(JSON)>` der JSON =
  `{"title": title, "due": due}`. Alt url-enkodet. Testbar.
  - `due` sendes som **lokal** «YYYY-MM-DD HH:mm» (ikke UTC-ISO med `Z`), så snarveiens
    dato-tolkning treffer riktig klokkeslett. App-laget formaterer fra lagret `remindAt`
    (som er ISO/UTC for intern sammenligning) til lokal streng før kallet.

### Uendret / gjenbrukt
- `itemsForToday` dekker allerede `task` med `remindAt<=now` eller `due<=today`.
- `inboxItems` (ekskluderer kona), `konaItems`/`konaBadge`, `mediumItems`/`mediumBadge`
  (Langsiktig), `setInsistence`, `completeItem`, `deferItem` osv. uendret.

## UI (`js/app.js`)

### Fang-arket (ett steg)
- `<textarea>` med ~2 linjer i stedet for `<input>`.
- Tre chips rett under: Gjøremål (default `on`) / Langsiktig / Notat.
- Langsiktig valgt → insistence- (+ cadence-)chips inline.
- Fjern: kategori-chips, påminnelse-preset-raden.
- Lagre lager item med valgt type (default `task`).

### Gjøremål-visning (ny, `renderTasks`)
- Liste over `taskItems`. Hver rad: tekst, evt. «⏰ <tid>»-meta, avkryss.
- Knapp **«⏰ Sett tid»** → tid-velger (se under).
- Har tid + ikke pushet → **«⏰ Legg i Påminnelser»**. Pushet → «✓ i Påminnelser»
  + «Send på nytt».

### Tid-velger (`openTimePicker(id)`)
- Hurtigvalg-chips: +1t, +3t, i kveld (20:00), i morgen (08:00), neste uke.
- Eksakt: `<input type="datetime-local">` + «Sett».
- Bekreft → `scheduleTask(id, at)` → lukk → render.

### Legg i Påminnelser (`pushToIos(id)`)
- Formaterer `remindAt` → lokal «YYYY-MM-DD HH:mm», bygger
  `buildShortcutUrl(settings.shortcutName, {title, due})` → `window.location.href = url`
  (brukergest fra knappetrykk) → `markPushedToIos(id)`.
- Åpner Shortcuts (ev. «Åpne i Snarveier?»-prompt første gang); etter kjøring er man i
  Snarveier-appen og bytter tilbake til Safari manuelt. Akseptert.

### Notater-visning (`renderNotes`)
- Enkel liste over `noteItems` (rediger via rad = `openEdit`).

### Rename / fjerning
- `renderKona` header/flis-tekst → «Ingrid».
- `renderMedium` + flis + typeLabel: «På et tidspunkt» → «Langsiktig».
- Fjern kategori-fliser i `renderHome`, `renderCategory`-grenen, `data-cat`-handler,
  kategori-chips i arket, prefill-kategori.
- Nye fliser: ✅ Gjøremål (badge = `taskItems`-antall), 📝 Notater.

### Innstillinger
- Vis/rediger `shortcutName` (default `TorGunnar`) + kort hjelpetekst om snarveien.

## iOS-Snarvei + engangsoppsett (bygges av Martin én gang)

Snarvei `TorGunnar`:
1. Tar imot tekst (Shortcut Input, type Tekst).
2. **Get Dictionary from Input** (parser JSON-teksten).
3. **Get Dictionary Value** → `title`. **Get Dictionary Value** → `due`.
4. **Date** (eller «Get Dates from Input») på `due` → gjør teksten om til en ekte Date.
   (Steg som manglet i første utkast; «Add/Create Reminder» krever Date, ikke tekst.)
5. **Create Reminder** (iOS 26) / **Add New Reminder**: Tittel = `title`, Forfall/alarm
   = Date fra steg 4 (med klokkeslett). Valgfri fast liste, f.eks. «Tor Gunnar».

### Engangs-innstilling for «tidskritisk» (valgt strategi: global Tidssensitiv)
- **Innstillinger → Varsler → Påminnelser → Tidssensitive varsler = PÅ.**
  Da bryter alle tidsbestemte påminnelser gjennom Fokus automatisk. Snarveien trenger
  ingen per-sak-logikk for dette.
- Begrensning (dokumentert, ikke en bug): iOS 26.2 «Viktig»-alarm (gjennombrudd også ved
  lydløs) kan **ikke** settes fra snarvei/Siri per okt 2026 — må ev. hukes av manuelt
  per påminnelse. Utenfor scope.

## Cache / versjon
- `sw.js` `VERSION` → `'7'`; `index.html` `APP_VERSION` → `'7'`.

## Testing (`test/suite.js`, jsc)
- `taskItems`: kun åpne gjøremål; sortering tid-først så nyeste.
- `taskItems` utelater done/removed/deferred-ikke-moden.
- `noteItems`: kun notater, nyeste først.
- `scheduleTask`: setter remindAt + due (dato), beholder/​setter type task.
- `markPushedToIos`: setter iosPushedAt.
- `buildShortcutUrl`: `input=text` + egen `text`-param, url-enkodet JSON med title/due,
  riktig `name`-enkoding.
- Fang med default type task (via app-lag dekkes manuelt; logikk: addItem type task).

## Avgrensning (YAGNI)
- Ingen synk app↔Apple Påminnelser.
- Ingen auto-push (kun knapp).
- Ingen kategorier i UI.
- Ingen endring/sletting av kategori-logikk i logic.js (kun avkoblet fra UI).
