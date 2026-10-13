# PandaCoins – Fundament + kjerneloop (Plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** En kjørende, lokalt lagret PandaCoins-app: fang en tanke → klassifiser → se hva som gjenstår i kategori-rutenett med badges → fullfør → punt trygt (in-app resurfacing).

**Architecture:** Vanilla JS, ingen build/rammeverk, ES-moduler. Tre-lags: `js/logic.js` (ren, testet logikk, `(state,args,ctx)→ny state`), `js/store.js` (localStorage-persistens), `js/app.js` (DOM-rendering). All CSS + `APP_VERSION` i `index.html`. Ett universelt `item`; alle visninger er filtre over `state.items`.

**Tech Stack:** Vanilla ES-moduler, localStorage, JavaScriptCore (`jsc`) for logikk-tester, PWA-manifest. Ingen npm-avhengigheter.

**Scope (plan 1):** Fundament, item-modell, fang→klassifiser, kategorier+badges, «I dag», fullfør, defer/resurfacing (in-app), fletting-funksjoner. **Utenfor:** iOS-snarvei, kveldssjekk, rutiner, someday-nudging, Supabase-synk, panda-animasjoner (egne planer).

**Testkonvensjon:** Kun `js/logic.js` enhetstestes (DOM-fritt under `jsc`), som i Honniscoins. `app.js`/`index.html` verifiseres i nettleser. Alle mutasjoner tar `ctx={now,id}` for deterministiske tester.

---

## Filstruktur

- `index.html` – all CSS (panda-tema), `APP_VERSION`, `EDGE_FUNCTION_URL=''` (localStorage-modus), laster `js/app.js` som modul.
- `js/logic.js` – ren logikk + datamodell. Eneste testede fil.
- `js/store.js` – localStorage load/save + debounce; kaller `migrate`/`mergeState` fra logic.
- `js/app.js` – `App`-objekt (visningstilstand) + render/bind-funksjoner.
- `test/run-jsc.js` – kjører suiten under jsc.
- `test/suite.js` – alle logikk-tester.
- `manifest.json` – PWA.

---

## Task 1: Prosjektskjelett + testharness

**Files:**
- Create: `js/logic.js`
- Create: `test/suite.js`
- Create: `test/run-jsc.js`

- [ ] **Step 1: Lag en minimal testharness og én trivell-test**

`test/suite.js`:
```js
export function runTests() {
  const results = [];
  function t(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e) }); }
  }
  function eq(a, b, msg) {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) throw new Error((msg || 'eq') + `\n  got: ${sa}\n  exp: ${sb}`);
  }
  function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

  t('harness virker', () => { eq(1 + 1, 2); ok(true); });

  return results;
}
```

`test/run-jsc.js`:
```js
import { runTests } from './suite.js';
const results = runTests();
let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; }
  else { fail++; print(`FAIL: ${r.name}\n${r.err}`); }
}
print(`\n${pass}/${pass + fail} grønne`);
if (fail) throw new Error(`${fail} tester feilet`);
```

`js/logic.js` (tom foreløpig):
```js
// PandaCoins ren logikk. Ingen DOM/nett/globaler.
```

- [ ] **Step 2: Kjør testen og verifiser at den passerer**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: `1/1 grønne`

- [ ] **Step 3: Commit**

```bash
git add js/logic.js test/suite.js test/run-jsc.js
git commit -m "PandaCoins: testharness (jsc) + logic-skjelett

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: defaultState, clone, migrate

**Files:**
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv tester**

Legg inn i `runTests()` i `test/suite.js` (importér øverst i fila):
```js
import { defaultState, clone, migrate } from '../js/logic.js';
```
Tester (inne i `runTests`, før `return`):
```js
t('defaultState har tomme lister og kategorier', () => {
  const s = defaultState();
  eq(s.items, []);
  eq(s.log, []);
  eq(s.checkRuns, {});
  ok(Array.isArray(s.settings.categories));
  eq(s.settings.remindPresets, [60, 180]);
});
t('clone er dyp', () => {
  const s = defaultState(); const c = clone(s);
  c.items.push({ id: 'x' });
  eq(s.items.length, 0);
});
t('migrate fyller manglende felt', () => {
  const s = migrate({ items: [{ id: 'a', text: 'hei' }] }, '2026-10-13');
  ok(s.settings); ok(Array.isArray(s.settings.categories));
  eq(s.items[0].text, 'hei');
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL (`defaultState` ikke eksportert)

- [ ] **Step 3: Implementér i `js/logic.js`**

```js
export function clone(s) { return JSON.parse(JSON.stringify(s)); }

export function defaultState() {
  return {
    settings: {
      categories: [
        { id: 'jobb', label: 'Jobb', icon: '💼', order: 0 },
        { id: 'hjem', label: 'Hjem', icon: '🏠', order: 1 },
        { id: 'handle', label: 'Handle', icon: '🛒', order: 2 },
      ],
      nightly: [],
      routines: [],
      shortcutName: 'PandaReminder',
      remindPresets: [60, 180],
      somedayNudgeDays: 7,
      updatedAt: null,
    },
    items: [],
    checkRuns: {},
    log: [],
  };
}

export function migrate(state, today) {
  const d = defaultState();
  const out = clone(state || {});
  out.settings = Object.assign({}, d.settings, out.settings || {});
  if (!Array.isArray(out.settings.categories)) out.settings.categories = d.settings.categories;
  if (!Array.isArray(out.items)) out.items = [];
  if (!out.checkRuns || typeof out.checkRuns !== 'object') out.checkRuns = {};
  if (!Array.isArray(out.log)) out.log = [];
  return out;
}
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "PandaCoins: defaultState/clone/migrate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: addItem + logg

**Files:**
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv tester**

Oppdater import: `import { defaultState, clone, migrate, addItem, activeItems } from '../js/logic.js';`
```js
t('addItem legger til uklassifisert item i Innboks', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Kjøp gave' }, { now: '2026-10-13T08:00:00Z', id: 'i1' });
  const it = s.items[0];
  eq(it.id, 'i1'); eq(it.text, 'Kjøp gave');
  eq(it.type, null); eq(it.category, null);
  eq(it.done, false); eq(it.removed, false);
  eq(it.createdAt, '2026-10-13T08:00:00Z');
  eq(it.updatedAt, '2026-10-13T08:00:00Z');
});
t('addItem kan ta type og kategori med en gang', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Møte', type: 'task', category: 'jobb' },
              { now: '2026-10-13T08:00:00Z', id: 'i2' });
  eq(s.items[0].type, 'task'); eq(s.items[0].category, 'jobb');
});
t('addItem logger', () => {
  let s = defaultState();
  s = addItem(s, { text: 'x' }, { now: '2026-10-13T08:00:00Z', id: 'i3' });
  eq(s.log.length, 1); eq(s.log[0].type, 'item'); eq(s.log[0].action, 'add');
});
t('activeItems filtrerer bort removed', () => {
  let s = defaultState();
  s = addItem(s, { text: 'a' }, { now: '2026-10-13T08:00:00Z', id: 'a' });
  s.items[0].removed = true;
  eq(activeItems(s).length, 0);
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL (`addItem` ikke definert)

- [ ] **Step 3: Implementér**

```js
function pushLog(out, entry) { out.log.push(entry); }

export function addItem(state, { text, type = null, category = null }, ctx) {
  const out = clone(state);
  const item = {
    id: ctx.id, text: String(text || '').trim(),
    type, category,
    done: false, doneAt: null,
    due: null, remindAt: null,
    resurfaceAt: null, deferred: false, iosPushedAt: null,
    source: null, routineId: null, routineDate: null, subtasks: null,
    createdAt: ctx.now, updatedAt: ctx.now, removed: false,
  };
  out.items.push(item);
  pushLog(out, { id: ctx.id + ':add', type: 'item', action: 'add', itemId: ctx.id, at: ctx.now });
  return out;
}

export function activeItems(state) {
  return (state.items || []).filter((i) => !i.removed);
}
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "PandaCoins: addItem + activeItems + logg

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Klassifisering + redigering (type, kategori, tekst, påminnelse)

**Files:**
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv tester**

Import: legg til `classifyItem, setItemCategory, setItemText, setReminder` i importlista.
```js
function mk() {
  let s = defaultState();
  s = addItem(s, { text: 'x' }, { now: '2026-10-13T08:00:00Z', id: 'i1' });
  return s;
}
t('classifyItem setter type og bumper updatedAt', () => {
  let s = mk();
  s = classifyItem(s, { id: 'i1', type: 'reminder' }, { now: '2026-10-13T09:00:00Z', id: 'l' });
  eq(s.items[0].type, 'reminder');
  eq(s.items[0].updatedAt, '2026-10-13T09:00:00Z');
});
t('classifyItem til note nullstiller frist/remind/done', () => {
  let s = mk();
  s.items[0].due = '2026-10-14'; s.items[0].remindAt = 'x'; s.items[0].done = true;
  s = classifyItem(s, { id: 'i1', type: 'note' }, { now: '2026-10-13T09:00:00Z', id: 'l' });
  eq(s.items[0].due, null); eq(s.items[0].remindAt, null); eq(s.items[0].done, false);
});
t('setItemCategory', () => {
  let s = mk();
  s = setItemCategory(s, { id: 'i1', category: 'hjem' }, { now: '2026-10-13T09:00:00Z', id: 'l' });
  eq(s.items[0].category, 'hjem');
});
t('setItemText trimmer', () => {
  let s = mk();
  s = setItemText(s, { id: 'i1', text: '  ny  ' }, { now: '2026-10-13T09:00:00Z', id: 'l' });
  eq(s.items[0].text, 'ny');
});
t('setReminder setter remindAt og type reminder', () => {
  let s = mk();
  s = setReminder(s, { id: 'i1', remindAt: '2026-10-13T11:00:00Z' },
                  { now: '2026-10-13T09:00:00Z', id: 'l' });
  eq(s.items[0].remindAt, '2026-10-13T11:00:00Z');
  eq(s.items[0].type, 'reminder');
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL

- [ ] **Step 3: Implementér**

```js
function patchItem(state, id, fn, ctx) {
  const out = clone(state);
  const it = out.items.find((i) => i.id === id);
  if (!it) return state;
  fn(it);
  it.updatedAt = ctx.now;
  return out;
}

export function classifyItem(state, { id, type }, ctx) {
  return patchItem(state, id, (it) => {
    it.type = type;
    if (type === 'note') { it.due = null; it.remindAt = null; it.done = false; it.doneAt = null; }
  }, ctx);
}

export function setItemCategory(state, { id, category }, ctx) {
  return patchItem(state, id, (it) => { it.category = category; }, ctx);
}

export function setItemText(state, { id, text }, ctx) {
  return patchItem(state, id, (it) => { it.text = String(text || '').trim(); }, ctx);
}

export function setReminder(state, { id, remindAt }, ctx) {
  return patchItem(state, id, (it) => {
    it.remindAt = remindAt;
    if (!it.type || it.type === 'note') it.type = 'reminder';
  }, ctx);
}
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "PandaCoins: klassifisering + redigering av item

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Fullfør / gjenåpne / slett

**Files:**
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv tester**

Import: legg til `completeItem, reopenItem, deleteItem`.
```js
t('completeItem setter done + doneAt + logger', () => {
  let s = mk();
  s = completeItem(s, { id: 'i1' }, { now: '2026-10-13T10:00:00Z', id: 'l' });
  eq(s.items[0].done, true); eq(s.items[0].doneAt, '2026-10-13T10:00:00Z');
  ok(s.log.some((e) => e.action === 'done'));
});
t('reopenItem nullstiller done', () => {
  let s = mk();
  s = completeItem(s, { id: 'i1' }, { now: '2026-10-13T10:00:00Z', id: 'l' });
  s = reopenItem(s, { id: 'i1' }, { now: '2026-10-13T10:05:00Z', id: 'l' });
  eq(s.items[0].done, false); eq(s.items[0].doneAt, null);
});
t('deleteItem er tombstone', () => {
  let s = mk();
  s = deleteItem(s, { id: 'i1' }, { now: '2026-10-13T10:00:00Z', id: 'l' });
  eq(s.items[0].removed, true);
  eq(activeItems(s).length, 0);
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL

- [ ] **Step 3: Implementér**

```js
export function completeItem(state, { id }, ctx) {
  const out = patchItem(state, id, (it) => { it.done = true; it.doneAt = ctx.now; }, ctx);
  if (out !== state) pushLog(out, { id: id + ':done:' + ctx.now, type: 'item', action: 'done', itemId: id, at: ctx.now });
  return out;
}

export function reopenItem(state, { id }, ctx) {
  return patchItem(state, id, (it) => { it.done = false; it.doneAt = null; }, ctx);
}

export function deleteItem(state, { id }, ctx) {
  const out = patchItem(state, id, (it) => { it.removed = true; }, ctx);
  if (out !== state) pushLog(out, { id: id + ':del:' + ctx.now, type: 'item', action: 'delete', itemId: id, at: ctx.now });
  return out;
}
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "PandaCoins: fullfør/gjenåpne/slett (tombstone)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Defer / resurfacing (appens viktigste knapp)

**Files:**
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv tester**

Import: legg til `deferItem, undeferItem, isResurfaced, isPending`.
```js
t('deferItem gjemmer item og setter resurfaceAt', () => {
  let s = mk();
  s = deferItem(s, { id: 'i1', resurfaceAt: '2026-10-14T08:00:00Z' },
                { now: '2026-10-13T10:00:00Z', id: 'l' });
  eq(s.items[0].deferred, true);
  eq(s.items[0].resurfaceAt, '2026-10-14T08:00:00Z');
  ok(s.log.some((e) => e.action === 'defer'));
});
t('isResurfaced: deferred i framtida = ikke synlig', () => {
  const it = { deferred: true, resurfaceAt: '2026-10-14T08:00:00Z' };
  eq(isResurfaced(it, '2026-10-13T10:00:00Z'), false);
  eq(isResurfaced(it, '2026-10-14T09:00:00Z'), true);
});
t('isResurfaced: ikke-deferred alltid synlig', () => {
  eq(isResurfaced({ deferred: false }, '2026-10-13T10:00:00Z'), true);
});
t('isPending: åpen oppgave som ikke er gjemt', () => {
  const now = '2026-10-13T10:00:00Z';
  ok(isPending({ type: 'task', done: false, deferred: false, removed: false }, now));
  eq(isPending({ type: 'task', done: true, deferred: false }, now), false);
  eq(isPending({ type: 'note', done: false, deferred: false }, now), false);
  eq(isPending({ type: 'task', done: false, deferred: true, resurfaceAt: '2026-10-20T00:00:00Z' }, now), false);
});
t('undeferItem vekker item', () => {
  let s = mk();
  s = deferItem(s, { id: 'i1', resurfaceAt: '2026-10-20T08:00:00Z' }, { now: '2026-10-13T10:00:00Z', id: 'l' });
  s = undeferItem(s, { id: 'i1' }, { now: '2026-10-13T11:00:00Z', id: 'l' });
  eq(s.items[0].deferred, false); eq(s.items[0].resurfaceAt, null);
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL

- [ ] **Step 3: Implementér**

```js
export function deferItem(state, { id, resurfaceAt }, ctx) {
  const out = patchItem(state, id, (it) => {
    it.deferred = true; it.resurfaceAt = resurfaceAt;
    it.done = false; it.doneAt = null;
  }, ctx);
  if (out !== state) pushLog(out, { id: id + ':defer:' + ctx.now, type: 'item', action: 'defer', itemId: id, at: ctx.now, resurfaceAt });
  return out;
}

export function undeferItem(state, { id }, ctx) {
  return patchItem(state, id, (it) => { it.deferred = false; it.resurfaceAt = null; }, ctx);
}

export function isResurfaced(item, now) {
  if (!item.deferred) return true;
  return !!item.resurfaceAt && item.resurfaceAt <= now;
}

// «Pending» = krever handling nå: avkryssbar type, ikke gjort, ikke gjemt.
export function isPending(item, now) {
  if (item.removed) return false;
  if (item.type !== 'task' && item.type !== 'reminder') return false;
  if (item.done) return false;
  return isResurfaced(item, now);
}
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "PandaCoins: defer + resurfacing (isResurfaced/isPending)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Avledede visninger (Innboks, I dag, kategori-items, someday)

**Files:**
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv tester**

Import: legg til `inboxItems, itemsForToday, categoryItems, somedayItems`.
Hjelper `sameDay`: datoer er ISO; vi sammenligner `YYYY-MM-DD`-prefiks.
```js
t('inboxItems = uklassifisert (type null) og ikke gjemt', () => {
  let s = defaultState();
  s = addItem(s, { text: 'rå' }, { now: '2026-10-13T08:00:00Z', id: 'a' });
  s = addItem(s, { text: 'klar', type: 'task', category: 'jobb' }, { now: '2026-10-13T08:00:00Z', id: 'b' });
  const inb = inboxItems(s, '2026-10-13T09:00:00Z');
  eq(inb.length, 1); eq(inb[0].id, 'a');
});
t('itemsFortoday: forfalt, dagens frist, remind<=nå, resurfaced', () => {
  const now = '2026-10-13T10:00:00Z';
  let s = defaultState();
  s = addItem(s, { text: 'forfalt', type: 'task', category: 'jobb' }, { now, id: 'a' });
  s.items[0].due = '2026-10-12';
  s = addItem(s, { text: 'idag', type: 'task' }, { now, id: 'b' });
  s.items[1].due = '2026-10-13';
  s = addItem(s, { text: 'senere', type: 'task' }, { now, id: 'c' });
  s.items[2].due = '2026-10-20';
  s = addItem(s, { text: 'remind', type: 'reminder' }, { now, id: 'd' });
  s.items[3].remindAt = '2026-10-13T09:00:00Z';
  const today = itemsForToday(s, now).map((i) => i.id).sort();
  eq(today, ['a', 'b', 'd']);
});
t('itemsForToday tar med nettopp gjen-oppdukket deferred', () => {
  const now = '2026-10-13T10:00:00Z';
  let s = defaultState();
  s = addItem(s, { text: 'tilbake', type: 'task' }, { now, id: 'a' });
  s.items[0].deferred = true; s.items[0].resurfaceAt = '2026-10-13T09:00:00Z';
  eq(itemsForToday(s, now).map((i) => i.id), ['a']);
});
t('categoryItems filtrerer på kategori og aktiv', () => {
  const now = '2026-10-13T10:00:00Z';
  let s = defaultState();
  s = addItem(s, { text: 'j', type: 'task', category: 'jobb' }, { now, id: 'a' });
  s = addItem(s, { text: 'h', type: 'task', category: 'hjem' }, { now, id: 'b' });
  eq(categoryItems(s, 'jobb').map((i) => i.id), ['a']);
});
t('somedayItems', () => {
  const now = '2026-10-13T10:00:00Z';
  let s = defaultState();
  s = addItem(s, { text: 's', type: 'someday' }, { now, id: 'a' });
  eq(somedayItems(s).map((i) => i.id), ['a']);
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL

- [ ] **Step 3: Implementér**

```js
function dayOf(iso) { return (iso || '').slice(0, 10); }

export function inboxItems(state, now) {
  return activeItems(state).filter((i) => i.type == null && isResurfaced(i, now));
}

export function itemsForToday(state, now) {
  const today = dayOf(now);
  return activeItems(state).filter((i) => {
    if (i.done) return false;
    if (!isResurfaced(i, now)) return false;
    if (i.type !== 'task' && i.type !== 'reminder') return false;
    // nettopp gjen-oppdukket deferred
    if (i.deferred && i.resurfaceAt && dayOf(i.resurfaceAt) <= today) return true;
    if (i.due && dayOf(i.due) <= today) return true;
    if (i.remindAt && i.remindAt <= now) return true;
    return false;
  });
}

export function categoryItems(state, catId) {
  return activeItems(state).filter((i) => i.category === catId);
}

export function somedayItems(state) {
  return activeItems(state).filter((i) => i.type === 'someday');
}
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "PandaCoins: avledede visninger (innboks/i dag/kategori/someday)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Kategorier + badge-nivå

**Files:**
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv tester**

Import: legg til `addCategory, updateCategory, deleteCategory, reorderCategories, categoryBadge`.
```js
t('addCategory legger til med stigende order', () => {
  let s = defaultState();
  s = addCategory(s, { label: 'Trening', icon: '🏃' }, { now: '2026-10-13T08:00:00Z', id: 'trening' });
  const c = s.settings.categories.find((x) => x.id === 'trening');
  ok(c); eq(c.label, 'Trening'); eq(c.order, 3);
});
t('deleteCategory foreldreløser items til Innboks (category=null)', () => {
  const now = '2026-10-13T08:00:00Z';
  let s = defaultState();
  s = addItem(s, { text: 'x', type: 'task', category: 'jobb' }, { now, id: 'a' });
  s = deleteCategory(s, { id: 'jobb' }, { now, id: 'l' });
  eq(s.settings.categories.some((c) => c.id === 'jobb'), false);
  eq(s.items[0].category, null);
});
t('categoryBadge: hot når forfalt/i dag, open ellers, calm når tomt', () => {
  const now = '2026-10-13T10:00:00Z';
  let s = defaultState();
  // calm
  eq(categoryBadge(s, 'jobb', now).level, 'calm');
  // open (åpen uten frist)
  s = addItem(s, { text: 'a', type: 'task', category: 'jobb' }, { now, id: 'a' });
  eq(categoryBadge(s, 'jobb', now).level, 'open');
  eq(categoryBadge(s, 'jobb', now).count, 1);
  // hot (forfalt)
  s.items[0].due = '2026-10-12';
  eq(categoryBadge(s, 'jobb', now).level, 'hot');
});
t('categoryBadge teller ikke gjemte/fullførte', () => {
  const now = '2026-10-13T10:00:00Z';
  let s = defaultState();
  s = addItem(s, { text: 'a', type: 'task', category: 'jobb' }, { now, id: 'a' });
  s.items[0].done = true;
  eq(categoryBadge(s, 'jobb', now).count, 0);
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL

- [ ] **Step 3: Implementér**

```js
function bumpSettings(out, ctx) { out.settings.updatedAt = ctx.now; }

export function addCategory(state, { label, icon }, ctx) {
  const out = clone(state);
  const order = out.settings.categories.length;
  out.settings.categories.push({ id: ctx.id, label: String(label || '').trim(), icon: icon || '📂', order });
  bumpSettings(out, ctx);
  return out;
}

export function updateCategory(state, { id, patch }, ctx) {
  const out = clone(state);
  const c = out.settings.categories.find((x) => x.id === id);
  if (!c) return state;
  Object.assign(c, patch);
  bumpSettings(out, ctx);
  return out;
}

export function deleteCategory(state, { id }, ctx) {
  const out = clone(state);
  out.settings.categories = out.settings.categories.filter((c) => c.id !== id);
  out.items.forEach((i) => { if (i.category === id) { i.category = null; i.updatedAt = ctx.now; } });
  bumpSettings(out, ctx);
  return out;
}

export function reorderCategories(state, { orderedIds }, ctx) {
  const out = clone(state);
  const byId = {};
  out.settings.categories.forEach((c) => { byId[c.id] = c; });
  out.settings.categories = orderedIds.map((id, idx) => {
    const c = byId[id]; if (c) c.order = idx; return c;
  }).filter(Boolean);
  bumpSettings(out, ctx);
  return out;
}

export function categoryBadge(state, catId, now) {
  const today = dayOf(now);
  const open = categoryItems(state, catId).filter((i) => isPending(i, now));
  const hot = open.some((i) => (i.due && dayOf(i.due) <= today) || (i.remindAt && i.remindAt <= now));
  return { count: open.length, level: open.length === 0 ? 'calm' : (hot ? 'hot' : 'open') };
}
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "PandaCoins: kategorier + badge-nivå (hot/open/calm)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Fletting (mergeState) + pruneLog

**Files:**
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv tester**

Import: legg til `mergeState, pruneLog`.
```js
t('mergeState: items LWW per id på updatedAt', () => {
  const now = '2026-10-13T08:00:00Z';
  let a = addItem(defaultState(), { text: 'gammel' }, { now, id: 'x' });
  let b = clone(a);
  a.items[0].text = 'A'; a.items[0].updatedAt = '2026-10-13T09:00:00Z';
  b.items[0].text = 'B'; b.items[0].updatedAt = '2026-10-13T10:00:00Z';
  const m = mergeState(a, b);
  eq(m.items[0].text, 'B');
});
t('mergeState: tombstone vinner når nyest', () => {
  const now = '2026-10-13T08:00:00Z';
  let a = addItem(defaultState(), { text: 'x' }, { now, id: 'x' });
  let b = clone(a);
  b.items[0].removed = true; b.items[0].updatedAt = '2026-10-13T11:00:00Z';
  const m = mergeState(a, b);
  eq(m.items[0].removed, true);
});
t('mergeState: nye items fra begge kommer med', () => {
  const now = '2026-10-13T08:00:00Z';
  let a = addItem(defaultState(), { text: 'a' }, { now, id: 'a' });
  let b = addItem(defaultState(), { text: 'b' }, { now, id: 'b' });
  const m = mergeState(a, b);
  eq(m.items.map((i) => i.id).sort(), ['a', 'b']);
});
t('mergeState: settings LWW på updatedAt', () => {
  let a = defaultState(); let b = defaultState();
  a.settings.shortcutName = 'A'; a.settings.updatedAt = '2026-10-13T09:00:00Z';
  b.settings.shortcutName = 'B'; b.settings.updatedAt = '2026-10-13T10:00:00Z';
  eq(mergeState(a, b).settings.shortcutName, 'B');
});
t('mergeState: log union-by-id', () => {
  const now = '2026-10-13T08:00:00Z';
  let a = addItem(defaultState(), { text: 'a' }, { now, id: 'a' });
  let b = addItem(defaultState(), { text: 'b' }, { now, id: 'b' });
  eq(mergeState(a, b).log.length, 2);
});
t('pruneLog beholder nyeste N', () => {
  let s = defaultState();
  for (let i = 0; i < 10; i++) s.log.push({ id: 'e' + i, at: '2026-10-13T0' + i + ':00:00Z' });
  const p = pruneLog(s, 3);
  eq(p.log.length, 3); eq(p.log[2].id, 'e9');
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL

- [ ] **Step 3: Implementér**

```js
function mergeListById(a, b, pick) {
  const map = {};
  (a || []).forEach((x) => { map[x.id] = x; });
  (b || []).forEach((x) => {
    const cur = map[x.id];
    map[x.id] = cur ? pick(cur, x) : x;
  });
  return Object.values(map);
}

export function mergeState(local, remote) {
  if (!remote) return clone(local);
  if (!local) return clone(remote);
  const out = clone(local);
  // settings LWW
  const lu = local.settings && local.settings.updatedAt;
  const ru = remote.settings && remote.settings.updatedAt;
  if (ru && (!lu || ru > lu)) out.settings = clone(remote.settings);
  // items LWW per id
  out.items = mergeListById(local.items, remote.items,
    (c, x) => ((x.updatedAt || '') >= (c.updatedAt || '') ? x : c));
  // checkRuns: union datoer, per-item LWW på .at
  out.checkRuns = clone(local.checkRuns || {});
  const rc = remote.checkRuns || {};
  for (const date of Object.keys(rc)) {
    out.checkRuns[date] = out.checkRuns[date] || { items: {} };
    const ritems = (rc[date] && rc[date].items) || {};
    for (const k of Object.keys(ritems)) {
      const cur = out.checkRuns[date].items[k];
      if (!cur || (ritems[k].at || '') >= (cur.at || '')) out.checkRuns[date].items[k] = ritems[k];
    }
  }
  // log union-by-id (A vinner ved lik id)
  out.log = mergeListById(local.log, remote.log, (c) => c);
  return out;
}

export const LOG_KEEP = 200;
export function pruneLog(state, keep = LOG_KEEP) {
  const out = clone(state);
  out.log = (out.log || []).slice(-keep);
  return out;
}
```

Oppdater `migrate` til å beskjære loggen sist:
```js
// i migrate, rett før `return out;`:
  out.log = out.log.slice(-LOG_KEEP);
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "PandaCoins: mergeState (LWW/union) + pruneLog

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: store.js (localStorage) + relativ-tid-hjelper

**Files:**
- Create: `js/store.js`
- Modify: `js/logic.js`
- Modify: `test/suite.js`

- [ ] **Step 1: Skriv test for relativ-tid-hjelper (ren, i logic.js)**

Import: legg til `addMinutesIso`.
```js
t('addMinutesIso legger til minutter', () => {
  eq(addMinutesIso('2026-10-13T08:00:00.000Z', 60), '2026-10-13T09:00:00.000Z');
  eq(addMinutesIso('2026-10-13T08:00:00.000Z', 180), '2026-10-13T11:00:00.000Z');
});
```

- [ ] **Step 2: Kjør – verifiser FAIL**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FAIL

- [ ] **Step 3: Implementér hjelper i `js/logic.js`**

```js
export function addMinutesIso(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}
```

- [ ] **Step 4: Kjør – verifiser PASS**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne

- [ ] **Step 5: Skriv `js/store.js` (ikke enhetstestet – bruker localStorage)**

```js
import { defaultState, migrate, mergeState } from './logic.js';

const ROOM = (location.hash.match(/r=([\w-]+)/) || [])[1] || 'local';
const KEY = 'pandacoins:' + ROOM;

export function nowIso() { return new Date().toISOString(); }
export function todayIso() { return nowIso().slice(0, 10); }
export function newId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function loadState() {
  let local = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) local = mergeState(defaultState(), JSON.parse(raw));
  } catch (e) { /* korrupt cache → default */ }
  return migrate(local, todayIso());
}

let saveTimer = null;
export function saveState(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}
export function saveStateDebounced(state) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveState(state), 400);
}
```

- [ ] **Step 6: Commit**

```bash
git add js/logic.js js/store.js test/suite.js
git commit -m "PandaCoins: store.js (localStorage) + addMinutesIso

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: index.html + panda-tema + app-oppstart

**Files:**
- Create: `index.html`
- Create: `js/app.js`
- Create: `manifest.json`

- [ ] **Step 1: Skriv `index.html`**

```html
<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>PandaCoins</title>
<link rel="manifest" href="manifest.json">
<style>
  :root{
    --bg:#13141a; --surface:#1e2029; --surface2:#262935; --line:#323545;
    --ink:#f4f5f2; --dim:#a7acbd; --faint:#6b7087;
    --bamboo:#5fbf74; --bamboo-dim:#2f5f3a; --gold:#f5c518; --rose:#e0607a; --blue:#6aa0e0;
    --radius:18px;
  }
  *{box-sizing:border-box}
  body{margin:0;background:#0c0d12;color:var(--ink);
    font-family:-apple-system,"Segoe UI",system-ui,Arial,sans-serif;
    max-width:520px;margin:0 auto;min-height:100vh;
    padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
  .banner{text-align:center;padding:16px 10px 8px}
  .banner .b{font-weight:800;font-size:18px}
  .banner .status{color:var(--dim);font-size:13px;margin-top:4px}
  .body{padding:4px 14px 90px}
  .capbar{display:flex;align-items:center;gap:10px;background:var(--surface);
    border:1px solid var(--line);border-radius:999px;padding:13px 16px;margin:8px 2px 16px;
    color:var(--dim);font-size:15px;width:calc(100% - 4px)}
  .capbar .p{width:30px;height:30px;border-radius:50%;background:var(--bamboo);color:#06220d;
    display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;flex:none}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px}
  .tile{position:relative;background:var(--surface);border:1px solid var(--line);
    border-radius:var(--radius);padding:16px 8px 13px;text-align:center;cursor:pointer}
  .tile .ic{font-size:27px;display:block;margin-bottom:7px}
  .tile .lb{font-size:13px;font-weight:600}
  .badge{position:absolute;top:8px;right:8px;min-width:22px;height:22px;border-radius:999px;
    font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 6px}
  .badge.hot{background:var(--rose);color:#fff}
  .badge.open{background:var(--bamboo);color:#06220d}
  .badge.calm{display:none}
  h2{font-size:18px;margin:14px 2px 8px}
  .sub{color:var(--dim);font-size:13px;margin:0 2px 12px}
  .card{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);
    padding:2px 14px;margin-bottom:12px}
  .row{display:flex;align-items:center;gap:12px;padding:13px 2px;border-bottom:1px solid var(--line)}
  .row:last-child{border-bottom:none}
  .chk{width:26px;height:26px;border-radius:50%;border:2px solid var(--faint);flex:none;cursor:pointer;
    transition:transform .12s ease, background .12s ease}
  .chk.on{background:var(--bamboo);border-color:var(--bamboo)}
  .chk.pop{transform:scale(1.25)}
  .rtxt{flex:1}.rtxt .t{font-weight:600}.rtxt .m{font-size:12px;color:var(--dim);margin-top:2px}
  .rtxt.done .t{text-decoration:line-through;color:var(--faint)}
  .mini{background:none;border:1px solid var(--line);color:var(--dim);border-radius:999px;
    padding:6px 11px;font-size:13px;cursor:pointer}
  .typ{font-size:11px;padding:3px 9px;border-radius:999px;border:1px solid var(--line);color:var(--dim)}
  .back{background:none;border:none;color:var(--bamboo);font-size:15px;padding:8px 2px;cursor:pointer}
  .overlay{position:fixed;inset:0;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;
    justify-content:center;z-index:50}
  .sheet{background:var(--surface);border:1px solid var(--line);border-radius:22px 22px 0 0;
    padding:18px 16px calc(18px + env(safe-area-inset-bottom));width:100%;max-width:520px}
  .inp{width:100%;background:var(--surface2);border:1px solid var(--line);border-radius:14px;
    color:var(--ink);padding:14px;font-size:16px;margin-bottom:6px}
  .lab{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:16px 2px 8px}
  .chips{display:flex;flex-wrap:wrap;gap:8px}
  .chip{background:var(--surface2);border:1px solid var(--line);border-radius:999px;
    padding:10px 14px;font-size:14px;font-weight:600;color:var(--ink);cursor:pointer}
  .chip.on{background:var(--bamboo);border-color:var(--bamboo);color:#06220d}
  .btn{display:block;width:100%;text-align:center;background:var(--bamboo);color:#06220d;
    font-weight:800;border:none;border-radius:14px;padding:15px;font-size:15px;margin-top:18px;cursor:pointer}
  .btn.ghost{background:none;border:1px solid var(--line);color:var(--dim);margin-top:8px}
</style>
</head>
<body>
<div id="app"></div>
<script>window.EDGE_FUNCTION_URL = '';</script>
<script type="module">
  window.APP_VERSION = '1';
  import('./js/app.js?cb=' + window.APP_VERSION);
</script>
</body>
</html>
```

- [ ] **Step 2: Skriv `manifest.json`**

```json
{
  "name": "PandaCoins",
  "short_name": "PandaCoins",
  "start_url": ".",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0c0d12",
  "theme_color": "#0c0d12"
}
```

- [ ] **Step 3: Skriv `js/app.js` grunnstruktur (render tom skjerm)**

```js
import * as L from './logic.js';
import { loadState, saveStateDebounced, nowIso, newId } from './store.js';

const App = { view: 'home', catId: null, sheet: null, state: null };

function ctx() { return { now: nowIso(), id: newId() }; }
function commit(next) { App.state = next; saveStateDebounced(App.state); render(); }

function render() {
  const root = document.getElementById('app');
  root.innerHTML = '<div class="banner"><div class="b">🐼 PandaCoins</div>'
    + '<div class="status">laster…</div></div>';
}

App.state = loadState();
render();
window.App = App; // for feilsøking i konsollen
```

- [ ] **Step 4: Verifiser i nettleser**

Åpne `index.html` i nettleser (dobbeltklikk eller `file://`-sti). Forventet: mørk skjerm med «🐼 PandaCoins / laster…». Ingen konsollfeil.

- [ ] **Step 5: Commit**

```bash
git add index.html manifest.json js/app.js
git commit -m "PandaCoins: index.html + panda-tema + app-oppstart

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 12: Hjem-rutenett med badges

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Implementér hjem-render i `js/app.js`**

Erstatt `render()` og legg til hjelpere:
```js
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const SPECIAL = [
  { id: 'inbox', icon: '📥', label: 'Innboks' },
  { id: 'today', icon: '📌', label: 'I dag' },
  { id: 'settings', icon: '⚙️', label: 'Innstillinger' },
];

function statusLine() {
  const n = L.itemsForToday(App.state, nowIso()).length;
  if (n === 0) return 'Ingenting haster akkurat nå 🌱';
  return `${n} ${n === 1 ? 'ting venter' : 'ting venter'} i dag`;
}

function tileHtml(icon, label, badge, data) {
  const b = badge && badge.count
    ? `<span class="badge ${badge.level}">${badge.count}</span>` : '';
  return `<div class="tile" ${data}>${b}<span class="ic">${icon}</span>`
    + `<span class="lb">${esc(label)}</span></div>`;
}

function renderHome() {
  const now = nowIso();
  const cats = App.state.settings.categories.slice().sort((a, b) => a.order - b.order);
  const catTiles = cats.map((c) =>
    tileHtml(c.icon, c.label, L.categoryBadge(App.state, c.id, now), `data-cat="${esc(c.id)}"`)).join('');
  const inboxN = L.inboxItems(App.state, now).length;
  const todayN = L.itemsForToday(App.state, now).length;
  const special = tileHtml('📥', 'Innboks', { count: inboxN, level: inboxN ? 'hot' : 'calm' }, 'data-view="inbox"')
    + tileHtml('📌', 'I dag', { count: todayN, level: todayN ? 'open' : 'calm' }, 'data-view="today"')
    + tileHtml('⚙️', 'Innstillinger', null, 'data-view="settings"');
  return `<div class="banner"><div class="b">🐼 PandaCoins</div>`
    + `<div class="status">${esc(statusLine())}</div></div>`
    + `<div class="body">`
    + `<div class="capbar" data-cap="1"><span class="p">＋</span> Fang en tanke…</div>`
    + `<div class="grid">${catTiles}${special}</div></div>`;
}

function render() {
  const root = document.getElementById('app');
  if (App.view === 'home') root.innerHTML = renderHome();
  bind(root);
}

function bind(root) {
  root.querySelectorAll('[data-cat]').forEach((el) =>
    el.onclick = () => { App.view = 'category'; App.catId = el.dataset.cat; render(); });
  root.querySelectorAll('[data-view]').forEach((el) =>
    el.onclick = () => { App.view = el.dataset.view; render(); });
  const cap = root.querySelector('[data-cap]');
  if (cap) cap.onclick = () => openSheet(null);
}

function openSheet(_prefillCat) { /* fylles i Task 13 */ }
```

- [ ] **Step 2: Verifiser i nettleser**

Åpne `index.html`. Forventet: rutenett med Jobb/Hjem/Handle + Innboks/I dag/Innstillinger. Ingen badges ennå (ingen items). Klikk en kategori → skjermen blir tom (category-view ikke bygget ennå) — det er forventet; gå tilbake ved å laste på nytt.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "PandaCoins: hjem-rutenett med badges

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 13: Fang → klassifiser (sheet)

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Implementér fang-sheet**

Legg til i `js/app.js` og erstatt `openSheet`-stubben:
```js
const TYPES = [
  { id: 'note', label: '📝 Notat' },
  { id: 'task', label: '✅ Oppgave' },
  { id: 'reminder', label: '⏰ Påminnelse' },
  { id: 'someday', label: '💛 På et tidspunkt' },
];

function openSheet(prefillCat) {
  App.sheet = { text: '', type: null, category: prefillCat || null };
  renderSheet();
}
function closeSheet() { App.sheet = null; const o = document.getElementById('ov'); if (o) o.remove(); }

function renderSheet() {
  const s = App.sheet;
  const cats = App.state.settings.categories.slice().sort((a, b) => a.order - b.order);
  const typeChips = TYPES.map((tp) =>
    `<span class="chip ${s.type === tp.id ? 'on' : ''}" data-type="${tp.id}">${tp.label}</span>`).join('');
  const catChips = cats.map((c) =>
    `<span class="chip ${s.category === c.id ? 'on' : ''}" data-catchip="${esc(c.id)}">${c.icon} ${esc(c.label)}</span>`).join('');
  const remindRow = s.type === 'reminder'
    ? `<div class="lab">Minn meg om…</div><div class="chips">`
      + App.state.settings.remindPresets.map((m) =>
          `<span class="chip" data-remind="${m}">+${m >= 60 ? (m / 60) + 't' : m + 'm'}</span>`).join('')
      + `</div>` : '';
  const html = `<div class="overlay" id="ov"><div class="sheet">`
    + `<input class="inp" id="capText" placeholder="Hva skal du ikke glemme?" value="${esc(s.text)}">`
    + `<div class="lab">Hva er dette? (valgfritt)</div><div class="chips">${typeChips}</div>`
    + remindRow
    + `<div class="lab">Kategori (valgfritt)</div><div class="chips">${catChips}</div>`
    + `<button class="btn" id="capSave">Lagre</button>`
    + `<button class="btn ghost" id="capCancel">Avbryt</button>`
    + `</div></div>`;
  const old = document.getElementById('ov'); if (old) old.remove();
  document.getElementById('app').insertAdjacentHTML('beforeend', html);
  bindSheet();
}

function bindSheet() {
  const o = document.getElementById('ov');
  const text = o.querySelector('#capText');
  text.oninput = () => { App.sheet.text = text.value; };
  o.querySelectorAll('[data-type]').forEach((el) => el.onclick = () => {
    App.sheet.type = App.sheet.type === el.dataset.type ? null : el.dataset.type; renderSheet(); });
  o.querySelectorAll('[data-catchip]').forEach((el) => el.onclick = () => {
    App.sheet.category = App.sheet.category === el.dataset.catchip ? null : el.dataset.catchip; renderSheet(); });
  o.querySelectorAll('[data-remind]').forEach((el) => el.onclick = () => {
    App.sheet._remindMin = Number(el.dataset.remind);
    o.querySelectorAll('[data-remind]').forEach((x) => x.classList.remove('on'));
    el.classList.add('on'); });
  o.querySelector('#capCancel').onclick = closeSheet;
  o.querySelector('#capSave').onclick = saveSheet;
}

function saveSheet() {
  const s = App.sheet;
  if (!s.text.trim()) { closeSheet(); return; }
  const c = ctx();
  let next = L.addItem(App.state, { text: s.text, type: s.type, category: s.category }, c);
  if (s.type === 'reminder' && s._remindMin) {
    next = L.setReminder(next, { id: c.id, remindAt: L.addMinutesIso(c.now, s._remindMin) },
                         { now: c.now, id: newId() });
  }
  App.state = next; saveStateDebounced(App.state);
  closeSheet(); render();
}
```

- [ ] **Step 2: Verifiser i nettleser**

Åpne `index.html`. Trykk «＋ Fang en tanke» → sheet dukker opp nedenfra. Skriv tekst, velg «✅ Oppgave» + «Jobb», lagre. Innboks/kategori-badge skal oppdateres på hjem. Velg «⏰ Påminnelse» → +1t/+3t-chips vises.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "PandaCoins: fang→klassifiser sheet

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 14: Kategori-, Innboks- og I dag-visning + item-rad med fullfør/defer

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Implementér listevisninger + item-rad + handlinger**

Legg til i `js/app.js`:
```js
function itemRowHtml(it) {
  const checkable = it.type === 'task' || it.type === 'reminder';
  const chk = checkable
    ? `<span class="chk ${it.done ? 'on' : ''}" data-done="${it.id}"></span>`
    : `<span style="width:26px"></span>`;
  const meta = [];
  if (it.due) meta.push('🗓 ' + it.due);
  if (it.remindAt) meta.push('⏰ ' + it.remindAt.slice(11, 16));
  if (it.deferred && it.resurfaceAt) meta.push('💤 tilbake ' + it.resurfaceAt.slice(0, 10));
  const typeLabel = { note: 'Notat', task: 'Oppgave', reminder: 'Påminnelse', someday: 'På et tidspunkt' }[it.type] || 'Uklassifisert';
  return `<div class="row">${chk}`
    + `<div class="rtxt ${it.done ? 'done' : ''}"><div class="t">${esc(it.text)}</div>`
    + (meta.length ? `<div class="m">${esc(meta.join(' · '))}</div>` : '')
    + `</div>`
    + (checkable && !it.done ? `<button class="mini" data-defer="${it.id}">Ikke nå</button>` : '')
    + `<span class="typ">${typeLabel}</span></div>`;
}

function listCard(items) {
  if (!items.length) return `<p class="sub">Ingenting her 🌱</p>`;
  return `<div class="card">${items.map(itemRowHtml).join('')}</div>`;
}

function headerBar(title) {
  return `<div class="banner"><button class="back" data-home="1">‹ Hjem</button>`
    + `<div class="b">${esc(title)}</div></div>`;
}

function renderCategory() {
  const now = nowIso();
  const cat = App.state.settings.categories.find((c) => c.id === App.catId);
  const items = L.categoryItems(App.state, App.catId);
  const open = items.filter((i) => L.isPending(i, now));
  const notes = items.filter((i) => i.type === 'note');
  const rest = items.filter((i) => !open.includes(i) && !notes.includes(i));
  return headerBar((cat ? cat.icon + ' ' + cat.label : 'Kategori'))
    + `<div class="body">`
    + `<div class="capbar" data-cap="1"><span class="p">＋</span> Fang noe i ${esc(cat ? cat.label : '')}…</div>`
    + `<h2>Å gjøre</h2>${listCard(open)}`
    + (notes.length ? `<h2>Notater</h2>${listCard(notes)}` : '')
    + (rest.length ? `<h2>Annet</h2>${listCard(rest)}` : '')
    + `</div>`;
}

function renderInbox() {
  const items = L.inboxItems(App.state, nowIso());
  return headerBar('📥 Innboks')
    + `<div class="body"><p class="sub">Fanget uten type. Åpne for å klassifisere, eller kryss ut.</p>`
    + listCard(items) + `</div>`;
}

function renderToday() {
  const items = L.itemsForToday(App.state, nowIso());
  return headerBar('📌 I dag')
    + `<div class="body"><p class="sub">Det som krever deg nå.</p>` + listCard(items) + `</div>`;
}

function renderSettings() {
  return headerBar('⚙️ Innstillinger')
    + `<div class="body"><p class="sub">Kommer i egen plan (kategorier, kveldssjekk, rutiner, snarvei).</p></div>`;
}
```

- [ ] **Step 2: Koble visningene inn i `render()` og `bind()`**

Oppdater `render()`:
```js
function render() {
  const root = document.getElementById('app');
  const v = App.view;
  if (v === 'category') root.innerHTML = renderCategory();
  else if (v === 'inbox') root.innerHTML = renderInbox();
  else if (v === 'today') root.innerHTML = renderToday();
  else if (v === 'settings') root.innerHTML = renderSettings();
  else root.innerHTML = renderHome();
  bind(root);
}
```
Utvid `bind(root)` (legg til nederst i funksjonen):
```js
  root.querySelectorAll('[data-home]').forEach((el) =>
    el.onclick = () => { App.view = 'home'; App.catId = null; render(); });
  root.querySelectorAll('[data-done]').forEach((el) =>
    el.onclick = () => doComplete(el.dataset.done, el));
  root.querySelectorAll('[data-defer]').forEach((el) =>
    el.onclick = () => openDefer(el.dataset.defer));
```

- [ ] **Step 3: Implementér fullfør (med pop-animasjon + haptikk) og defer-meny**

```js
function doComplete(id, el) {
  el.classList.add('on', 'pop');
  if (navigator.vibrate) navigator.vibrate(12);
  setTimeout(() => {
    commit(L.completeItem(App.state, { id }, ctx()));
  }, 140);
}

const DEFER_PRESETS = [
  { label: '+1t', min: 60 }, { label: '+3t', min: 180 },
  { label: 'I kveld', atHour: 20 }, { label: 'I morgen', atHour: 8, addDay: 1 },
  { label: 'Neste uke', atHour: 8, addDay: 7 },
];

function deferTarget(p) {
  const d = new Date();
  if (p.min) return new Date(d.getTime() + p.min * 60000).toISOString();
  if (p.addDay) d.setDate(d.getDate() + p.addDay);
  d.setHours(p.atHour, 0, 0, 0);
  if (!p.addDay && d.getTime() < Date.now()) d.setDate(d.getDate() + 1); // «i kveld» passert → i morgen kveld
  return d.toISOString();
}

function openDefer(id) {
  const chips = DEFER_PRESETS.map((p, i) => `<span class="chip" data-dp="${i}">${p.label}</span>`).join('');
  const html = `<div class="overlay" id="ov"><div class="sheet">`
    + `<div class="lab">Ikke nå – dukk opp igjen:</div><div class="chips">${chips}</div>`
    + `<button class="btn ghost" id="dCancel">Avbryt</button></div></div>`;
  document.getElementById('app').insertAdjacentHTML('beforeend', html);
  const o = document.getElementById('ov');
  o.querySelector('#dCancel').onclick = () => o.remove();
  o.querySelectorAll('[data-dp]').forEach((el) => el.onclick = () => {
    const p = DEFER_PRESETS[Number(el.dataset.dp)];
    o.remove();
    commit(L.deferItem(App.state, { id, resurfaceAt: deferTarget(p) }, ctx()));
  });
}
```

- [ ] **Step 4: Verifiser i nettleser (hele kjerneloopen)**

Åpne `index.html`:
1. Fang «Ring tannlegen» som Oppgave i Jobb. Hjem: Jobb-badge = 1 (grønn).
2. Åpne Jobb → raden vises under «Å gjøre». Kryss av → pop-animasjon, raden blir gjennomstreket, badge forsvinner.
3. Fang en ny oppgave, trykk «Ikke nå» → «Neste uke». Den forsvinner fra «Å gjøre» og badge.
4. «I dag»-flisen viser forfalte/dagens/resurfacede. Innboks viser uklassifiserte.

- [ ] **Step 5: Commit**

```bash
git add js/app.js
git commit -m "PandaCoins: kategori/innboks/i dag-visning + fullfør + defer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (utført ved planskriving)

**Spec-dekning (plan 1-scope):**
- Fang→klassifiser → Task 3,4,13 ✓
- Kategori-rutenett + badges (hot/open/calm) → Task 8,12 ✓
- «I dag» / hva gjenstår → Task 7,14 ✓
- Fullfør (taktil: pop + haptikk) → Task 5,14 ✓
- Defer/resurfacing (in-app) → Task 6,14 ✓
- Innboks (uklassifisert) → Task 7,14 ✓
- Ett universelt item + migrate + fletting → Task 2,3,9 ✓
- localStorage-persistens → Task 10 ✓
- Panda-tema + PWA-manifest → Task 11 ✓
- **Bevisst utenfor plan 1** (egne planer): iOS-snarvei, kveldssjekk, rutiner, someday-nudging, Supabase-synk, panda-reaksjonsfigur, innstillinger-UI (stub i Task 14).

**Placeholder-skann:** Ingen TBD/«handle edge cases». Settings-visningen er en bevisst stub (merket), ikke en skjult oppgave.

**Typekonsistens:** `isPending`/`isResurfaced`/`categoryBadge`/`itemsForToday`/`inboxItems`/`categoryItems`/`addMinutesIso` brukes med samme signatur i logic-tester (Task 6-10) og app.js (Task 12-14). `ctx={now,id}` konsekvent. Item-feltnavn (`remindAt`,`resurfaceAt`,`deferred`,`done`) identiske i modell (Task 3) og bruk.

---

## Neste planer (ikke i denne)

- **Plan 2 – iOS-snarvei:** `shortcuts://`-utsending ved påminnelse/defer + Shortcut-oppskrift i README.
- **Plan 3 – Kveldssjekk:** mal + daglig kjøring + tidsstempel + nullstilling + rapporter kun gjenstående.
- **Plan 4 – Rutiner:** maler → deterministiske instanser (daglig/ukentlig) + auto-fullføring.
- **Plan 5 – På et tidspunkt:** someday-visning + forsiktig resurfacing-nudge.
- **Plan 6 – Synk:** Supabase edge-funksjon + rom-blob + polling i store.js.
- **Plan 7 – Polish/PWA:** panda-reaksjonsfigur, ikoner, service worker, GitHub Pages-deploy.
