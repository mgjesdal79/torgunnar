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
`VERSION` i `sw.js`. Commit-meldinger bruker `build<nr>`. **Ikke gjett neste nummer** –
les gjeldende `VERSION` i `sw.js`/`APP_VERSION` i `index.html` (helst fra `origin/main`,
ikke bare disk, siden en annen sesjon kan ha bumpet uten å ha pushet ennå) og legg +1.

## Parallelle sesjoner – IKKE del arbeidstre (lært 21.10.2026)

Det kjører ofte **flere Claude-sesjoner mot TorGunnar samtidig** (`torgunnar-*` i
`ListAgents`). De deler **samme checkout/`.git`**, så uten forholdsregler klobber de
hverandre: uforpliktede endringer fra én sesjon dukker opp som «endret på disk» hos en
annen, filer forsvinner når noen bytter branch, og build-nummer kolliderer (sett build16
+ build17 samtidig). Dette er «det som ikke er lurt».

### Gjør dette når du oppdager/forventer en samtidig sesjon
1. **Sjekk `ListAgents` ved oppstart.** Flere `torgunnar-*` = del arbeidstre-fare.
2. **Jobb i et eget git-worktree, ikke i hovedtreet.** Da får du egen arbeidsmappe +
   egen branch uten å røre den andre sesjonens filer eller HEAD:
   `git fetch origin && git worktree add -b <branch> ../TorGunnar-wt-<kort> origin/main`
   (lag ALLTID branchen fra ferske `origin/main`, ikke fra lokal/stale main – lokal
   `origin/main`-ref kan være utdatert til du har `git fetch`-et).
   Rydd etterpå: `git worktree remove ../TorGunnar-wt-<kort>`.
3. **Ikke `git add -A`/commit i hovedtreet** hvis det ligger fremmede uforpliktede
   endringer der (f.eks. `store.js`, `supabase/`, bumpet `sw.js`) – det er den andre
   sesjonens pågående arbeid. Stage kun dine egne filer eksplisitt.
4. **Les filer på nytt rett før redigering** – de kan ha endret seg på disk siden sist.
5. Ved reell koordinering: `SendMessage` til den andre `torgunnar-*`-sesjonen.

### Test
`/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
(ren logikk i `js/logic.js` er testet; `js/app.js` = UI, ikke testet). Må være grønn før PR.
