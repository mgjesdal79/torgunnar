# Tor Gunnar – Mellomlang liste («På et tidspunkt») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gi `someday`-items («💛 På et tidspunkt») et eget hjem på forsiden med tre maste-nivåer (chill/dult/masete), så saker Martin ikke kan gjøre nå husker seg selv og kommer tilbake i riktig rytme.

**Architecture:** Bygger ut eksisterende `someday`-type med to felt (`insistence`, `cadenceDays`). Ren logikk i `js/logic.js` (testes med jsc), DOM i `js/app.js`. To kanaler for retur: Dult → dukker opp i Innboks når intervallet er gått; Masete → vedvarende badge på ny 💛-flis. Null endring i item-visninger som finnes fra før (someday vises ingen andre steder i dag), og items-merge (LWW per id) dekker de nye feltene uten synk-endring.

**Tech Stack:** Vanilla JS ES-moduler, ingen build. Tester kjøres med `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js` (output «N/N grønne»).

---

## Filer

- Modify: `js/logic.js` – nye rene funksjoner + felt i `addItem`
- Modify: `test/suite.js` – import-linje, `L`-namespace, nye tester
- Modify: `js/app.js` – hjem-flis, `renderMedium`, ark-kontroller, innboks-seksjon, handlere
- Modify: `sw.js`, `index.html` – cache-bump til v5

Arbeid på egen branch `tor-gunnar-mellomlang`. Push til `main` er blokkert av dcg → merge lokalt, Martin pusher selv.

- [ ] **Forarbeid: branch**

```bash
git checkout -b tor-gunnar-mellomlang
```

---

### Task 1: Item-felt + `setInsistence`

**Files:**
- Modify: `js/logic.js` (item-literal i `addItem`; ny funksjon etter rutine-seksjonen)
- Test: `test/suite.js`

- [ ] **Step 1: Legg nye funksjoner til test-importen**

I `test/suite.js` linje 1, utvid importen med de nye navnene (legg til på slutten før `} from '../js/logic.js';`):

```js
, setInsistence, nudgeDue, snoozeNudge, promoteToToday, mediumItems, mediumBadge
```

Og i `L`-namespacet (linje 2) legg til de samme:

```js
, setInsistence, nudgeDue, snoozeNudge, promoteToToday, mediumItems, mediumBadge
```

- [ ] **Step 2: Skriv feilende test**

Rett før `return results;` på slutten av `runTests()` i `test/suite.js`:

```js
  // ---- Mellomlang liste («På et tidspunkt») ----
  function somedayState() {
    let s = defaultState();
    s = addItem(s, { text: 'Støvler', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'm1' });
    return s;
  }
  t('setInsistence nudge setter cadence + resurfaceAt', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    const it = s.items[0];
    eq(it.insistence, 'nudge'); eq(it.cadenceDays, 7);
    eq(it.resurfaceAt, '2026-10-23T08:00:00.000Z');
  });
  t('setInsistence chill nullstiller cadence/resurfaceAt', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    s = L.setInsistence(s, { id: 'm1', insistence: 'chill' }, { now: '2026-10-16T08:00:00.000Z' });
    eq(s.items[0].cadenceDays, null); eq(s.items[0].resurfaceAt, null);
  });
```

- [ ] **Step 3: Kjør testen og se at den feiler**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL (f.eks. `setInsistence is not a function` / import feiler).

- [ ] **Step 4: Implementer**

I `js/logic.js`, i `addItem`-item-literalen, legg til feltene rett etter `source: null, routineId: null, routineDate: null, subtasks: null,`:

```js
    insistence: null, cadenceDays: null,
```

Og legg til ny seksjon nederst i fila (etter rutine-funksjonene):

```js
// ---- Mellomlang liste: «På et tidspunkt» (someday med insistence) ----
export function setInsistence(state, { id, insistence, cadenceDays }, ctx) {
  return patchItem(state, id, (it) => {
    it.insistence = insistence;
    if (insistence === 'nudge') {
      it.cadenceDays = cadenceDays || 7;
      it.resurfaceAt = addMinutesIso(ctx.now, it.cadenceDays * 1440);
    } else {
      it.cadenceDays = null;
      it.resurfaceAt = null;
    }
  }, ctx);
}
```

- [ ] **Step 5: Kjør testen og se at den passerer**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: PASS (grønt-tallet øker med 2).

- [ ] **Step 6: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(mellomlang): someday-felt insistence/cadenceDays + setInsistence"
```

---

### Task 2: `nudgeDue`, utvidet `inboxItems`, `snoozeNudge`, `promoteToToday`

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

Legg til rett etter testene fra Task 1:

```js
  t('nudgeDue: forfalt dult-sak er due, framtidig er ikke', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    eq(L.nudgeDue(s.items[0], '2026-10-20T08:00:00.000Z'), false);
    eq(L.nudgeDue(s.items[0], '2026-10-30T08:00:00.000Z'), true);
  });
  t('nudgeDue: chill-sak er aldri due', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'chill' }, { now: '2026-10-16T08:00:00.000Z' });
    eq(L.nudgeDue(s.items[0], '2026-11-30T08:00:00.000Z'), false);
  });
  t('inboxItems tar med forfalt dult-sak + uklassifisert', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Uklar' }, { now: '2026-10-16T08:00:00.000Z', id: 'u1' });
    s = addItem(s, { text: 'Støvler', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'm1' });
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    const ids = inboxItems(s, '2026-10-30T08:00:00.000Z').map((i) => i.id).sort();
    eq(ids, ['m1', 'u1']);
    const ids2 = inboxItems(s, '2026-10-20T08:00:00.000Z').map((i) => i.id);
    eq(ids2, ['u1']);
  });
  t('snoozeNudge flytter resurfaceAt fram med cadence', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 3 }, { now: '2026-10-16T08:00:00.000Z' });
    s = L.snoozeNudge(s, { id: 'm1' }, { now: '2026-10-25T08:00:00.000Z' });
    eq(s.items[0].resurfaceAt, '2026-10-28T08:00:00.000Z');
  });
  t('promoteToToday gjør someday til task med forfall i dag', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nag' }, { now: '2026-10-16T08:00:00.000Z' });
    s = L.promoteToToday(s, { id: 'm1' }, { now: '2026-10-16T08:00:00.000Z' });
    const it = s.items[0];
    eq(it.type, 'task'); eq(it.due, '2026-10-16'); eq(it.insistence, null);
    const today = itemsForToday(s, '2026-10-16T09:00:00.000Z').map((i) => i.id);
    eq(today, ['m1']);
  });
```

- [ ] **Step 2: Kjør og se at de feiler**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL (`nudgeDue is not a function` m.m.).

- [ ] **Step 3: Implementer**

Legg til i `js/logic.js` i mellomlang-seksjonen, og ERSTATT eksisterende `inboxItems`:

```js
export function nudgeDue(item, now) {
  return !!item && !item.removed && !item.done
    && item.type === 'someday' && item.insistence === 'nudge'
    && !!item.resurfaceAt && item.resurfaceAt <= now;
}

export function snoozeNudge(state, { id }, ctx) {
  return patchItem(state, id, (it) => {
    const days = it.cadenceDays || 7;
    it.resurfaceAt = addMinutesIso(ctx.now, days * 1440);
  }, ctx);
}

export function promoteToToday(state, { id }, ctx) {
  return patchItem(state, id, (it) => {
    it.type = 'task';
    it.due = (ctx.now || '').slice(0, 10);
    it.insistence = null;
    it.cadenceDays = null;
    it.resurfaceAt = null;
    it.deferred = false;
  }, ctx);
}
```

Erstatt `inboxItems` (står ca. linje 138) med:

```js
export function inboxItems(state, now) {
  return activeItems(state).filter((i) =>
    (i.type == null && isResurfaced(i, now)) || nudgeDue(i, now));
}
```

- [ ] **Step 4: Kjør og se at de passerer**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(mellomlang): nudgeDue + innboks-kanal, snoozeNudge, promoteToToday"
```

---

### Task 3: `mediumItems` + `mediumBadge`

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

Legg til etter testene fra Task 2:

```js
  t('mediumItems: someday ikke-done sortert nag→nudge→chill', () => {
    let s = defaultState();
    s = addItem(s, { text: 'C', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'c' });
    s = addItem(s, { text: 'A', type: 'someday' }, { now: '2026-10-16T08:00:01.000Z', id: 'a' });
    s = addItem(s, { text: 'B', type: 'someday' }, { now: '2026-10-16T08:00:02.000Z', id: 'b' });
    s = L.setInsistence(s, { id: 'c', insistence: 'chill' }, { now: 'N' });
    s = L.setInsistence(s, { id: 'a', insistence: 'nag' }, { now: 'N' });
    s = L.setInsistence(s, { id: 'b', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    eq(L.mediumItems(s).map((i) => i.id), ['a', 'b', 'c']);
  });
  t('mediumItems utelater done', () => {
    let s = somedayState();
    s = completeItem(s, { id: 'm1' }, { now: 'N' });
    eq(L.mediumItems(s).length, 0);
  });
  t('mediumBadge teller kun nag', () => {
    let s = defaultState();
    s = addItem(s, { text: 'A', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'B', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'b' });
    s = L.setInsistence(s, { id: 'a', insistence: 'nag' }, { now: 'N' });
    s = L.setInsistence(s, { id: 'b', insistence: 'chill' }, { now: 'N' });
    eq(L.mediumBadge(s), { count: 1, level: 'open' });
  });
```

- [ ] **Step 2: Kjør og se at de feiler**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL.

- [ ] **Step 3: Implementer**

Legg til i `js/logic.js` i mellomlang-seksjonen:

```js
export function mediumItems(state) {
  const rank = { nag: 0, nudge: 1, chill: 2 };
  return activeItems(state)
    .filter((i) => i.type === 'someday' && !i.done)
    .sort((a, b) =>
      rank[a.insistence || 'chill'] - rank[b.insistence || 'chill']
      || (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function mediumBadge(state) {
  const n = activeItems(state)
    .filter((i) => i.type === 'someday' && !i.done && i.insistence === 'nag').length;
  return { count: n, level: n ? 'open' : 'calm' };
}
```

- [ ] **Step 4: Kjør og se at de passerer**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: PASS (alle grønne, ~68/68).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(mellomlang): mediumItems + mediumBadge (nag-count)"
```

---

### Task 4: Hjem-flis + `renderMedium`-flate + handlere

**Files:**
- Modify: `js/app.js`

(DOM-kode – ingen jsc-test. Verifiser i nettleser: `python3 -m http.server 8000` og åpne `http://localhost:8000`.)

- [ ] **Step 1: Legg til hjem-flis**

I `renderHome`, utvid `special` slik at 💛-flisen kommer først (ved siden av kategoriene):

```js
  const mediumN = L.mediumBadge(App.state);
  const special = tileHtml('💛', 'På et tidspunkt', mediumN, 'data-view="medium"')
    + tileHtml('📥', 'Innboks', { count: inboxN, level: inboxN ? 'hot' : 'calm' }, 'data-view="inbox"')
    + tileHtml('📌', 'I dag', { count: todayN, level: todayN ? 'open' : 'calm' }, 'data-view="today"')
    + tileHtml('🔁', 'Rutiner', null, 'data-view="routines"')
    + tileHtml('⚙️', 'Innstillinger', null, 'data-view="settings"');
```

- [ ] **Step 2: Legg til render-gren**

I `render()`, legg til etter `today`-grenen:

```js
  else if (v === 'medium') root.innerHTML = renderMedium();
```

- [ ] **Step 3: Legg til flate-rendering + hjelpere**

Legg til i `js/app.js` (f.eks. rett etter `renderToday`):

```js
function daysUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function mediumRowHtml(it) {
  const now = nowIso();
  const chk = `<span class="chk ${it.done ? 'on' : ''}" data-done="${it.id}"></span>`;
  const meta = [];
  if (it.insistence === 'nudge') {
    if (it.resurfaceAt && it.resurfaceAt <= now) meta.push('👋 klar nå');
    else if (it.resurfaceAt) meta.push('👋 om ' + daysUntil(it.resurfaceAt) + ' d');
  }
  return `<div class="row">${chk}`
    + `<div class="rtxt" data-edit="${it.id}"><div class="t">${esc(it.text)}</div>`
    + (meta.length ? `<div class="m">${esc(meta.join(' · '))}</div>` : '')
    + `</div>`
    + `<button class="mini" data-promote="${it.id}">I dag</button></div>`;
}

function renderMedium() {
  const items = L.mediumItems(App.state);
  const groups = [['nag', '📣 Masete'], ['nudge', '👋 Dult'], ['chill', '😴 Chill']];
  let body = '';
  groups.forEach(([key, label]) => {
    const g = items.filter((i) => (i.insistence || 'chill') === key);
    if (g.length) body += `<h2>${label}</h2><div class="card">${g.map(mediumRowHtml).join('')}</div>`;
  });
  if (!body) body = `<p class="sub">Ingenting her ennå. Fang noe som «💛 På et tidspunkt».</p>`;
  return headerBar('💛 På et tidspunkt')
    + `<div class="body">`
    + `<div class="capbar" data-cap="1" data-captype="someday"><span class="p">＋</span> Fang noe til senere…</div>`
    + body + `</div>`;
}
```

- [ ] **Step 4: Legg til handlere**

I `bind(root)`, legg til (ved de andre `data-*`-handlerne):

```js
  root.querySelectorAll('[data-promote]').forEach((el) =>
    el.onclick = () => commit(L.promoteToToday(App.state, { id: el.dataset.promote }, ctx())));
  root.querySelectorAll('[data-msnooze]').forEach((el) =>
    el.onclick = () => commit(L.snoozeNudge(App.state, { id: el.dataset.msnooze }, ctx())));
```

- [ ] **Step 5: Verifiser i nettleser**

Start `python3 -m http.server 8000`, åpne appen, fang en «På et tidspunkt»-sak, sett masete, se at 💛-flisen får badge og at flaten viser seksjonen. Trykk «I dag» → saken havner i I dag.

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat(mellomlang): hjem-flis + flate + promoter/snooze-handlere"
```

---

### Task 5: Insistence-kontroller i fang-/rediger-arket

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Gi `openSheet` type-prefill + insistence-default**

Erstatt `openSheet` og utvid `openEdit`:

```js
function openSheet(prefillCat, prefillType) {
  App.sheet = { editId: null, text: '', type: prefillType || null, category: prefillCat || null,
                insistence: 'chill', cadenceDays: 7 };
  renderSheet();
}
function openEdit(id) {
  const it = App.state.items.find((i) => i.id === id);
  if (!it) return;
  App.sheet = { editId: id, text: it.text || '', type: it.type || null, category: it.category || null,
                insistence: it.insistence || 'chill', cadenceDays: it.cadenceDays || 7 };
  renderSheet();
}
```

- [ ] **Step 2: La capbar sende type-prefill**

I `bind(root)`, erstatt capbar-linja:

```js
  const cap = root.querySelector('[data-cap]');
  if (cap) cap.onclick = () => openSheet(null, cap.dataset.captype || null);
```

- [ ] **Step 3: Vis insistence-rad i arket**

I `renderSheet`, legg til etter `typeChips`-definisjonen og før `html`-strengen:

```js
  const INSIST_CHIPS = [['chill', '😴 Chill'], ['nudge', '👋 Dult'], ['nag', '📣 Masete']];
  const insistRow = s.type === 'someday'
    ? `<div class="lab">Hvor mye skal den mase?</div><div class="chips">`
      + INSIST_CHIPS.map(([k, l]) =>
          `<span class="chip ${s.insistence === k ? 'on' : ''}" data-insist="${k}">${l}</span>`).join('')
      + `</div>`
      + (s.insistence === 'nudge'
          ? `<div class="lab">Kom tilbake hver…</div><div class="chips">`
            + [3, 7, 14, 30].map((d) =>
                `<span class="chip ${s.cadenceDays === d ? 'on' : ''}" data-cad="${d}">${d} dager</span>`).join('')
            + `</div>`
          : '')
    : '';
```

Og sett `${insistRow}` inn i html rett etter type-chips-raden (etter `<div class="chips">${typeChips}</div>`):

```js
    + `<div class="lab">Hva er dette? (valgfritt)</div><div class="chips">${typeChips}</div>`
    + insistRow
    + remindRow
```

- [ ] **Step 4: Bind chip-klikk**

I `bindSheet`, legg til (etter type-chip-handleren):

```js
  o.querySelectorAll('[data-insist]').forEach((el) => el.onclick = () => {
    App.sheet.insistence = el.dataset.insist; renderSheet(); });
  o.querySelectorAll('[data-cad]').forEach((el) => el.onclick = () => {
    App.sheet.cadenceDays = Number(el.dataset.cad); renderSheet(); });
```

- [ ] **Step 5: Lagre insistence**

I `saveSheet`, legg til rett før reminder-blokken (`if (s.type === 'reminder' ...)`):

```js
  if (s.type === 'someday') {
    next = L.setInsistence(next, { id, insistence: s.insistence, cadenceDays: s.cadenceDays },
                           { now: c.now, id: newId() });
  }
```

- [ ] **Step 6: Verifiser i nettleser**

Fang sak → velg «På et tidspunkt» → se insistence-chips; velg Dult → se dager-presets; lagre → åpne 💛-flaten og bekreft plassering/meta. Rediger samme sak → chips reflekterer lagret verdi.

- [ ] **Step 7: Commit**

```bash
git add js/app.js
git commit -m "feat(mellomlang): insistence + cadence-valg i fang-/rediger-arket"
```

---

### Task 6: Dult-seksjon i Innboks

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Erstatt `renderInbox` + legg til `nudgeRowHtml`**

```js
function nudgeRowHtml(it) {
  return `<div class="row"><span class="chk" data-done="${it.id}"></span>`
    + `<div class="rtxt" data-edit="${it.id}"><div class="t">${esc(it.text)}</div>`
    + `<div class="m">👋 hver ${it.cadenceDays || 7}. dag</div></div>`
    + `<button class="mini" data-promote="${it.id}">I dag</button>`
    + `<button class="mini" data-msnooze="${it.id}">Dult igjen</button></div>`;
}

function renderInbox() {
  const now = nowIso();
  const all = L.inboxItems(App.state, now);
  const nudge = all.filter((i) => L.nudgeDue(i, now));
  const fresh = all.filter((i) => i.type == null);
  const freshCard = fresh.length ? listCard(fresh) : (nudge.length ? '' : `<p class="sub">Innboksen er tom 🌱</p>`);
  const nudgeCard = nudge.length
    ? `<h2>👋 Dult – på tide igjen?</h2><div class="card">${nudge.map(nudgeRowHtml).join('')}</div>`
    : '';
  return headerBar('📥 Innboks')
    + `<div class="body"><p class="sub">Fanget uten type, og saker på sikt som melder seg igjen.</p>`
    + freshCard + nudgeCard + `</div>`;
}
```

- [ ] **Step 2: Verifiser i nettleser**

Lag en dult-sak med cadence 3 dager, sett `resurfaceAt` bakover i konsollen (`App.state.items.find(i=>i.text==='...').resurfaceAt='2020-01-01T00:00:00.000Z'; App._=App.state;`) eller vent – åpne Innboks og bekreft at saken vises under «Dult – på tide igjen?» med «I dag» + «Dult igjen». «Dult igjen» skal fjerne den fra innboksen (ny resurfaceAt fram i tid).

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat(mellomlang): dult-seksjon i Innboks (I dag + Dult igjen)"
```

---

### Task 7: Cache-bump, full testkjøring, merge

**Files:**
- Modify: `sw.js`, `index.html`

- [ ] **Step 1: Bump service worker-versjon**

I `sw.js` linje 1:

```js
const VERSION = '5';
```

- [ ] **Step 2: Bump app-versjon + build-dato**

I `index.html`, i modul-scriptet nederst:

```js
window.APP_VERSION = '5'; window.APP_BUILD = '2026-10-16';
```

- [ ] **Step 3: Full testkjøring**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne (~68/68), ingen FAIL.

- [ ] **Step 4: Røyktest i nettleser**

Åpne appen på nytt, bekreft build-stempel «build 5 · 2026-10-16» nederst, og at hele mellomlang-flyten virker (fang → flate → I dag → innboks-dult).

- [ ] **Step 5: Commit**

```bash
git add sw.js index.html
git commit -m "chore(mellomlang): bump cache til v5"
```

- [ ] **Step 6: Merge til main**

```bash
git checkout main
git merge --no-ff tor-gunnar-mellomlang -m "Merge tor-gunnar-mellomlang: mellomlang liste (Fase 2)"
```

- [ ] **Step 7: Martin pusher**

Push til main er blokkert av dcg for meg. Gi Martin kommandoen:

```bash
git push origin main
```

---

## Self-review

- **Spec-dekning:** Gjenbruk someday ✓ (Task 1), egen flis ✓ (Task 4), chill/dult/masete ✓ (Task 1/3/5), dult→innboks ✓ (Task 2/6), masete→badge ✓ (Task 3/4), cadence per sak ✓ (Task 1/5), flate m/seksjoner + «I dag»-promoter ✓ (Task 4), ark-kontroller ✓ (Task 5), merge dekker feltene (LWW per id) ✓ (ingen endring nødvendig).
- **Null regresjon:** someday vises ingen andre steder; `inboxItems` utvides additivt (unclassified beholdes). Eksisterende tester skal fortsatt passere.
- **Typekonsistens:** feltnavn `insistence`/`cadenceDays`/`resurfaceAt` brukt likt i logikk, ark og flate. Verdier `'chill'|'nudge'|'nag'`. Handler-attributter `data-promote`/`data-msnooze`/`data-done`/`data-edit`/`data-captype` konsistente mellom render og bind.
