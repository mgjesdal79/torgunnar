# Flyt – flerstegs-oppgaver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legg til en ny item-type «Flyt» – flerstegs-oppgaver der hvert steg eies av «meg» eller «ekstern», med en ball-indikator utledet av neste åpne steg, egen flis, og navigerings-rader i Gjøremål.

**Architecture:** Ren logikk i `js/logic.js` (testet med jsc), UI i `js/app.js` (mønster som rutiner + eksisterende lister). En `flow`-item får `steps: [{id,text,owner,done}]`. Ball = eier av første ukryssa steg. Auto-ferdig når siste steg hukes av. Flyt vises i egen flis og som checkbox-løse navigeringsrader nederst i Gjøremål.

**Tech Stack:** Vanilla JS (ES-moduler), PWA m/ service worker, jsc-testharness (`test/suite.js`), ingen build.

**Spec:** `docs/superpowers/specs/2026-11-27-flyt-flerstegs-oppgaver-design.md`

**Testkommando (hele veien):** `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`

---

## File Structure

- **Modify `js/logic.js`** – ny type `flow`; funksjoner `ballOwner`, `flowItems`, `doneFlowItems`, steg-CRUD (`addFlowStep`, `setFlowStepText`, `toggleFlowStep`, `setFlowStepOwner`, `removeFlowStep`, `reorderFlowSteps`); `classifyItem` + `migrate` håndterer `steps`.
- **Modify `test/suite.js`** – importér de nye funksjonene i både `import`-linja og `L`-objektet; legg til tester.
- **Modify `js/app.js`** – Flyt-flis, Flyt-visning (ekspanderbare kort + stegeditor), «Flyt» i EDIT_TYPES/CAPTURE_TYPES, navigeringsgruppe nederst i Gjøremål, hopp-til-flyt.
- **Modify `index.html` + `js/sw.js`** – versjonsbump (build39).

**Mønster-referanser i eksisterende kode (les før du starter):**
- `addItem` / `classifyItem` / `patchItem` i `js/logic.js` (linje ~63–100).
- Rutine-subtasks: `toggleRoutineSubtask`, `allSubtasksDone` i `js/logic.js` (~693–705).
- `someday`/`order`-backfill i `migrate` (~46–59).
- Flis: `tileHtml` + grid i `js/app.js` (~38–63).
- Konverteringsvalg: `EDIT_TYPES` / `CAPTURE_TYPES` (~344–352) og `saveEdit` (~455).
- Drag-sortering: `applyReorder`/`kind` (~329–345).

---

## Task 1: `flow`-type kan opprettes og klassifiseres

**Files:**
- Modify: `js/logic.js` (`addItem` steps-felt, `classifyItem`)
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende test**

I `test/suite.js`, legg til etter en eksisterende `t(...)`-blokk:

```js
t('addItem flow får tomt steps-array', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Søke om Memoplanner', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  const it = s.items[0];
  eq(it.type, 'flow');
  eq(it.steps, []);
});
t('classifyItem til flow gir tomt steps hvis det mangler', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Bytt dekk' }, { now: '2026-11-27T08:00:00Z', id: 'a1' });
  s = classifyItem(s, { id: 'a1', type: 'flow' }, { now: '2026-11-27T08:05:00Z', id: 'x' });
  eq(s.items[0].type, 'flow');
  eq(s.items[0].steps, []);
});
t('classifyItem bort fra flow nullstiller steps', () => {
  let s = defaultState();
  s = addItem(s, { text: 'X', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  s = classifyItem(s, { id: 'f1', type: 'task' }, { now: '2026-11-27T08:05:00Z', id: 'x' });
  eq(s.items[0].steps, null);
});
```

- [ ] **Step 2: Kjør testen og se den feile**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: FAIL (steps er `null`/`undefined`, ikke `[]`).

- [ ] **Step 3: Implementér minimalt**

I `js/logic.js`, `addItem`: legg til `steps: type === 'flow' ? [] : null,` i item-objektet (ved siden av `subtasks: null`).

I `classifyItem`, utvid funksjonen:

```js
export function classifyItem(state, { id, type }, ctx) {
  return patchItem(state, id, (it) => {
    it.type = type;
    if (type === 'note') { it.due = null; it.remindAt = null; it.done = false; it.doneAt = null; }
    if (type === 'flow') { if (!Array.isArray(it.steps)) it.steps = []; it.done = false; it.doneAt = null; }
    else { it.steps = null; }
  }, ctx);
}
```

- [ ] **Step 4: Kjør testene og se dem passere**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: PASS (alle grønne).

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(flow): flow-type med steps-array + classifyItem"
```

---

## Task 2: Steg-CRUD (legg til / rediger tekst / eier / slett)

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

```js
t('addFlowStep legger til steg med owner=meg som standard', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Flyt', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  s = addFlowStep(s, { id: 'f1', text: 'Ring fastlege' }, { now: '2026-11-27T08:01:00Z', id: 's1' });
  const st = s.items[0].steps[0];
  eq(st.text, 'Ring fastlege');
  eq(st.owner, 'meg');
  eq(st.done, false);
  eq(st.id, 's1');
});
t('setFlowStepText + setFlowStepOwner endrer et steg', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Flyt', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  s = addFlowStep(s, { id: 'f1', text: 'A' }, { now: '2026-11-27T08:01:00Z', id: 's1' });
  s = setFlowStepText(s, { id: 'f1', stepId: 's1', text: 'Vent på svar' }, { now: '2026-11-27T08:02:00Z', id: 'x' });
  s = setFlowStepOwner(s, { id: 'f1', stepId: 's1', owner: 'ekstern' }, { now: '2026-11-27T08:03:00Z', id: 'x' });
  eq(s.items[0].steps[0].text, 'Vent på svar');
  eq(s.items[0].steps[0].owner, 'ekstern');
});
t('removeFlowStep fjerner steget', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Flyt', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  s = addFlowStep(s, { id: 'f1', text: 'A' }, { now: '2026-11-27T08:01:00Z', id: 's1' });
  s = addFlowStep(s, { id: 'f1', text: 'B' }, { now: '2026-11-27T08:02:00Z', id: 's2' });
  s = removeFlowStep(s, { id: 'f1', stepId: 's1' }, { now: '2026-11-27T08:03:00Z', id: 'x' });
  eq(s.items[0].steps.length, 1);
  eq(s.items[0].steps[0].id, 's2');
});
```

- [ ] **Step 2: Kjør og se dem feile**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: FAIL («addFlowStep is not defined»). Husk å importere navnene i `test/suite.js` (import-linja + `L`-objektet) – ellers `ReferenceError`.

- [ ] **Step 3: Implementér**

I `js/logic.js` (etter `setItemText` e.l.):

```js
function flowStepsOf(it) { return Array.isArray(it.steps) ? it.steps : []; }

export function addFlowStep(state, { id, text }, ctx) {
  return patchItem(state, id, (it) => {
    if (!Array.isArray(it.steps)) it.steps = [];
    it.steps.push({ id: ctx.id, text: String(text || '').trim(), owner: 'meg', done: false });
  }, ctx);
}
export function setFlowStepText(state, { id, stepId, text }, ctx) {
  return patchItem(state, id, (it) => {
    const st = flowStepsOf(it).find((x) => x.id === stepId);
    if (st) st.text = String(text || '').trim();
  }, ctx);
}
export function setFlowStepOwner(state, { id, stepId, owner }, ctx) {
  return patchItem(state, id, (it) => {
    const st = flowStepsOf(it).find((x) => x.id === stepId);
    if (st) st.owner = owner === 'ekstern' ? 'ekstern' : 'meg';
  }, ctx);
}
export function removeFlowStep(state, { id, stepId }, ctx) {
  return patchItem(state, id, (it) => {
    it.steps = flowStepsOf(it).filter((x) => x.id !== stepId);
  }, ctx);
}
```

- [ ] **Step 4: Kjør og se dem passere**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(flow): steg-CRUD (add/text/owner/remove)"
```

---

## Task 3: `ballOwner` + avkryssing + auto-ferdig + manuell avslutt

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

```js
t('ballOwner er eier av første ukryssa steg', () => {
  const flow = { type: 'flow', steps: [
    { id: 's1', owner: 'meg', done: true },
    { id: 's2', owner: 'ekstern', done: false },
    { id: 's3', owner: 'meg', done: false },
  ] };
  eq(ballOwner(flow), 'ekstern');
});
t('ballOwner er meg når ingen åpne steg', () => {
  eq(ballOwner({ type: 'flow', steps: [{ id: 's1', owner: 'ekstern', done: true }] }), 'meg');
  eq(ballOwner({ type: 'flow', steps: [] }), 'meg');
});
t('toggleFlowStep auto-ferdig når siste steg hukes av', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Flyt', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  s = addFlowStep(s, { id: 'f1', text: 'A' }, { now: '2026-11-27T08:01:00Z', id: 's1' });
  s = toggleFlowStep(s, { id: 'f1', stepId: 's1' }, { now: '2026-11-27T09:00:00Z', id: 'x' });
  eq(s.items[0].steps[0].done, true);
  eq(s.items[0].done, true);
  eq(s.items[0].doneAt, '2026-11-27T09:00:00Z');
});
t('toggleFlowStep av igjen gjenåpner flyten', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Flyt', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  s = addFlowStep(s, { id: 'f1', text: 'A' }, { now: '2026-11-27T08:01:00Z', id: 's1' });
  s = toggleFlowStep(s, { id: 'f1', stepId: 's1' }, { now: '2026-11-27T09:00:00Z', id: 'x' });
  s = toggleFlowStep(s, { id: 'f1', stepId: 's1' }, { now: '2026-11-27T09:05:00Z', id: 'x' });
  eq(s.items[0].steps[0].done, false);
  eq(s.items[0].done, false);
  eq(s.items[0].doneAt, null);
});
t('finishFlow avslutter tidlig selv med åpne steg', () => {
  let s = defaultState();
  s = addItem(s, { text: 'Flyt', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  s = addFlowStep(s, { id: 'f1', text: 'A' }, { now: '2026-11-27T08:01:00Z', id: 's1' });
  s = finishFlow(s, { id: 'f1' }, { now: '2026-11-27T10:00:00Z', id: 'x' });
  eq(s.items[0].done, true);
  eq(s.items[0].doneAt, '2026-11-27T10:00:00Z');
});
```

- [ ] **Step 2: Kjør og se dem feile**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: FAIL (udefinerte funksjoner).

- [ ] **Step 3: Implementér**

```js
export function ballOwner(flow) {
  const open = flowStepsOf(flow).find((s) => !s.done);
  return open ? (open.owner === 'ekstern' ? 'ekstern' : 'meg') : 'meg';
}
function allFlowStepsDone(it) {
  const steps = flowStepsOf(it);
  return steps.length > 0 && steps.every((s) => s.done);
}
export function toggleFlowStep(state, { id, stepId }, ctx) {
  return patchItem(state, id, (it) => {
    const st = flowStepsOf(it).find((x) => x.id === stepId);
    if (!st) return;
    st.done = !st.done;
    it.done = allFlowStepsDone(it);
    it.doneAt = it.done ? ctx.now : null;
  }, ctx);
}
export function finishFlow(state, { id }, ctx) {
  return patchItem(state, id, (it) => { it.done = true; it.doneAt = ctx.now; }, ctx);
}
```

- [ ] **Step 4: Kjør og se dem passere**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(flow): ballOwner + auto-ferdig + finishFlow"
```

---

## Task 4: Seleksjon og sortering (`flowItems`, `doneFlowItems`) + reorder + migrate

**Files:**
- Modify: `js/logic.js`
- Test: `test/suite.js`

- [ ] **Step 1: Skriv feilende tester**

```js
t('flowItems: din tur øverst, venter-på-andre under, kun aktive', () => {
  let s = defaultState();
  // A: venter på ekstern
  s = addItem(s, { text: 'A', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'A' });
  s = addFlowStep(s, { id: 'A', text: 'a1' }, { now: '2026-11-27T08:00:01Z', id: 'as1' });
  s = setFlowStepOwner(s, { id: 'A', stepId: 'as1', owner: 'ekstern' }, { now: '2026-11-27T08:00:02Z', id: 'x' });
  // B: din tur
  s = addItem(s, { text: 'B', type: 'flow' }, { now: '2026-11-27T08:00:03Z', id: 'B' });
  s = addFlowStep(s, { id: 'B', text: 'b1' }, { now: '2026-11-27T08:00:04Z', id: 'bs1' });
  // C: ferdig (skal utelates fra flowItems)
  s = addItem(s, { text: 'C', type: 'flow' }, { now: '2026-11-27T08:00:05Z', id: 'C' });
  s = finishFlow(s, { id: 'C' }, { now: '2026-11-27T08:00:06Z', id: 'x' });
  const ids = flowItems(s).map((i) => i.id);
  eq(ids, ['B', 'A']);
  eq(doneFlowItems(s).map((i) => i.id), ['C']);
});
t('reorderFlowSteps endrer rekkefølgen', () => {
  let s = defaultState();
  s = addItem(s, { text: 'F', type: 'flow' }, { now: '2026-11-27T08:00:00Z', id: 'f1' });
  s = addFlowStep(s, { id: 'f1', text: 'A' }, { now: '2026-11-27T08:00:01Z', id: 's1' });
  s = addFlowStep(s, { id: 'f1', text: 'B' }, { now: '2026-11-27T08:00:02Z', id: 's2' });
  s = reorderFlowSteps(s, { id: 'f1', orderedIds: ['s2', 's1'] }, { now: '2026-11-27T08:00:03Z', id: 'x' });
  eq(s.items[0].steps.map((x) => x.id), ['s2', 's1']);
});
t('migrate backfiller steps=[] på gamle flow-items uten feltet', () => {
  const s = migrate({ items: [{ id: 'f', type: 'flow', text: 'gammel' }] }, '2026-11-27');
  eq(s.items[0].steps, []);
});
```

- [ ] **Step 2: Kjør og se dem feile**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: FAIL.

- [ ] **Step 3: Implementér**

I `js/logic.js`:

```js
export function flowItems(state) {
  const list = activeItems(state).filter((i) => i.type === 'flow' && !i.done);
  const rank = (i) => (ballOwner(i) === 'meg' ? 0 : 1);
  return list.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
}
export function doneFlowItems(state) {
  return activeItems(state).filter((i) => i.type === 'flow' && i.done)
    .sort((a, b) => (b.doneAt || '').localeCompare(a.doneAt || ''));
}
export function reorderFlowSteps(state, { id, orderedIds }, ctx) {
  return patchItem(state, id, (it) => {
    const byId = {};
    flowStepsOf(it).forEach((s) => { byId[s.id] = s; });
    it.steps = orderedIds.map((sid) => byId[sid]).filter(Boolean);
  }, ctx);
}
```

I `migrate` (etter de andre backfill-blokkene, før `return out;`):

```js
  out.items.forEach((i) => {
    if (i.type === 'flow' && !Array.isArray(i.steps)) i.steps = [];
  });
```

- [ ] **Step 4: Kjør og se dem passere**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/logic.js test/suite.js
git commit -m "feat(flow): flowItems/doneFlowItems-seleksjon, reorder, migrate-backfill"
```

---

## Task 5: Flyt-flis + «Flyt» som konverteringsvalg

**Files:**
- Modify: `js/app.js` (import `L`, `tilesHtml`, `EDIT_TYPES`, `CAPTURE_TYPES`, `openEdit`, `saveEdit`)

> UI-oppgave – ikke dekket av jsc-tester. Følg eksisterende mønstre nøye. Verifiser manuelt i nettleser til slutt (Task 7).

- [ ] **Step 1: Importér nye logikk-funksjoner i app.js**

Øverst i `js/app.js`, i `import { ... } from './logic.js'` (eller der `L`-objektet bygges – følg filens eksisterende mønster for hvordan `L` eksponeres), legg til:
`flowItems, doneFlowItems, ballOwner, addFlowStep, setFlowStepText, setFlowStepOwner, removeFlowStep, toggleFlowStep, finishFlow, reorderFlowSteps`.

- [ ] **Step 2: Legg til Flyt-flis**

I funksjonen som bygger `tiles` (rundt linje 55), legg til en flis etter Langsiktig:

```js
    + tileHtml('🔀', 'Flyt', L.flowItems(App.state).length || null, 'data-view="flow"')
```

(Diskré tall, ikke badge – samme form som `mediumN`/`Langsiktig`. `null` skjuler tallet når tomt.)

- [ ] **Step 3: Legg «Flyt» til konverteringsvalgene**

I `EDIT_TYPES` (ca. linje 345) legg til:

```js
  { id: 'flow', label: '🔀 Flyt' },
```

`CAPTURE_TYPES` arver fra `EDIT_TYPES`, så den får det automatisk.

- [ ] **Step 4: Sørg for at konvertering til flow lagrer riktig**

I `openEdit` (ca. linje 426): utvid listen av godkjente typer så `flow` beholdes:
```js
  const type = ['task', 'job', 'someday', 'note', 'flow'].includes(it.type) ? it.type : 'task';
```
I `submitCapture` (ca. linje 416) og `saveEdit` (ca. linje 455): `classifyItem`/`addItem` håndterer allerede `flow` via Task 1. Legg `flow: 'flow'` i view-mappingen i `submitCapture` slik at man havner på Flyt-visningen etter konvertering:
```js
  if (!stay) App.view = { task: 'tasks', job: 'job', someday: 'medium', note: 'notes', flow: 'flow' }[choice] || 'tasks';
```

- [ ] **Step 5: Verifiser at jsc fortsatt er grønt (ingen logikk rørt)**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: PASS (uendret).

- [ ] **Step 6: Commit**

```bash
git add js/app.js
git commit -m "feat(flow): Flyt-flis + Flyt som konverteringsvalg"
```

---

## Task 6: Flyt-visning (ekspanderbare kort + stegeditor) + navigeringsrader i Gjøremål

**Files:**
- Modify: `js/app.js` (ny `flowView()`, view-routing, event-binding, Gjøremål-render)

> UI-oppgave. Modellér `flowView` på rutine-redigeringen (ekspander, subtask-liste, drag-handle) og listene (`taskItems`-render). Hold flyktig UI-state (hvilken flyt er åpen, inline nytt-steg-tekst) i `App`, slik `App.rOpen`/`App.routineEdit` gjøres.

- [ ] **Step 1: Legg til flyktig UI-state**

I `App`-objektet (ca. linje 6): legg til `flowOpen: {}` (map flowId→bool, hvilke kort er ekspandert) og `flowFocus: null` (flyt vi skal hoppe til + åpne fra Gjøremål).

- [ ] **Step 2: Skriv `flowView()`**

Ny funksjon som rendrer Flyt-visningen. Bruk `headerBar('🔀 Flyt')` + `captureBlock({ fixedType: 'flow', placeholder: 'Ny flyt…' })` øverst (gjenbruker fange-feltet; `fixedType` låser typen – se `captureBlock` ca. linje 384). Deretter:

- For hver flyt i `L.flowItems(App.state)`: et kort med
  - tittel + ball-merke: `ballOwner(flow)==='meg'` → `<span class="ball meg">din tur</span>` (varm), ellers `<span class="ball ekstern">venter på andre</span>` (dempet).
  - kollapset undertekst = første ukryssa steg sin tekst (eller «Ingen steg ennå»).
  - klikk på tittel → toggle `App.flowOpen[flow.id]` og `render()` (samme mønster som Forbedring-ekspander, build29, og `App.rOpen`).
  - når ekspandert: liste av steg. Hvert steg =
    - avkryssingsboks (`.chk`, data-attr `data-flowstep="<flowId>:<stepId>"`) → `L.toggleFlowStep`.
    - steg-tekst (inline redigerbar via et `data-flowtext`-input eller en liten rediger-knapp som setter en edit-state; enkleste variant: `contenteditable`/liten input som på `setFlowStepText` ved blur).
    - eier-toggle: to chips «🙋 Meg» / «📨 Ekstern» (`data-flowowner="<flowId>:<stepId>:<owner>"`) → `L.setFlowStepOwner`.
    - slett-knapp (`data-flowstepdel="<flowId>:<stepId>"`) → `L.removeFlowStep`.
    - drag-handle `<span class="draghandle" data-draghandle="<stepId>">⠿</span>` i en liste-container merket for reorder (se Step 4).
  - «+ Nytt steg»-rad: liten input (`data-flowaddstep="<flowId>"`) → `L.addFlowStep` på Enter/knapp.
  - «Avslutt flyt»-knapp (`data-flowfinish="<flowId>"`) → `L.finishFlow` (med confirm).
- Ferdige flyter: en kollapset «Fullført»-seksjon nederst fra `L.doneFlowItems(App.state)` (valgfritt gjenåpne ved å huke av et steg av).

Returnér streng-HTML som de andre view-funksjonene.

- [ ] **Step 3: Rut `flow`-viewet**

Der `App.view` velger hvilken render-funksjon som kalles (søk etter `view === 'routines'`/`'medium'` i render-switchen, ca. linje 78–95), legg til en gren: `if (v === 'flow') body = flowView();`. Hvis `App.flowFocus` er satt, sett `App.flowOpen[App.flowFocus] = true` og nullstill `App.flowFocus` før render, så flyten åpnes ekspandert ved hopp fra Gjøremål.

- [ ] **Step 4: Bind events + drag for steg**

I event-bindingsblokka (der `data-view`/`data-routinesub` bindes, ca. linje 95–205) legg til håndtering for: `data-flowstep`, `data-flowowner`, `data-flowstepdel`, `data-flowaddstep`, `data-flowfinish`, `data-flowadd` (ny flyt via captureBlock bruker eksisterende `submitCapture`), og tittel-klikk for ekspander. Hver kaller tilsvarende `L.*` via `commit(...)`/`ctx()` (se hvordan `toggleRoutineSubtask` bindes ca. linje 201).

For drag-sortering av steg: i `applyReorder` (ca. linje 329) legg til en ny `kind === 'flowsteps'`-gren som kaller `commit(L.reorderFlowSteps(App.state, { id: flowId, orderedIds }, ctx()))`. Marker steg-lista med samme data-attr-mønster som rutine-editoren (`kind` + liste-container), slik at den eksisterende pointer-drag-koden plukker den opp.

- [ ] **Step 5: Flyt som navigeringsrader nederst i Gjøremål**

I Gjøremål-visningen (`tasksView`/der `taskItems` rendres, header `✅ Gjøremål` ca. linje 568): etter den vanlige (checkbox-)lista, hvis `L.flowItems(App.state).length`, legg til en diskré gruppe:

```js
  + `<h3 class="flowgroup">🔀 Flyt</h3>`
  + L.flowItems(App.state).map((f) => {
      const b = L.ballOwner(f) === 'meg' ? '<span class="ball meg">din tur</span>'
                                         : '<span class="ball ekstern">venter</span>';
      return `<div class="row flownav" data-flownav="${f.id}"><span class="t">${esc(f.text)}</span>${b}</div>`;
    }).join('')
```

Disse radene har **ingen checkbox**. Bind `data-flownav`: ved klikk sett `App.flowFocus = id; App.view = 'flow'; render();` (hopper inn og åpner flyten – jf. Step 3).

- [ ] **Step 6: Litt CSS**

I `styles.css` (eller der komponent-CSS bor): legg til `.ball.meg` (varm, f.eks. gul/grønn bakgrunn) og `.ball.ekstern` (dempet grå), `.row.flownav` (navigerings-utseende, cursor pointer, ingen checkbox-layout), `.flowgroup`/`.flowcard` enkel ramme. Hold det rolig/diskret i Tor Gunnar-ånd (ingen badges).

- [ ] **Step 7: Verifiser jsc grønt**

Run: `/System/Library/Frameworks/JavaScriptCore.framework/Versions/A/Helpers/jsc -m test/run-jsc.js`
Forventet: PASS.

- [ ] **Step 8: Commit**

```bash
git add js/app.js styles.css
git commit -m "feat(flow): Flyt-visning m/ stegeditor + navigeringsrader i Gjøremål"
```

---

## Task 7: Manuell røyktest i nettleser

**Files:** ingen (verifikasjon)

- [ ] **Step 1:** Åpne appen lokalt (eller på en test-deploy), lås opp med romkoden.
- [ ] **Step 2:** Fang en tanke «Søke om Memoplanner» → velg type 🔀 Flyt. Bekreft at den havner i Flyt-visningen.
- [ ] **Step 3:** Legg til steg: «Ring fastlege» (meg), «Vent på svar» (ekstern), «Lever søknad» (meg). Bekreft at ball viser «din tur».
- [ ] **Step 4:** Huk av «Ring fastlege». Ball skal bli «venter på andre». Sorteringen (din tur øverst) skal stemme hvis du har flere flyter.
- [ ] **Step 5:** Sjekk Gjøremål: flyten vises nederst under «🔀 Flyt» uten checkbox; klikk → hopper inn og åpner flyten.
- [ ] **Step 6:** Dra-sortér steg, rediger tekst, bytt eier, slett et steg, og «Avslutt flyt». Bekreft at ferdig flyt forsvinner fra aktiv liste.
- [ ] **Step 7:** Reload (PWA) og bekreft at state overlever (localStorage + synk).

---

## Task 8: Versjonsbump + deploy (build39)

**Files:**
- Modify: `index.html` (`APP_VERSION`, `APP_BUILD`), `js/sw.js` (`VERSION`)

- [ ] **Step 1:** Les gjeldende build fra `origin/main` (ikke disk):
```bash
git fetch origin -q
git show origin/main:js/sw.js | grep -i "VERSION ="
git show origin/main:index.html | grep -iE "APP_VERSION|APP_BUILD"
```
Forventet: build38. Nytt nummer = **build39**.

- [ ] **Step 2:** Bump `window.APP_VERSION` til `'build39'`, `window.APP_BUILD` til dagens dato i `index.html`, og `VERSION` i `js/sw.js` til `'build39'`.

- [ ] **Step 3:** Commit:
```bash
git add index.html js/sw.js
git commit -m "chore(build39): Flyt – flerstegs-oppgaver"
```

- [ ] **Step 4:** Push branch + PR + squash-merge (dcg blokkerer push til main):
```bash
git push -u origin spec/flyt-flerstegs-oppgaver
gh pr create --base main --title "feat(build39): Flyt – flerstegs-oppgaver" --body "..."
gh pr merge <nr> --squash
```

- [ ] **Step 5:** Bekreft at merge landet:
```bash
git fetch origin -q && git log origin/main --oneline -1
```
Forventet: build39-commit på origin/main. GitHub Pages bygger derfra (~1 min).

---

## Self-Review (utført ved skriving)

- **Spec-dekning:** §1 datamodell → Task 1/2/4; ball → Task 3; §2 flis+kort+sortering → Task 5/6; §3 Gjøremål-totalen → Task 6 Step 5; §4 fullføring (auto + avslutt) → Task 3; §6 test → Task 1–4; §7 deploy → Task 8. §5 (nudge, Bunke B) bevisst utelatt.
- **Placeholder-skann:** UI-tasks (5–6) beskriver konkrete data-attr + funksjonskall, men viser ikke hver HTML-linje (app.js-mønster er for vevd til 1:1-kode uten å ha hele filen i kontekst) – de er forankret i navngitte eksisterende mønstre og linjer. Logikk-tasks har full TDD-kode.
- **Typekonsistens:** `owner` er alltid `'meg'|'ekstern'`; steg-objekt `{id,text,owner,done}` likt overalt; funksjonsnavn (`toggleFlowStep`, `finishFlow`, `flowItems`, `ballOwner`, `reorderFlowSteps`) brukt konsistent i logikk, app og tester.
