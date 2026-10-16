# Tor Gunnar – Rutiner (fase 1) – Implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til rutiner i appen: redigerbare maler som gir avkryssbare dagsrutiner, både faste (ukedager) og sovende (vekk ved behov), bak egen 🔁-flate UTEN badge (pull, ikke push).

**Architecture:** Rutine-maler bor i `settings.routines` (settings-LWW ved merge). Rutine-instanser (dagens avkrysninger) bor i et NYTT toppnivå-array `state.routineInstances` — helt adskilt fra `items`, så eksisterende item-visninger/badges er urørt. Instanser er dag-bundet med deterministisk id `<routineId>:<dato>`, genereres idempotent, og ryddes når datoen er passert. Ren logikk i `logic.js` (enhetstestet med jsc), UI i `app.js` (nettleser, ikke testet).

**Tech Stack:** Vanilla JS (ES modules), jsc-testharness.

---

## Filstruktur

- Modify: `js/logic.js` — datamodell + rutine-funksjoner (rene)
- Modify: `test/suite.js` — nye enhetstester
- Modify: `js/app.js` — 🔁 Rutiner-flate, instans-kort, mal-editor, generering ved last
- Modify: `index.html` — litt CSS for rutine-kort/ukedag-piller

**Konvensjoner (fra eksisterende kode):**
- Alle logic-fn er rene: `(state, args, ctx={now,id}) → ny state`. Returner `state` uendret hvis id ikke finnes.
- `clone`, `bumpSettings(out, ctx)`, `patchItem` finnes alt. `nowIso/todayIso/newId` i store.js.
- Test-API i `test/suite.js`: `t('navn', fn)`, `eq(a,b)`, `ok(v)` (bekreft eksakt API ved implementering).

---

### Task 1: Datamodell-fundament (instans-array, migrate, merge, dato-hjelpere)

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

Legg til i `test/suite.js`:

```js
t('defaultState har routineInstances-array', () => {
  ok(Array.isArray(L.defaultState().routineInstances));
});

t('weekdayKey gir riktig ukedag', () => {
  eq(L.weekdayKey('2026-10-16'), 'fri'); // 16. okt 2026 er fredag
  eq(L.weekdayKey('2026-10-18'), 'sun');
});

t('addDaysIso legger til dager uten TZ-sprang', () => {
  eq(L.addDaysIso('2026-10-16', 1), '2026-10-17');
  eq(L.addDaysIso('2026-10-31', 1), '2026-11-01');
});

t('migrate initialiserer og rydder gamle routineInstances', () => {
  const s = L.defaultState();
  s.routineInstances = [
    { id: 'a:2026-10-10', date: '2026-10-10' },
    { id: 'a:2026-10-16', date: '2026-10-16' },
  ];
  const m = L.migrate(s, '2026-10-16');
  eq(m.routineInstances.length, 1);
  eq(m.routineInstances[0].date, '2026-10-16');
});

t('mergeState forener routineInstances per id (LWW)', () => {
  const a = L.defaultState(); a.routineInstances = [{ id: 'x', updatedAt: '2026-10-16T08:00:00Z', v: 1 }];
  const b = L.defaultState(); b.routineInstances = [{ id: 'x', updatedAt: '2026-10-16T09:00:00Z', v: 2 }, { id: 'y', updatedAt: '2026-10-16T09:00:00Z' }];
  const m = L.mergeState(a, b);
  const x = m.routineInstances.find((i) => i.id === 'x');
  eq(x.v, 2);
  eq(m.routineInstances.length, 2);
});
```

- [ ] **Step 2: Kjør testene og se at de feiler**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FEIL (weekdayKey/addDaysIso finnes ikke; routineInstances mangler).

- [ ] **Step 3: Implementer**

I `js/logic.js`:

a) I `defaultState()`, legg til toppnivå-felt etter `log: []`:
```js
    log: [],
    routineInstances: [],
```

b) I `migrate`, rett før `return out;`, legg til:
```js
  if (!Array.isArray(out.routineInstances)) out.routineInstances = [];
  if (today) out.routineInstances = out.routineInstances.filter((i) => i.date >= today);
```

c) I `mergeState`, rett etter items-flettingen (`out.items = mergeListById(...)`), legg til:
```js
  out.routineInstances = mergeListById(local.routineInstances, remote.routineInstances,
    (c, x) => ((x.updatedAt || '') >= (c.updatedAt || '') ? x : c));
```

d) Nær `addMinutesIso` nederst, legg til dato-hjelpere:
```js
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function weekdayKey(dateStr) {
  return WEEKDAYS[new Date(dateStr + 'T12:00:00').getDay()];
}
export function addDaysIso(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Kjør testene og se at de passerer**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne (inkl. de nye).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(rutiner): datamodell – routineInstances, migrate-prune, merge, dato-hjelpere"
```

---

### Task 2: Mal-CRUD (addRoutine / updateRoutine / deleteRoutine)

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

```js
t('addRoutine legger til mal med standardverdier', () => {
  const s = L.addRoutine(L.defaultState(), { routine: { title: 'Kveldssjekk', subtasks: [{ text: 'Lås dør' }], weekdays: ['mon'] } }, { now: 'N', id: 'r1' });
  const r = s.settings.routines[0];
  eq(r.id, 'r1'); eq(r.title, 'Kveldssjekk');
  eq(r.enabled, true); eq(r.sleeping, false); eq(r.leadDay, false);
  eq(r.subtasks.length, 1); ok(r.subtasks[0].id);
  eq(s.settings.updatedAt, 'N');
});

t('updateRoutine patcher og bumper updatedAt', () => {
  let s = L.addRoutine(L.defaultState(), { routine: { title: 'A' } }, { now: 'N1', id: 'r1' });
  s = L.updateRoutine(s, { id: 'r1', patch: { title: 'B', sleeping: true } }, { now: 'N2', id: 'x' });
  eq(s.settings.routines[0].title, 'B');
  eq(s.settings.routines[0].sleeping, true);
  eq(s.settings.routines[0].updatedAt, 'N2');
});

t('deleteRoutine fjerner mal og dens instanser', () => {
  let s = L.addRoutine(L.defaultState(), { routine: { title: 'A' } }, { now: 'N', id: 'r1' });
  s.routineInstances = [{ id: 'r1:2026-10-16', routineId: 'r1', date: '2026-10-16' }];
  s = L.deleteRoutine(s, { id: 'r1' }, { now: 'N2', id: 'x' });
  eq(s.settings.routines.length, 0);
  eq(s.routineInstances.length, 0);
});

t('updateRoutine på ukjent id returnerer uendret', () => {
  const s0 = L.defaultState();
  const s1 = L.updateRoutine(s0, { id: 'nope', patch: { title: 'X' } }, { now: 'N', id: 'x' });
  eq(s1, s0);
});
```

- [ ] **Step 2: Kjør og se feil**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FEIL (funksjonene finnes ikke).

- [ ] **Step 3: Implementer**

I `js/logic.js` (etter kategori-funksjonene, før `mergeListById`):

```js
export function addRoutine(state, { routine }, ctx) {
  const out = clone(state);
  const r = routine || {};
  out.settings.routines.push({
    id: ctx.id,
    title: String(r.title || '').trim(),
    subtasks: (r.subtasks || []).map((s, i) => ({
      id: s.id || (ctx.id + ':s' + i), text: String(s.text || '').trim(),
    })),
    weekdays: Array.isArray(r.weekdays) ? r.weekdays.slice() : [],
    enabled: r.enabled !== false,
    leadDay: !!r.leadDay,
    sleeping: !!r.sleeping,
    updatedAt: ctx.now,
  });
  bumpSettings(out, ctx);
  return out;
}

export function updateRoutine(state, { id, patch }, ctx) {
  const out = clone(state);
  const r = out.settings.routines.find((x) => x.id === id);
  if (!r) return state;
  Object.assign(r, patch);
  r.updatedAt = ctx.now;
  bumpSettings(out, ctx);
  return out;
}

export function deleteRoutine(state, { id }, ctx) {
  const out = clone(state);
  const before = out.settings.routines.length;
  out.settings.routines = out.settings.routines.filter((x) => x.id !== id);
  if (out.settings.routines.length === before) return state;
  out.routineInstances = (out.routineInstances || []).filter((i) => i.routineId !== id);
  bumpSettings(out, ctx);
  return out;
}
```

- [ ] **Step 4: Kjør og se grønt**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(rutiner): mal-CRUD (addRoutine/updateRoutine/deleteRoutine)"
```

---

### Task 3: Instans-generering, vekking og rydding

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

```js
function routineState() {
  let s = L.addRoutine(L.defaultState(), { routine: { title: 'Kveld', subtasks: [{ text: 'Lås' }], weekdays: ['fri'] } }, { now: 'N', id: 'r1' });
  return s;
}

t('generateRoutineInstances lager instans på matchende ukedag', () => {
  const s = L.generateRoutineInstances(routineState(), '2026-10-16', { now: 'N' }); // fredag
  eq(s.routineInstances.length, 1);
  eq(s.routineInstances[0].id, 'r1:2026-10-16');
  eq(s.routineInstances[0].subtasks[0].done, false);
});

t('generateRoutineInstances lager ingenting på ikke-matchende dag', () => {
  const s = L.generateRoutineInstances(routineState(), '2026-10-17', { now: 'N' }); // lørdag
  eq(s.routineInstances.length, 0);
});

t('generateRoutineInstances er idempotent', () => {
  let s = L.generateRoutineInstances(routineState(), '2026-10-16', { now: 'N' });
  s = L.generateRoutineInstances(s, '2026-10-16', { now: 'N' });
  eq(s.routineInstances.length, 1);
});

t('leadDay lager også morgendagens instans', () => {
  let s = L.addRoutine(L.defaultState(), { routine: { title: 'Man', weekdays: ['mon'], leadDay: true } }, { now: 'N', id: 'r1' });
  s = L.generateRoutineInstances(s, '2026-10-18', { now: 'N' }); // søndag, i morgen = mandag
  ok(s.routineInstances.some((i) => i.id === 'r1:2026-10-19'));
});

t('sovende maler genereres ikke automatisk', () => {
  let s = L.addRoutine(L.defaultState(), { routine: { title: 'S', weekdays: ['fri'], sleeping: true } }, { now: 'N', id: 'r1' });
  s = L.generateRoutineInstances(s, '2026-10-16', { now: 'N' });
  eq(s.routineInstances.length, 0);
});

t('wakeRoutine materialiserer instans for i dag', () => {
  let s = L.addRoutine(L.defaultState(), { routine: { title: 'S', sleeping: true, subtasks: [{ text: 'X' }] } }, { now: 'N', id: 'r1' });
  s = L.wakeRoutine(s, { id: 'r1', date: '2026-10-16' }, { now: 'N2' });
  eq(s.routineInstances.length, 1);
  eq(s.routineInstances[0].id, 'r1:2026-10-16');
});

t('routineInstancesForDate skjuler skippede', () => {
  let s = L.wakeRoutine(L.addRoutine(L.defaultState(), { routine: { title: 'S', sleeping: true } }, { now: 'N', id: 'r1' }), { id: 'r1', date: '2026-10-16' }, { now: 'N2' });
  eq(L.routineInstancesForDate(s, '2026-10-16').length, 1);
  s.routineInstances[0].skipped = true;
  eq(L.routineInstancesForDate(s, '2026-10-16').length, 0);
});

t('pruneRoutineInstances dropper gamle datoer', () => {
  const s = L.defaultState();
  s.routineInstances = [{ id: 'a', date: '2026-10-10' }, { id: 'b', date: '2026-10-16' }];
  const p = L.pruneRoutineInstances(s, '2026-10-16');
  eq(p.routineInstances.length, 1);
});
```

- [ ] **Step 2: Kjør og se feil**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FEIL.

- [ ] **Step 3: Implementer**

I `js/logic.js` (etter mal-CRUD):

```js
function makeInstance(r, date, ctx) {
  return {
    id: r.id + ':' + date,
    routineId: r.id,
    date,
    title: r.title,
    subtasks: (r.subtasks || []).map((s) => ({ id: s.id, text: s.text, done: false })),
    done: false, doneAt: null, skipped: false,
    createdAt: ctx.now, updatedAt: ctx.now,
  };
}
function ensureInstance(out, r, date, ctx) {
  const id = r.id + ':' + date;
  if ((out.routineInstances || []).some((i) => i.id === id)) return;
  out.routineInstances.push(makeInstance(r, date, ctx));
}

export function generateRoutineInstances(state, today, ctx) {
  const out = clone(state);
  if (!Array.isArray(out.routineInstances)) out.routineInstances = [];
  const tomorrow = addDaysIso(today, 1);
  const twk = weekdayKey(today);
  const mwk = weekdayKey(tomorrow);
  (out.settings.routines || []).forEach((r) => {
    if (!r.enabled || r.sleeping) return;
    const wd = r.weekdays || [];
    if (wd.includes(twk)) ensureInstance(out, r, today, ctx);
    if (r.leadDay && wd.includes(mwk)) ensureInstance(out, r, tomorrow, ctx);
  });
  return out;
}

export function wakeRoutine(state, { id, date }, ctx) {
  const out = clone(state);
  if (!Array.isArray(out.routineInstances)) out.routineInstances = [];
  const r = (out.settings.routines || []).find((x) => x.id === id);
  if (!r) return state;
  const d = date || (ctx.now || '').slice(0, 10);
  const existing = out.routineInstances.find((i) => i.id === r.id + ':' + d);
  if (existing) { existing.skipped = false; existing.updatedAt = ctx.now; return out; }
  out.routineInstances.push(makeInstance(r, d, ctx));
  return out;
}

export function routineInstancesForDate(state, date) {
  return (state.routineInstances || []).filter((i) => i.date === date && !i.skipped);
}

export function pruneRoutineInstances(state, today) {
  const out = clone(state);
  out.routineInstances = (out.routineInstances || []).filter((i) => i.date >= today);
  return out;
}

export function sleepingRoutines(state) {
  return (state.settings.routines || []).filter((r) => r.sleeping);
}
```

- [ ] **Step 4: Kjør og se grønt**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(rutiner): generering, vekking, rydding av instanser"
```

---

### Task 4: Avkryssing og skip av instanser

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

```js
function wokenInst() {
  let s = L.addRoutine(L.defaultState(), { routine: { title: 'S', sleeping: true, subtasks: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] } }, { now: 'N', id: 'r1' });
  return L.wakeRoutine(s, { id: 'r1', date: '2026-10-16' }, { now: 'N2' });
}

t('toggleRoutineSubtask huker av og setter done når alt er gjort', () => {
  let s = wokenInst();
  const iid = 'r1:2026-10-16';
  s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'a' }, { now: 'N3' });
  eq(s.routineInstances[0].done, false);
  s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'b' }, { now: 'N4' });
  eq(s.routineInstances[0].done, true);
  eq(s.routineInstances[0].doneAt, 'N4');
});

t('toggleRoutineSubtask av igjen nullstiller done', () => {
  let s = wokenInst();
  const iid = 'r1:2026-10-16';
  s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'a' }, { now: 'N3' });
  s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'b' }, { now: 'N4' });
  s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'a' }, { now: 'N5' });
  eq(s.routineInstances[0].done, false);
  eq(s.routineInstances[0].doneAt, null);
});

t('allSubtasksDone: tom liste er ikke done', () => {
  eq(L.allSubtasksDone({ subtasks: [] }), false);
  eq(L.allSubtasksDone({ subtasks: [{ done: true }] }), true);
});

t('skipRoutineInstance markerer skipped', () => {
  let s = wokenInst();
  s = L.skipRoutineInstance(s, { instanceId: 'r1:2026-10-16' }, { now: 'N3' });
  eq(s.routineInstances[0].skipped, true);
});
```

- [ ] **Step 2: Kjør og se feil**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: FEIL.

- [ ] **Step 3: Implementer**

I `js/logic.js`:

```js
export function allSubtasksDone(inst) {
  const subs = (inst && inst.subtasks) || [];
  return subs.length > 0 && subs.every((s) => s.done);
}

export function toggleRoutineSubtask(state, { instanceId, subId }, ctx) {
  const out = clone(state);
  const inst = (out.routineInstances || []).find((i) => i.id === instanceId);
  if (!inst) return state;
  const sub = (inst.subtasks || []).find((s) => s.id === subId);
  if (!sub) return state;
  sub.done = !sub.done;
  inst.done = allSubtasksDone(inst);
  inst.doneAt = inst.done ? ctx.now : null;
  inst.updatedAt = ctx.now;
  return out;
}

export function skipRoutineInstance(state, { instanceId }, ctx) {
  const out = clone(state);
  const inst = (out.routineInstances || []).find((i) => i.id === instanceId);
  if (!inst) return state;
  inst.skipped = true; inst.updatedAt = ctx.now;
  return out;
}
```

- [ ] **Step 4: Kjør og se grønt**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(rutiner): avkryssing (toggleRoutineSubtask) + skip"
```

---

### Task 5: UI – 🔁 Rutiner-flate (fliser, instans-kort, interaksjon)

**Files:**
- Modify: `js/app.js`
- Modify: `index.html` (CSS)

- [ ] **Step 1: CSS i index.html**

Rett før `</style>` i `index.html`, legg til:

```css
  .rhead{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 2px;cursor:pointer}
  .rhead .t{font-weight:700}
  .rbody{padding:2px 2px 10px}
  .wdrow{display:flex;flex-wrap:wrap;gap:6px}
  .progbar{height:4px;border-radius:3px;background:var(--line);margin:4px 2px 8px;overflow:hidden}
  .progbar>i{display:block;height:100%;background:var(--bamboo)}
```

- [ ] **Step 2: Generering ved last + ved åpning av flata**

I `js/app.js`:

a) Utvid store-importen (linje 2) til å inkludere `todayIso`:
```js
import { loadState, saveStateDebounced, nowIso, todayIso, newId } from './store.js';
```

b) Legg til helper etter `commit`:
```js
function syncRoutines(s) {
  const today = todayIso();
  let next = L.pruneRoutineInstances(s, today);
  next = L.generateRoutineInstances(next, today, ctx());
  return next;
}
```

c) Nederst, endre oppstarten:
```js
App.state = loadState();
App.state = syncRoutines(App.state);
saveStateDebounced(App.state);
render();
window.App = App;
```

d) I `bind`, endre `[data-view]`-handleren så rutine-flata synkes ved åpning:
```js
  root.querySelectorAll('[data-view]').forEach((el) =>
    el.onclick = () => {
      App.view = el.dataset.view;
      if (App.view === 'routines') { App.state = syncRoutines(App.state); saveStateDebounced(App.state); }
      render();
    });
```

- [ ] **Step 3: Rutiner-flis på hjem (UTEN badge)**

I `renderHome`, i `special`-blokken, legg til en rutine-flis rett før Innstillinger-flisa:
```js
  const special = tileHtml('📥', 'Innboks', { count: inboxN, level: inboxN ? 'hot' : 'calm' }, 'data-view="inbox"')
    + tileHtml('📌', 'I dag', { count: todayN, level: todayN ? 'open' : 'calm' }, 'data-view="today"')
    + tileHtml('🔁', 'Rutiner', null, 'data-view="routines"')
    + tileHtml('⚙️', 'Innstillinger', null, 'data-view="settings"');
```

- [ ] **Step 4: Rutestate + render-rute**

I `App`-objektet (linje 4), legg til felt:
```js
const App = { view: 'home', catId: null, sheet: null, state: null, rOpen: {}, routineEdit: null };
```

I `render()`, legg til en gren:
```js
  else if (v === 'routines') root.innerHTML = renderRoutines();
```

- [ ] **Step 5: renderRoutines + kort-hjelpere**

Legg til i `js/app.js` (f.eks. etter `renderToday`):

```js
const WD = [['mon', 'Man'], ['tue', 'Tir'], ['wed', 'Ons'], ['thu', 'Tor'], ['fri', 'Fre'], ['sat', 'Lør'], ['sun', 'Søn']];
const WD_LABEL = {}; WD.forEach(([k, l]) => { WD_LABEL[k] = l; });

function instCardHtml(inst) {
  const subs = inst.subtasks || [];
  const n = subs.length;
  const d = subs.filter((s) => s.done).length;
  const open = !!App.rOpen[inst.id];
  const pct = n ? Math.round((d / n) * 100) : 0;
  const rows = subs.map((s) =>
    `<div class="row"><span class="chk ${s.done ? 'on' : ''}" data-rsub="${inst.id}|${s.id}"></span>`
    + `<div class="rtxt ${s.done ? 'done' : ''}"><div class="t">${esc(s.text)}</div></div></div>`).join('');
  return `<div class="card">`
    + `<div class="rhead" data-rtoggle="${inst.id}">`
    + `<span class="t">${inst.done ? '✅ ' : ''}${esc(inst.title)}</span>`
    + `<span class="sub">${d} av ${n} gjort</span></div>`
    + (n ? `<div class="progbar"><i style="width:${pct}%"></i></div>` : '')
    + (open ? `<div class="rbody">${rows}`
        + `<button class="mini" data-rskip="${inst.id}">Ikke i dag</button> `
        + `<button class="mini" data-redit="${inst.routineId}">Rediger mal</button></div>` : '')
    + `</div>`;
}

function sleepRowHtml(r) {
  return `<div class="row"><div class="rtxt"><div class="t">${esc(r.title)}</div>`
    + `<div class="m">${(r.subtasks || []).length} steg</div></div>`
    + `<button class="mini" data-rwake="${r.id}">Vekk</button>`
    + `<button class="mini" data-redit="${r.id}">✎</button></div>`;
}

function tmplRowHtml(r) {
  const when = r.sleeping ? 'sovende' : ((r.weekdays || []).length ? r.weekdays.map((k) => WD_LABEL[k] || k).join(' ') : 'ingen dager');
  return `<div class="row"><div class="rtxt"><div class="t">${r.enabled ? '' : '⏸ '}${esc(r.title)}</div>`
    + `<div class="m">${esc(when)}${r.leadDay ? ' · dagen før' : ''}</div></div>`
    + `<button class="mini" data-redit="${r.id}">✎</button></div>`;
}

function renderRoutines() {
  const today = todayIso();
  const tomorrow = L.addDaysIso(today, 1);
  const todayInst = L.routineInstancesForDate(App.state, today);
  const tomInst = L.routineInstancesForDate(App.state, tomorrow);
  const sleeping = L.sleepingRoutines(App.state);
  const all = App.state.settings.routines.slice();
  return headerBar('🔁 Rutiner')
    + `<div class="body">`
    + `<p class="sub">Dine rutiner maser ikke – du henter dem når du vil.</p>`
    + `<h2>I dag</h2>` + (todayInst.length ? todayInst.map(instCardHtml).join('') : `<p class="sub">Ingen aktive i dag.</p>`)
    + (tomInst.length ? `<h2>For i morgen 🌙</h2>` + tomInst.map(instCardHtml).join('') : '')
    + `<h2>Sovende</h2>` + (sleeping.length ? `<div class="card">${sleeping.map(sleepRowHtml).join('')}</div>` : `<p class="sub">Ingen sovende rutiner.</p>`)
    + `<h2>Alle rutiner</h2>` + (all.length ? `<div class="card">${all.map(tmplRowHtml).join('')}</div>` : `<p class="sub">Ingen ennå.</p>`)
    + `<button class="btn" data-rnew="1">＋ Ny rutine</button>`
    + `</div>`;
}
```

- [ ] **Step 6: Wiring i bind()**

I `bind(root)`, legg til (etter de eksisterende `querySelectorAll`-blokkene):
```js
  root.querySelectorAll('[data-rtoggle]').forEach((el) =>
    el.onclick = () => { const id = el.dataset.rtoggle; App.rOpen[id] = !App.rOpen[id]; render(); });
  root.querySelectorAll('[data-rsub]').forEach((el) =>
    el.onclick = () => {
      const [instanceId, subId] = el.dataset.rsub.split('|');
      commit(L.toggleRoutineSubtask(App.state, { instanceId, subId }, ctx()));
    });
  root.querySelectorAll('[data-rskip]').forEach((el) =>
    el.onclick = () => commit(L.skipRoutineInstance(App.state, { instanceId: el.dataset.rskip }, ctx())));
  root.querySelectorAll('[data-rwake]').forEach((el) =>
    el.onclick = () => commit(L.wakeRoutine(App.state, { id: el.dataset.rwake, date: todayIso() }, ctx())));
  root.querySelectorAll('[data-rnew]').forEach((el) =>
    el.onclick = () => openRoutineEditor(null));
  root.querySelectorAll('[data-redit]').forEach((el) =>
    el.onclick = () => openRoutineEditor(el.dataset.redit));
```

(`openRoutineEditor` implementeres i Task 6; legg gjerne inn en midlertidig `function openRoutineEditor(){}` nå så filen ikke kaster, og erstatt i Task 6.)

- [ ] **Step 7: Verifiser struktur og regresjon**

Run:
```bash
cd /Users/martingjesdal/dev/PandaCoins
grep -nE "renderRoutines|data-view=\"routines\"|instCardHtml|data-rsub|syncRoutines" js/app.js | head
grep -n "rhead" index.html
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js
```
Expected: treff på alle app.js-funksjonene, CSS i index.html, og logikk-tester fortsatt grønne.

- [ ] **Step 8: Commit**

```bash
git add js/app.js index.html
git commit -m "feat(rutiner): 🔁 Rutiner-flate med instans-kort, vekking og avkryssing"
```

---

### Task 6: UI – mal-editor (ny/rediger rutine)

**Files:**
- Modify: `js/app.js`

- [ ] **Step 1: Implementer editoren**

Erstatt den midlertidige `openRoutineEditor` fra Task 5 med følgende (plasser nær `openSheet`):

```js
function openRoutineEditor(id) {
  if (id) {
    const r = App.state.settings.routines.find((x) => x.id === id);
    App.routineEdit = r ? L.clone(r) : null;
    if (!App.routineEdit) return;
  } else {
    App.routineEdit = { id: null, title: '', subtasks: [{ id: 't0', text: '' }], weekdays: [], enabled: true, leadDay: false, sleeping: false };
  }
  renderRoutineEditor();
}

function renderRoutineEditor() {
  const e = App.routineEdit;
  const wdChips = WD.map(([k, l]) =>
    `<span class="chip ${(e.weekdays || []).includes(k) ? 'on' : ''}" data-ewd="${k}">${l}</span>`).join('');
  const subRows = (e.subtasks || []).map((s, i) =>
    `<div class="row"><input class="inp" style="margin:0" data-esub="${i}" value="${esc(s.text)}" placeholder="Deloppgave…">`
    + `<button class="mini" data-eup="${i}">↑</button>`
    + `<button class="mini" data-edown="${i}">↓</button>`
    + `<button class="mini" data-edel="${i}">✕</button></div>`).join('');
  const html = `<div class="overlay" id="ov"><div class="sheet">`
    + `<input class="inp" id="eTitle" placeholder="Rutinenavn (f.eks. Kveldssjekk)" value="${esc(e.title)}">`
    + `<div class="lab">Deloppgaver</div>${subRows}`
    + `<button class="btn ghost" id="eAddSub">＋ Deloppgave</button>`
    + `<div class="lab">Ukedager</div><div class="wdrow">${wdChips}</div>`
    + `<div class="lab">Valg</div><div class="chips">`
    + `<span class="chip ${e.sleeping ? 'on' : ''}" data-etgl="sleeping">💤 Sovende (vekk ved behov)</span>`
    + `<span class="chip ${e.leadDay ? 'on' : ''}" data-etgl="leadDay">🌙 Vis fra dagen før</span>`
    + `<span class="chip ${e.enabled ? 'on' : ''}" data-etgl="enabled">På</span></div>`
    + `<button class="btn" id="eSave">${e.id ? 'Lagre endringer' : 'Lagre rutine'}</button>`
    + `<button class="btn ghost" id="eCancel">Avbryt</button>`
    + (e.id ? `<button class="btn ghost" id="eDelete">Slett rutine</button>` : '')
    + `</div></div>`;
  const old = document.getElementById('ov'); if (old) old.remove();
  document.getElementById('app').insertAdjacentHTML('beforeend', html);
  bindRoutineEditor();
}

function bindRoutineEditor() {
  const o = document.getElementById('ov');
  const e = App.routineEdit;
  o.querySelector('#eTitle').oninput = (ev) => { e.title = ev.target.value; };
  o.querySelectorAll('[data-esub]').forEach((el) =>
    el.oninput = () => { e.subtasks[Number(el.dataset.esub)].text = el.value; });
  o.querySelectorAll('[data-edel]').forEach((el) =>
    el.onclick = () => { e.subtasks.splice(Number(el.dataset.edel), 1); renderRoutineEditor(); });
  o.querySelectorAll('[data-eup]').forEach((el) =>
    el.onclick = () => { const i = Number(el.dataset.eup); if (i > 0) { const a = e.subtasks; [a[i - 1], a[i]] = [a[i], a[i - 1]]; renderRoutineEditor(); } });
  o.querySelectorAll('[data-edown]').forEach((el) =>
    el.onclick = () => { const i = Number(el.dataset.edown); const a = e.subtasks; if (i < a.length - 1) { [a[i + 1], a[i]] = [a[i], a[i + 1]]; renderRoutineEditor(); } });
  o.querySelector('#eAddSub').onclick = () => { e.subtasks.push({ id: 't' + Date.now().toString(36), text: '' }); renderRoutineEditor(); };
  o.querySelectorAll('[data-ewd]').forEach((el) => el.onclick = () => {
    const k = el.dataset.ewd; e.weekdays = e.weekdays || [];
    e.weekdays = e.weekdays.includes(k) ? e.weekdays.filter((x) => x !== k) : e.weekdays.concat([k]);
    renderRoutineEditor();
  });
  o.querySelectorAll('[data-etgl]').forEach((el) => el.onclick = () => {
    const k = el.dataset.etgl; e[k] = !e[k]; renderRoutineEditor();
  });
  o.querySelector('#eCancel').onclick = () => { App.routineEdit = null; o.remove(); };
  o.querySelector('#eSave').onclick = saveRoutineEditor;
  const del = o.querySelector('#eDelete');
  if (del) del.onclick = () => {
    const id = e.id; App.routineEdit = null; o.remove();
    commit(L.deleteRoutine(App.state, { id }, ctx()));
  };
}

function saveRoutineEditor() {
  const e = App.routineEdit;
  if (!e.title.trim()) { App.routineEdit = null; closeSheet(); return; }
  const subtasks = (e.subtasks || []).filter((s) => s.text.trim()).map((s) => ({ id: s.id, text: s.text }));
  const payload = { title: e.title, subtasks, weekdays: e.weekdays || [], enabled: e.enabled, leadDay: e.leadDay, sleeping: e.sleeping };
  let next;
  if (e.id) next = L.updateRoutine(App.state, { id: e.id, patch: payload }, ctx());
  else next = L.addRoutine(App.state, { routine: payload }, ctx());
  next = syncRoutines(next);
  App.routineEdit = null;
  const o = document.getElementById('ov'); if (o) o.remove();
  commit(next);
}
```

- [ ] **Step 2: Verifiser struktur**

Run:
```bash
grep -nE "renderRoutineEditor|bindRoutineEditor|saveRoutineEditor|data-ewd|data-etgl" js/app.js | head
/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js
```
Expected: treff på editor-funksjonene; logikk-tester grønne.

- [ ] **Step 3: Commit**

```bash
git add js/app.js
git commit -m "feat(rutiner): mal-editor (ny/rediger/slett, ukedager, sovende, deloppgaver)"
```

---

### Task 7: Regresjon + sanity

**Files:** ingen (verifisering).

- [ ] **Step 1: Full testsuite grønn**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Expected: alle grønne (37 opprinnelige + de nye rutine-testene).

- [ ] **Step 2: Bekreft at item-visninger er urørt**

Run:
```bash
grep -nE "routineInstances" js/logic.js | grep -E "inboxItems|itemsForToday|categoryItems|categoryBadge"
```
Expected: ingen treff (rutine-instanser skal ALDRI lekke inn i item-visningene — de bor i eget array).

- [ ] **Step 3: Manuell røyktest (valgfritt, i nettleser)**

Åpne `index.html` lokalt: Hjem → 🔁 Rutiner → ＋ Ny rutine → gi navn + 2 deloppgaver + velg et par ukedager eller «Sovende» → Lagre. For sovende: Vekk → huk av deloppgaver → kortet viser «2 av 2 gjort» og ✅. Ingen badge på 🔁-flisa.

---

## Self-Review (utført ved skriving)

- **Spec-dekning:** Faste rutiner (ukedager) = Task 3 generate; sovende + Vekk = Task 3 wake; vis-fra-dagen-før = Task 3 leadDay; deloppgaver/kollaps/«X av N» = Task 4 + Task 5; pull/ingen badge = Task 5 (flis uten badge, egen flate); opprydding = Task 1/3 prune; redigering (rekkefølge/legg til/fjern/på-av/slett) = Task 6.
- **Placeholder-scan:** Ingen TBD; all kode og alle tester er konkrete. (Task 5 har én bevisst midlertidig stub for `openRoutineEditor` som erstattes i Task 6 — eksplisitt notert.)
- **Navnekonsistens:** `routineInstances` (toppnivå), `settings.routines` (maler), id-format `<routineId>:<dato>`, fn-navn `addRoutine/updateRoutine/deleteRoutine/generateRoutineInstances/wakeRoutine/routineInstancesForDate/pruneRoutineInstances/sleepingRoutines/toggleRoutineSubtask/skipRoutineInstance/allSubtasksDone/weekdayKey/addDaysIso` – brukt likt i logic, tester og app.
- **Scope/YAGNI:** Rekkefølge på deloppgaver via ↑/↓ (robust på touch) i stedet for full dra-og-slipp – notert som mulig senere finpuss. Ingen poeng/synk.
```
```
