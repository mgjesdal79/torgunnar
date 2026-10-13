# PandaCoins PWA-ikon + offline + publisering – Implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gjør ferdig PandaCoins til en installerbar PWA (panda-ikon + offline) og publiser på GitHub Pages så den kan legges på telefonens hjem-skjerm.

**Architecture:** Rene statiske filer, ingen bygge-steg. Byttbart appikon fra én SVG-kilde rendret til PNG med `rsvg-convert`. Service worker cacher app-skallet (cache-first, versjonert). Publisering = GitHub Pages fra `main`/rot, som Honniscoins.

**Tech Stack:** Vanilla JS/HTML, `rsvg-convert` (PNG fra SVG), `sips` (verifisering), `gh` CLI (repo + Pages).

---

## Filstruktur

- Create: `icon-src.svg` — redigerbar ikon-kilde (panda på bambusgrønn, kun grunnformer)
- Create: `tools/gen-icons.sh` — regenererer alle PNG-er fra `icon-src.svg`
- Create (generert): `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.png`
- Create: `sw.js` — service worker, cacher app-skallet
- Modify: `manifest.json` — legg til `icons`-array
- Modify: `index.html` — ikon-lenker i `<head>` + registrer service worker

Ingen endring i `js/logic.js` → eksisterende jsc-suite (37/37) skal fortsatt være grønn gjennom hele planen; kjør den som regresjonssjekk til slutt.

---

### Task 1: Byttbart panda-appikon (SVG-kilde + PNG-generering)

**Files:**
- Create: `icon-src.svg`
- Create: `tools/gen-icons.sh`
- Create (generert): `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `favicon.png`

- [ ] **Step 1: Skriv SVG-kilden**

Kun `rect`/`circle`/`ellipse` med korte tall (unngår pipelock på lange path-tallrekker). Motiv innenfor sentral «safe zone» for maskable.

Create `icon-src.svg`:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect x="0" y="0" width="512" height="512" fill="#5fbf74"/>
  <circle cx="182" cy="140" r="50" fill="#1a1a1a"/>
  <circle cx="330" cy="140" r="50" fill="#1a1a1a"/>
  <circle cx="256" cy="278" r="150" fill="#ffffff"/>
  <ellipse cx="212" cy="268" rx="38" ry="50" fill="#1a1a1a" transform="rotate(-18 212 268)"/>
  <ellipse cx="300" cy="268" rx="38" ry="50" fill="#1a1a1a" transform="rotate(18 300 268)"/>
  <circle cx="218" cy="260" r="15" fill="#ffffff"/>
  <circle cx="220" cy="262" r="8" fill="#1a1a1a"/>
  <circle cx="294" cy="260" r="15" fill="#ffffff"/>
  <circle cx="292" cy="262" r="8" fill="#1a1a1a"/>
  <ellipse cx="256" cy="330" rx="20" ry="13" fill="#1a1a1a"/>
</svg>
```

- [ ] **Step 2: Skriv regenererings-skriptet**

Create `tools/gen-icons.sh`:

```bash
#!/usr/bin/env bash
# Regenererer alle app-ikoner fra icon-src.svg.
# Bytt ikon: erstatt icon-src.svg, kjør denne, commit PNG-ene.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC="icon-src.svg"
rsvg-convert -w 192 -h 192 "$SRC" -o icon-192.png
rsvg-convert -w 512 -h 512 "$SRC" -o icon-512.png
rsvg-convert -w 180 -h 180 "$SRC" -o apple-touch-icon.png
rsvg-convert -w 32  -h 32  "$SRC" -o favicon.png
echo "Ikoner regenerert fra $SRC"
```

- [ ] **Step 3: Gjør skriptet kjørbart og generer PNG-ene**

Run:
```bash
chmod +x tools/gen-icons.sh && ./tools/gen-icons.sh
```
Expected: utskrift «Ikoner regenerert fra icon-src.svg», ingen feil.

- [ ] **Step 4: Verifiser PNG-dimensjoner**

Run:
```bash
for f in icon-192.png icon-512.png apple-touch-icon.png favicon.png; do sips -g pixelWidth -g pixelHeight "$f" | grep pixel; done
```
Expected: 192×192, 512×512, 180×180, 32×32 (to linjer per fil).

- [ ] **Step 5: Commit**

```bash
git add icon-src.svg tools/gen-icons.sh icon-192.png icon-512.png apple-touch-icon.png favicon.png
git commit -m "feat: byttbart panda-appikon (SVG-kilde + PNG-generering)"
```

---

### Task 2: Service worker (offline app-skall)

**Files:**
- Create: `sw.js`

- [ ] **Step 1: Skriv service worker**

Create `sw.js`:

```js
const VERSION = '1';
const CACHE = 'pandacoins-v' + VERSION;
const SHELL = [
  './', './index.html', './manifest.json',
  './js/logic.js', './js/store.js', './js/app.js',
  './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((res) => {
      if (res && res.ok && new URL(req.url).origin === location.origin) {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
```

- [ ] **Step 2: Verifiser at service worker parser uten feil**

Run:
```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -e "load('sw.js'); print('sw.js parses')" 2>&1 | tail -3
```
Expected: `sw.js parses`. (Merk: `self`/`caches` finnes ikke i jsc — hvis det feiler på *referanse* til `self` ved kjøretid er det greit; vi tester kun at det ikke er *syntaksfeil*. Hvis kommandoen kaster `ReferenceError: self`, regn syntaks som OK. Kun `SyntaxError` er en reell feil her.)

Alternativ ren syntakssjekk uten å kjøre toppnivå:
```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -e "var f=readFile('sw.js'); new Function(f); print('sw.js syntax OK')"
```
Expected: `sw.js syntax OK`.

- [ ] **Step 3: Commit**

```bash
git add sw.js
git commit -m "feat: service worker for offline (cacher app-skall, versjonert)"
```

---

### Task 3: Koble ikon + service worker inn i manifest og index.html

**Files:**
- Modify: `manifest.json`
- Modify: `index.html`

- [ ] **Step 1: Legg icons-array i manifest.json**

Erstatt hele innholdet i `manifest.json` med:

```json
{
  "name": "PandaCoins",
  "short_name": "PandaCoins",
  "start_url": ".",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0c0d12",
  "theme_color": "#0c0d12",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 2: Legg ikon-lenker i index.html `<head>`**

I `index.html`, rett etter linja `<link rel="manifest" href="manifest.json">`, legg til:

```html
<link rel="apple-touch-icon" href="apple-touch-icon.png">
<link rel="icon" type="image/png" href="favicon.png">
```

Behold eksisterende `<meta name="theme-color" content="#0c0d12">` (hvis den ikke finnes, legg den til i `<head>`).

- [ ] **Step 3: Registrer service worker i index.html**

I `index.html`, rett etter oppstarts-scriptet (linja `import('./js/app.js?cb=' + window.APP_VERSION);` og dens avsluttende `</script>`), legg til et nytt script:

```html
<script>
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    });
  }
</script>
```

- [ ] **Step 4: Verifiser koblingene**

Run:
```bash
grep -nE "apple-touch-icon|favicon.png|serviceWorker.register" index.html
grep -c "icon-512.png" manifest.json
```
Expected: tre treff i index.html (apple-touch, favicon, register), og `2` for icon-512 i manifest.

- [ ] **Step 5: Regresjon – logikk-testene fortsatt grønne**

Run:
```bash
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js
```
Expected: `37/37 grønne`.

- [ ] **Step 6: Commit**

```bash
git add manifest.json index.html
git commit -m "feat: koble appikon + service worker inn i manifest og index.html"
```

---

### Task 4: Publiser på GitHub Pages

**Files:** ingen (bruker `gh` CLI).

- [ ] **Step 1: Opprett offentlig GitHub-repo og push main**

Run:
```bash
gh repo create pandacoins --public --source=. --remote=origin --push
```
Expected: repo `mgjesdal79/pandacoins` opprettet, `main` pushet.

**Hvis push blokkeres av en sikkerhets-hook (dcg o.l.):** IKKE omgå. Stopp, rapporter nøyaktig hva som ble blokkert til Martin, og spør hvordan han vil fortsette.

- [ ] **Step 2: Slå på GitHub Pages (main / rot)**

Run:
```bash
gh api -X POST repos/mgjesdal79/pandacoins/pages -f 'source[branch]=main' -f 'source[path]=/' 2>&1 || \
gh api -X PUT repos/mgjesdal79/pandacoins/pages -f 'source[branch]=main' -f 'source[path]=/'
```
Expected: JSON med Pages-konfig (status/`html_url`). Hvis den alt er på, bruk PUT-varianten.

- [ ] **Step 3: Vent på bygg og verifiser at URL-en svarer**

GitHub Pages har 1–2 min latens. Vent, så sjekk:
```bash
sleep 90
curl -s -o /dev/null -w "%{http_code}\n" https://mgjesdal79.github.io/pandacoins/
```
Expected: `200`. (Hvis `404`, vent ett minutt til og gjenta — første bygg kan ta lenger.)

- [ ] **Step 4: Verifiser at nøkkel-filer serveres**

Run:
```bash
for p in manifest.json sw.js icon-192.png apple-touch-icon.png; do
  echo -n "$p "; curl -s -o /dev/null -w "%{http_code}\n" "https://mgjesdal79.github.io/pandacoins/$p";
done
```
Expected: `200` for alle fire.

- [ ] **Step 5: Oppsummer til Martin**

Oppgi URL-en og framgangsmåten på telefon:
> Åpne **https://mgjesdal79.github.io/pandacoins/** i Safari på telefonen → trykk Del-knappen → «Legg til på Hjem-skjerm». Da får du 🐼-ikonet og fullskjerm. Appen virker offline etter første åpning.

Ingen commit (publisering endrer ingen filer).

---

## Self-Review (utført ved skriving)

- **Spec-dekning:** Ikon (byttbar SVG→PNG) = Task 1; offline/service worker = Task 2; manifest+index-kobling = Task 3; GitHub Pages-publisering = Task 4. Alle spec-punkter dekket.
- **Placeholder-scan:** Ingen TBD/TODO; all kode og alle kommandoer er konkrete.
- **Type-/navnekonsistens:** `icon-192.png`/`icon-512.png`/`apple-touch-icon.png`/`favicon.png`, `sw.js`, cache `pandacoins-v1` og SHELL-stier matcher faktiske filer og `js/`-struktur. `APP_VERSION` i index.html (='1') og `VERSION` i sw.js (='1') er bevisst holdt i takt; bump begge ved neste deploy.
