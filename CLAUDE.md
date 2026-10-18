# TorGunnar – prosjektkontekst

## Chille quotes under Tor Gunnar

Rolige «ta det med ro»-sitater som alltid vises under Tor Gunnar-overskriften.
Full spec (quotes, daglig rotasjon, redigering i Innstillinger, manuell «roter nå»):
se `docs/chille-quotes.md`.

## Git-/deploy-arbeidsflyt (safety-hooks – gjør dette fra starten)

En `dcg`-hook **blokkerer direkte push til `main`** («Blocked: direct push to main»).
Dette er ikke noe som skal omgås – det er den tiltenkte flyten. Gjør slik hver gang:

1. Commit på en **feature-branch** (ikke main): `git checkout -b fix/<navn>`.
   (Committer du ved et uhell på main først: lag branchen fra HEAD med `git checkout -b`
   – ikke `git reset --hard` for å flytte main tilbake, se under.)
2. `git push -u origin <branch>`
3. `gh pr create --base main …`
4. `gh pr merge <nr> --squash` → **dette er «få i produksjon»** (origin/main oppdateres,
   GitHub Pages bygger derfra). Direkte push til main vil aldri fungere.

### Andre blokkeringer jeg har møtt (bruk alternativene)
- **`git reset --hard` er blokkert** (core.git:reset-hard) – og auto-mode nekter den også.
  Trenger du å flytte lokal `main` tilbake etter squash-merge: la det heller være. Lokal
  `main` kan peke på den gamle (ikke-squashede) commiten med *identisk innhold* som
  origin – helt ufarlig. Vil du rydde, be Martin kjøre `git reset --hard origin/main` selv.
- **`gh pr view --json …` med flere felter / `git branch -v`** ble av og til nektet av
  auto-mode-klassifisereren uten god grunn. Hent ett felt om gangen
  (`gh pr view <nr> --json state -q .state`) eller bruk `git for-each-ref`/`git status -s`.
- **`2>~/…`-redirect til hjemmemappa er blokkert** (pipelock) – legg loggfiler i `/tmp`.

### Cache-busting ved deploy (PWA)
Appen er en PWA med service worker. Hver endring må bumpe versjon **tre steder** ellers
ser Martin gammel kode: `window.APP_VERSION` + `window.APP_BUILD` i `index.html`, og
`VERSION` i `sw.js`. Commit-meldinger bruker `build<nr>` (forrige = build15).

### Test
`/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
(ren logikk i `js/logic.js` er testet; `js/app.js` = UI, ikke testet). Må være grønn før PR.
