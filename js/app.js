import * as L from './logic.js';
import { loadState, saveStateDebounced, startPolling, nowIso, todayIso, newId,
         hasCode, setCode, clearCode } from './store.js';

const App = {
  view: 'home', catId: null, state: null, rOpen: {}, routineEdit: null,
  cap: { text: '', type: 'task', insistence: 'chill', cadenceDays: 7 },
  capFixed: null, capStay: false,
  edit: null,
  timeEdit: null,
  imp: { text: '', body: '', depth: '', category: '' }, impEdit: null,
  impAddOpen: false, impOpen: {}, impDepth: {},
  rowOpen: {},
  doneRtnOpen: false,
  konaTrashOpen: false,
};

function ctx() { return { now: nowIso(), id: newId() }; }
function commit(next) { App.state = next; saveStateDebounced(App.state); render(); }

function syncRoutines(s) {
  // Ingen auto-generering lenger: alle rutiner starter inaktive hver dag og
  // aktiveres manuelt. Vi rydder bare bort gårsdagens instanser (daglig reset).
  return L.pruneRoutineInstances(s, todayIso());
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function quoteHtml() {
  const q = L.currentQuote(App.state, todayIso());
  return `<div class="quote" data-rotate="1" title="Trykk for en ny ro">`
    + `🌿 <span class="qt">${esc(q)}</span> <span class="qrot">🔄</span></div>`;
}

function tileHtml(icon, label, badge, data, sub) {
  const b = badge && badge.count
    ? `<span class="badge ${badge.level}">${badge.count}</span>` : '';
  const s = sub ? `<span class="subcount">${esc(sub)}</span>` : '';
  return `<div class="tile" ${data}>${b}<span class="ic">${icon}</span>`
    + `<span class="lb">${esc(label)}</span>${s}</div>`;
}

function renderHome() {
  const now = nowIso();
  const todayItems = L.itemsForToday(App.state, now);
  const taskN = L.taskItems(App.state, now).length;
  const jobN = L.jobItems(App.state, now).length;
  const mediumN = L.mediumBadge(App.state, now);
  const konaN = L.konaBadge(App.state);
  const trashN = L.trashItems(App.state).length;
  // Innboks-tilen er skjult med vilje (forfalte dult lyser nå fra Langsiktig).
  const tiles = tileHtml('✅', 'Gjøremål', { count: taskN, level: taskN ? 'open' : 'calm' }, 'data-view="tasks"')
    + tileHtml('💼', 'Jobb', { count: jobN, level: jobN ? 'open' : 'calm' }, 'data-view="job"')
    + tileHtml('💛', 'Langsiktig', mediumN, 'data-view="medium"')
    + tileHtml('📝', 'Notater', L.noteBadge(App.state), 'data-view="notes"')
    + tileHtml('🌱', 'Forbedring', null, 'data-view="improvements"')
    + tileHtml('💬', 'Ingrid', konaN, 'data-view="kona"')
    + tileHtml('🔁', 'Rutiner', null, 'data-view="routines"')
    + tileHtml('⚙️', 'Innstillinger', null, 'data-view="settings"')
    + tileHtml('🗑', 'Søppelkasse', null, 'data-view="trash"', trashN ? String(trashN) : '');
  const todaySection = `<h2 class="todayhead" data-view="today">📌 I dag</h2>`
    + (todayItems.length
        ? listCard(todayItems)
        : `<p class="sub">Ingenting krever deg akkurat nå 🌱</p>`);
  return `<div class="banner"><div class="b">🦸‍♂️ Tor Gunnar</div>`
    + quoteHtml() + `</div>`
    + `<div class="body">`
    + captureBlock({})
    + todaySection
    + `<div class="grid">${tiles}</div></div>`;
}

function render() {
  const root = document.getElementById('app');
  const v = App.view;
  if (v === 'inbox') root.innerHTML = renderInbox();
  else if (v === 'today') root.innerHTML = renderToday();
  else if (v === 'tasks') root.innerHTML = renderTasks();
  else if (v === 'job') root.innerHTML = renderJob();
  else if (v === 'medium') root.innerHTML = renderMedium();
  else if (v === 'notes') root.innerHTML = renderNotes();
  else if (v === 'improvements') root.innerHTML = renderImprovements();
  else if (v === 'kona') root.innerHTML = renderKona();
  else if (v === 'routines') root.innerHTML = renderRoutines();
  else if (v === 'settings') root.innerHTML = renderSettings();
  else if (v === 'trash') root.innerHTML = renderTrash();
  else root.innerHTML = renderHome();
  bind(root);
}

function bind(root) {
  root.querySelectorAll('[data-view]').forEach((el) =>
    el.onclick = () => {
      App.view = el.dataset.view;
      if (App.view === 'routines') { App.state = syncRoutines(App.state); saveStateDebounced(App.state); }
      render();
    });
  const capInput = root.querySelector('#capInput');
  if (capInput) capInput.oninput = () => { App.cap.text = capInput.value; };
  const capAdd = root.querySelector('#capAddBtn');
  if (capAdd) capAdd.onclick = submitCapture;
  root.querySelectorAll('[data-captype]').forEach((el) =>
    el.onclick = () => { App.cap.type = el.dataset.captype; render(); });
  root.querySelectorAll('[data-capinsist]').forEach((el) =>
    el.onclick = () => { App.cap.insistence = el.dataset.capinsist; render(); });
  root.querySelectorAll('[data-capcad]').forEach((el) =>
    el.onclick = () => { App.cap.cadenceDays = Number(el.dataset.capcad); render(); });
  const editInput = root.querySelector('#editInput');
  if (editInput) editInput.oninput = () => { App.edit.text = editInput.value; };
  root.querySelectorAll('[data-edittype]').forEach((el) =>
    el.onclick = () => { App.edit.type = el.dataset.edittype; render(); });
  root.querySelectorAll('[data-editinsist]').forEach((el) =>
    el.onclick = () => { App.edit.insistence = el.dataset.editinsist; render(); });
  root.querySelectorAll('[data-editcad]').forEach((el) =>
    el.onclick = () => { App.edit.cadenceDays = Number(el.dataset.editcad); render(); });
  const eSave = root.querySelector('#editSave');
  if (eSave) eSave.onclick = saveEdit;
  const eCancel = root.querySelector('#editCancel');
  if (eCancel) eCancel.onclick = () => { App.edit = null; render(); };
  const eDel = root.querySelector('#editDelete');
  if (eDel) eDel.onclick = deleteFromEdit;
  root.querySelectorAll('[data-home]').forEach((el) =>
    el.onclick = () => { App.view = 'home'; App.catId = null; render(); });
  root.querySelectorAll('[data-rotate]').forEach((el) =>
    el.onclick = () => commit(L.rotateQuote(App.state, { dayKey: todayIso() }, ctx())));
  root.querySelectorAll('[data-done]').forEach((el) =>
    el.onclick = () => doComplete(el.dataset.done, el));
  root.querySelectorAll('[data-defer]').forEach((el) =>
    el.onclick = () => openDefer(el.dataset.defer));
  root.querySelectorAll('[data-undefer]').forEach((el) =>
    el.onclick = () => commit(L.undeferItem(App.state, { id: el.dataset.undefer }, ctx())));
  root.querySelectorAll('[data-reopen]').forEach((el) =>
    el.onclick = () => commit(L.reopenItem(App.state, { id: el.dataset.reopen }, ctx())));
  root.querySelectorAll('[data-trashdone]').forEach((el) =>
    el.onclick = () => {
      const ids = el.dataset.trashdone.split(',').filter(Boolean);
      commit(L.trashAllDone(App.state, { ids }, ctx()));
    });
  root.querySelectorAll('[data-restore]').forEach((el) =>
    el.onclick = () => commit(L.restoreItem(App.state, { id: el.dataset.restore }, ctx())));
  root.querySelectorAll('[data-purge]').forEach((el) =>
    el.onclick = () => {
      if (confirm('Slette denne for godt? Dette kan ikke angres.')) {
        commit(L.purgeItem(App.state, { id: el.dataset.purge }, ctx()));
      }
    });
  const purgeAll = root.querySelector('[data-purgeall]');
  if (purgeAll) purgeAll.onclick = () => {
    const n = L.trashItems(App.state).length;
    if (confirm('Tømme hele søppelkassa (' + n + ')? Dette kan ikke angres.')) {
      commit(L.purgeAllTrash(App.state, ctx()));
    }
  };
  root.querySelectorAll('[data-edit]').forEach((el) =>
    el.onclick = () => openEdit(el.dataset.edit));
  root.querySelectorAll('[data-notebadge]').forEach((el) =>
    el.onclick = () => commit(L.toggleNoteBadge(App.state, { id: el.dataset.notebadge }, ctx())));
  // --- Forbedring (🌱) ---
  const impTitle = root.querySelector('#impTitle');
  if (impTitle) impTitle.oninput = () => { App.imp.text = impTitle.value; };
  const impBody = root.querySelector('#impBody');
  if (impBody) impBody.oninput = () => { App.imp.body = impBody.value; };
  const impDepth = root.querySelector('#impDepth');
  if (impDepth) impDepth.oninput = () => { App.imp.depth = impDepth.value; };
  const impCat = root.querySelector('#impCat');
  if (impCat) impCat.oninput = () => { App.imp.category = impCat.value; };
  const impAdd = root.querySelector('#impAddBtn');
  if (impAdd) impAdd.onclick = submitImprovement;
  const impAddToggle = root.querySelector('[data-impaddtoggle]');
  if (impAddToggle) impAddToggle.onclick = () => { App.impAddOpen = !App.impAddOpen; render(); };
  root.querySelectorAll('[data-impedit]').forEach((el) =>
    el.onclick = () => openImprovementEdit(el.dataset.impedit));
  root.querySelectorAll('[data-impexpand]').forEach((el) =>
    el.onclick = () => { const id = el.dataset.impexpand; App.impOpen[id] = !App.impOpen[id]; render(); });
  root.querySelectorAll('[data-impdepth]').forEach((el) =>
    el.onclick = () => { const id = el.dataset.impdepth; App.impDepth[id] = !App.impDepth[id]; render(); });
  const ieTitle = root.querySelector('#impEditTitle');
  if (ieTitle) ieTitle.oninput = () => { App.impEdit.text = ieTitle.value; };
  const ieBody = root.querySelector('#impEditBody');
  if (ieBody) ieBody.oninput = () => { App.impEdit.body = ieBody.value; };
  const ieDepth = root.querySelector('#impEditDepth');
  if (ieDepth) ieDepth.oninput = () => { App.impEdit.depth = ieDepth.value; };
  const ieCat = root.querySelector('#impEditCat');
  if (ieCat) ieCat.oninput = () => { App.impEdit.category = ieCat.value; };
  const ieSave = root.querySelector('#impEditSave');
  if (ieSave) ieSave.onclick = saveImprovementEdit;
  const ieCancel = root.querySelector('#impEditCancel');
  if (ieCancel) ieCancel.onclick = () => { App.impEdit = null; render(); };
  const ieDel = root.querySelector('#impEditDelete');
  if (ieDel) ieDel.onclick = deleteImprovementFromEdit;
  root.querySelectorAll('[data-rtoggle]').forEach((el) =>
    el.onclick = () => { const id = el.dataset.rtoggle; App.rOpen[id] = !App.rOpen[id]; render(); });
  root.querySelectorAll('[data-donertntoggle]').forEach((el) =>
    el.onclick = () => { App.doneRtnOpen = !App.doneRtnOpen; render(); });
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
  root.querySelectorAll('[data-promote]').forEach((el) =>
    el.onclick = () => commit(L.promoteToToday(App.state, { id: el.dataset.promote }, ctx())));
  root.querySelectorAll('[data-msnooze]').forEach((el) =>
    el.onclick = () => commit(L.snoozeNudge(App.state, { id: el.dataset.msnooze }, ctx())));
  root.querySelectorAll('[data-kdismiss]').forEach((el) =>
    el.onclick = () => commit(L.deleteItem(App.state, { id: el.dataset.kdismiss }, ctx())));
  root.querySelectorAll('[data-konatrashtoggle]').forEach((el) =>
    el.onclick = () => { App.konaTrashOpen = !App.konaTrashOpen; render(); });
  root.querySelectorAll('[data-krestore]').forEach((el) =>
    el.onclick = () => commit(L.restoreItem(App.state, { id: el.dataset.krestore }, ctx())));
  root.querySelectorAll('[data-kpurge]').forEach((el) =>
    el.onclick = () => { if (confirm('Slette denne lappen for godt?')) commit(L.purgeItem(App.state, { id: el.dataset.kpurge }, ctx())); });
  root.querySelectorAll('[data-kpurgeall]').forEach((el) =>
    el.onclick = () => {
      const n = L.konaTrashItems(App.state).length;
      if (confirm('Slette alle ' + n + ' lappene i Slettet for godt? Dette kan ikke angres.')) commit(L.purgeAllKonaTrash(App.state, ctx()));
    });
  root.querySelectorAll('[data-settime]').forEach((el) =>
    el.onclick = () => openTime(el.dataset.settime));
  root.querySelectorAll('[data-tstep]').forEach((el) =>
    el.onclick = () => { const [u, a] = el.dataset.tstep.split('|'); adjustTime(u, Number(a)); });
  root.querySelectorAll('[data-tquick]').forEach((el) =>
    el.onclick = () => quickTime(el.dataset.tquick));
  const tSave = root.querySelector('[data-tsave]');
  if (tSave) tSave.onclick = saveTime;
  const tCancel = root.querySelector('[data-tcancel]');
  if (tCancel) tCancel.onclick = () => { App.timeEdit = null; render(); };
  root.querySelectorAll('[data-ios]').forEach((el) =>
    el.onclick = () => pushToIos(el.dataset.ios));
  root.querySelectorAll('[data-rowexp]').forEach((el) =>
    el.onclick = () => {
      const id = el.dataset.rowexp;
      App.rowOpen[id] = !App.rowOpen[id];
      if (!App.rowOpen[id] && isTimeEditing(id)) App.timeEdit = null;
      render();
    });
  bindDrag(root);
  const ssSave = root.querySelector('#setShortcutSave');
  if (ssSave) ssSave.onclick = () => {
    const v = root.querySelector('#setShortcut').value;
    commit(L.setShortcutName(App.state, { name: v }, ctx()));
  };
  const qSave = root.querySelector('#setQuotesSave');
  if (qSave) qSave.onclick = () => {
    const v = root.querySelector('#setQuotes').value;
    commit(L.setQuotes(App.state, { text: v }, ctx()));
  };
  const qReset = root.querySelector('#setQuotesReset');
  if (qReset) qReset.onclick = () => commit(L.setQuotes(App.state, { text: '' }, ctx()));
  const lk = root.querySelector('#setLock');
  if (lk) lk.onclick = lockApp;
  const konaAdd = root.querySelector('#konaAdd');
  if (konaAdd) {
    const inp = root.querySelector('#konaText');
    const add = () => {
      const text = (inp.value || '').trim();
      if (!text) return;
      commit(L.addItem(App.state, { text, source: 'kona' }, ctx()));
    };
    konaAdd.onclick = add;
    inp.onkeydown = (ev) => { if (ev.key === 'Enter') add(); };
  }
}

// --- Dra-og-slipp (generisk) ------------------------------------------------
// Pointer-basert (fungerer på touch der native HTML5-drag er upålitelig). Vi
// flytter raden i DOM-en live mens man drar, og skriver ny rekkefølge først ved
// slipp. Lista merkes med [data-droplist]="<kind>"; hver rad med [data-row-id].
// «kind» avgjør hva slippet gjør (items → L.reorderItems; subtasks → lokal
// rutine-editor-state). Legg til flere kinds i onDrop ved behov.
// Dokument-baserte lyttere (ikke bare setPointerCapture på håndtaket): på touch
// er håndtaket for lite til å holde peker-fokus, og captured pointermove er
// upålitelig på iOS. Vi lytter på hele document mens en drag pågår.
let drag = null;
function bindDrag(root) {
  root.querySelectorAll('[data-draghandle]').forEach((handle) => {
    handle.onpointerdown = (ev) => startDrag(ev, handle);
  });
}
function startDrag(ev, handle) {
  const row = handle.closest('[data-row-id]');
  const list = handle.closest('[data-droplist]');
  if (!row || !list) return;
  ev.preventDefault();
  ev.stopPropagation();
  drag = { row, list, moved: false };
  row.classList.add('dragging');
  document.addEventListener('pointermove', onDragMove, { passive: false });
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);
}
function onDragMove(ev) {
  if (!drag) return;
  if (ev.cancelable) ev.preventDefault();
  drag.moved = true;
  const rows = [...drag.list.querySelectorAll('[data-row-id]')].filter((r) => r !== drag.row);
  const y = ev.clientY;
  let before = null;
  for (const r of rows) {
    const box = r.getBoundingClientRect();
    if (y < box.top + box.height / 2) { before = r; break; }
  }
  if (before) drag.list.insertBefore(drag.row, before);
  else drag.list.appendChild(drag.row);
}
function endDrag() {
  if (!drag) return;
  const { list, row, moved } = drag;
  row.classList.remove('dragging');
  document.removeEventListener('pointermove', onDragMove);
  document.removeEventListener('pointerup', endDrag);
  document.removeEventListener('pointercancel', endDrag);
  drag = null;
  if (!moved) return;
  const kind = list.dataset.droplist;
  const orderedIds = [...list.querySelectorAll('[data-row-id]')].map((r) => r.dataset.rowId);
  onDrop(kind, orderedIds);
}
function onDrop(kind, orderedIds) {
  if (kind === 'subtasks') {
    // Rutine-editorens deloppgaver ligger i flyktig App.routineEdit.subtasks.
    if (!App.routineEdit) return;
    const byId = {};
    (App.routineEdit.subtasks || []).forEach((s) => { byId[s.id] = s; });
    App.routineEdit.subtasks = orderedIds.map((id) => byId[id]).filter(Boolean);
    renderRoutineEditor();
    return;
  }
  // Standard: ekte items med order-felt (gjøremål/jobb/langsiktig/forbedring).
  commit(L.reorderItems(App.state, { orderedIds }, ctx()));
}

// Ekte item-typer (brukes i redigering). Ingrid er en kilde, ikke en type.
const EDIT_TYPES = [
  { id: 'task', label: '✅ Gjøremål' },
  { id: 'job', label: '💼 Jobb' },
  { id: 'someday', label: '💛 Langsiktig' },
  { id: 'note', label: '📝 Notat' },
];
// Valg i «Fang en tanke» = typene + Ingrid (sender tanken til Ingrid-lista).
const CAPTURE_TYPES = EDIT_TYPES.concat([{ id: 'ingrid', label: '💬 Ingrid' }]);
const INSIST_CHIPS = [['chill', '😴 Chill'], ['nudge', '👋 Dult'], ['nag', '📣 Masete']];

// Felles innmat for både fange- og redigeringsskjema. prefix = 'cap' | 'edit'.
function insistChips(prefix, m) {
  if (m.type !== 'someday') return '';
  const iAttr = 'data-' + prefix + 'insist';
  const cAttr = 'data-' + prefix + 'cad';
  let h = `<div class="lab">Hvor mye skal den mase?</div><div class="chips">`
    + INSIST_CHIPS.map(([k, l]) =>
        `<span class="chip ${m.insistence === k ? 'on' : ''}" ${iAttr}="${k}">${l}</span>`).join('')
    + `</div>`;
  if (m.insistence === 'nudge') {
    h += `<div class="lab">Kom tilbake hver…</div><div class="chips">`
      + [3, 7, 14, 30].map((d) =>
          `<span class="chip ${m.cadenceDays === d ? 'on' : ''}" ${cAttr}="${d}">${d} dager</span>`).join('')
      + `</div>`;
  }
  return h;
}

// Inline fange-felt. fixedType = låst type (lister); null = vis typevalg (hjem).
function captureBlock(opts) {
  const o = opts || {};
  App.capFixed = o.fixedType || null;
  App.capStay = !!o.fixedType;
  const cap = App.cap;
  const showTypes = !o.fixedType;
  const typeChips = showTypes
    ? CAPTURE_TYPES.map((tp) =>
        `<span class="chip ${cap.type === tp.id ? 'on' : ''}" data-captype="${tp.id}">${tp.label}</span>`).join('')
    : '';
  return `<div class="capture card">`
    + `<textarea class="inp" id="capInput" rows="2" placeholder="${esc(o.placeholder || 'Fang en tanke…')}">${esc(cap.text)}</textarea>`
    + (showTypes ? `<div class="lab">Hva er dette?</div><div class="chips">${typeChips}</div>` : '')
    // Vis «hvor mye skal den mase?»-dultene også på faste-type-sider (f.eks. Langsiktig),
    // ikke bare på forsiden. insistChips returnerer '' for alt annet enn someday.
    + insistChips('cap', showTypes ? cap : { ...cap, type: o.fixedType })
    + `<button class="btn" id="capAddBtn">Legg til</button>`
    + `</div>`;
}

function submitCapture() {
  const cap = App.cap;
  const text = (cap.text || '').trim();
  if (!text) return;
  const choice = App.capFixed || cap.type || 'task';
  const c = ctx();
  const id = c.id;
  const stay = App.capStay;
  const reset = () => { App.cap = { text: '', type: 'task', insistence: 'chill', cadenceDays: 7 }; };
  // Ingrid er en kilde, ikke en type → lapp til Ingrid-lista.
  if (choice === 'ingrid') {
    const next = L.addItem(App.state, { text, source: 'kona' }, c);
    reset();
    if (!stay) App.view = 'kona';
    App.state = next; saveStateDebounced(App.state); render();
    return;
  }
  let next = L.addItem(App.state, { text, type: choice }, c);
  if (choice === 'someday') {
    next = L.setInsistence(next, { id, insistence: cap.insistence, cadenceDays: cap.cadenceDays },
                           { now: c.now, id: newId() });
  }
  reset();
  if (!stay) App.view = { task: 'tasks', job: 'job', someday: 'medium', note: 'notes' }[choice] || 'tasks';
  App.state = next; saveStateDebounced(App.state); render();
}

// Inline redigering – erstatter raden du redigerer.
function isEditing(id) { return App.edit && App.edit.id === id; }

function openEdit(id) {
  const it = App.state.items.find((i) => i.id === id);
  if (!it) return;
  const type = ['task', 'job', 'someday', 'note'].includes(it.type) ? it.type : 'task';
  App.edit = { id, text: it.text || '', type,
               insistence: it.insistence || 'chill', cadenceDays: it.cadenceDays || 7 };
  render();
}

function editForm() {
  const e = App.edit;
  const typeChips = EDIT_TYPES.map((tp) =>
    `<span class="chip ${e.type === tp.id ? 'on' : ''}" data-edittype="${tp.id}">${tp.label}</span>`).join('');
  return `<div class="editrow">`
    + `<textarea class="inp" id="editInput" rows="2" placeholder="Endre teksten…">${esc(e.text)}</textarea>`
    + `<div class="lab">Hva er dette?</div><div class="chips">${typeChips}</div>`
    + insistChips('edit', e)
    + `<div class="editacts"><button class="btn" id="editSave">Lagre</button>`
    + `<button class="mini" id="editCancel">Avbryt</button>`
    + `<button class="mini danger" id="editDelete">Slett</button></div>`
    + `</div>`;
}

function saveEdit() {
  const e = App.edit;
  if (!e) return;
  if (!e.text.trim()) { App.edit = null; render(); return; }
  const c = ctx();
  const id = e.id;
  let next = L.setItemText(App.state, { id, text: e.text }, c);
  next = L.classifyItem(next, { id, type: e.type }, { now: c.now, id: newId() });
  if (e.type === 'someday') {
    next = L.setInsistence(next, { id, insistence: e.insistence, cadenceDays: e.cadenceDays },
                           { now: c.now, id: newId() });
  }
  App.edit = null; App.state = next; saveStateDebounced(App.state); render();
}

function deleteFromEdit() {
  const id = App.edit.id;
  App.edit = null;
  commit(L.deleteItem(App.state, { id }, ctx()));
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' });
}
function fmtDateTime(iso) {
  return new Date(iso).toLocaleString('no-NO',
    { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function itemRowHtml(it) {
  if (isEditing(it.id)) return editForm();
  const now = nowIso();
  const checkable = it.type === 'task' || it.type === 'reminder';
  const chk = checkable
    ? `<span class="chk ${it.done ? 'on' : ''}" data-done="${it.id}"></span>`
    : `<span style="width:26px"></span>`;
  const meta = [];
  if (it.due) meta.push('🗓 ' + it.due);
  if (it.remindAt) meta.push('⏰ ' + fmtTime(it.remindAt));
  if (it.deferred && it.resurfaceAt && !L.isResurfaced(it, now)) meta.push('💤 tilbake ' + fmtDate(it.resurfaceAt));
  const typeLabel = { note: 'Notat', task: 'Gjøremål', job: 'Jobb', reminder: 'Påminnelse', someday: 'Langsiktig' }[it.type] || 'Uklassifisert';
  return `<div class="row">${chk}`
    + `<div class="rtxt ${it.done ? 'done' : ''}" data-edit="${it.id}"><div class="t">${esc(it.text)}</div>`
    + (meta.length ? `<div class="m">${esc(meta.join(' · '))}</div>` : '')
    + `</div>`
    + (checkable && !it.done ? `<button class="mini" data-defer="${it.id}">Ikke nå</button>` : '')
    + `<span class="typ">${typeLabel}</span></div>`;
}

function listCard(items) {
  if (!items.length) return `<p class="sub">Ingenting her 🌱</p>`;
  return `<div class="card">${items.map(itemRowHtml).join('')}</div>`;
}

// Fullført rad: overstreket tekst + avkrysset sirkel man kan trykke for å angre
// (hent tilbake til aktiv liste). Ingen andre knapper – ryddes samlet.
function doneRowHtml(it) {
  return `<div class="row"><span class="chk on" data-reopen="${it.id}" title="Angre – hent tilbake"></span>`
    + `<div class="rtxt done"><div class="t">${esc(it.text)}</div></div></div>`;
}

// «✓ Fullført (N)»-seksjon nederst i en liste + samleknapp som frakter alt til søppel.
function doneSection(items) {
  if (!items.length) return '';
  const ids = items.map((i) => i.id).join(',');
  return `<h2>✓ Fullført (${items.length})</h2>`
    + `<div class="card">${items.map(doneRowHtml).join('')}</div>`
    + `<button class="btn ghost" data-trashdone="${ids}">Rydd fullførte → søppel</button>`;
}

function headerBar(title) {
  return `<div class="banner topnav" data-home="1" role="button" title="Til hjem">`
    + `<span class="back">‹</span>`
    + `<div class="b">${esc(title)}</div>`
    + `<span class="homeic">⌂</span></div>`;
}

function taskRowHtml(it) {
  if (isEditing(it.id)) return `<div class="trow editing" data-row-id="${it.id}">${editForm()}</div>`;
  const now = nowIso();
  const chk = `<span class="chk ${it.done ? 'on' : ''}" data-done="${it.id}"></span>`;
  const meta = [];
  if (it.remindAt) meta.push('⏰ ' + fmtDateTime(it.remindAt));
  else if (it.due) meta.push('🗓 ' + it.due);
  if (it.deferred && it.resurfaceAt && !L.isResurfaced(it, now)) meta.push('💤 tilbake ' + fmtDate(it.resurfaceAt));
  const open = !!App.rowOpen[it.id] || isTimeEditing(it.id);
  const handle = `<span class="draghandle" data-draghandle="${it.id}" title="Dra for å flytte">⠿</span>`;
  const exp = `<button class="rowexp ${open ? 'open' : ''}" data-rowexp="${it.id}" title="Tid og valg">⌵</button>`;
  const head = `<div class="row">${handle}${chk}`
    + `<div class="rtxt ${it.done ? 'done' : ''}" data-edit="${it.id}"><div class="t">${esc(it.text)}</div>`
    + (meta.length ? `<div class="m">${esc(meta.join(' · '))}</div>` : '')
    + `</div>${exp}</div>`;
  let panel = '';
  if (isTimeEditing(it.id)) {
    panel = `<div class="rowpanel">${timeEditHtml()}</div>`;
  } else if (open) {
    const timeBtn = `<button class="mini" data-settime="${it.id}">⏰ ${it.remindAt ? 'Endre tid' : 'Sett tid'}</button>`;
    const iosBtn = it.remindAt
      ? (it.iosPushedAt
          ? `<button class="mini" data-ios="${it.id}">✓ i Påminnelser · send på nytt</button>`
          : `<button class="mini" data-ios="${it.id}">⏰ Legg i Påminnelser</button>`)
      : '';
    panel = `<div class="rowpanel"><div class="taskacts">${timeBtn}${iosBtn}`
      + `<button class="mini" data-defer="${it.id}">Ikke nå</button></div></div>`;
  }
  return `<div class="trow" data-row-id="${it.id}">${head}${panel}</div>`;
}

// Hele gjøremåls-/jobblista i ett felt (ingen ramme per rad) som også er drop-sone
// for dra-og-slipp. Tomme lister rendres av kalleren.
function taskListCard(items) {
  return `<div class="card droplist" data-droplist="items">${items.map(taskRowHtml).join('')}</div>`;
}

function renderTasks() {
  const items = L.taskItems(App.state, nowIso());
  const body = items.length
    ? taskListCard(items)
    : `<p class="sub">Ingen gjøremål nå 🌱</p>`;
  return headerBar('✅ Gjøremål')
    + `<div class="body">`
    + captureBlock({ fixedType: 'task', placeholder: 'Nytt gjøremål…' })
    + body + doneSection(L.doneTaskItems(App.state)) + `</div>`;
}

function deferredJobRowHtml(it) {
  if (isEditing(it.id)) return editForm();
  const back = it.resurfaceAt ? fmtDateTime(it.resurfaceAt) : '';
  return `<div class="row">`
    + `<div class="rtxt" data-edit="${it.id}"><div class="t">${esc(it.text)}</div>`
    + (back ? `<div class="m">💤 tilbake ${esc(back)}</div>` : '')
    + `</div>`
    + `<button class="mini" data-undefer="${it.id}">Hent frem</button></div>`;
}

function renderJob() {
  const now = nowIso();
  const items = L.jobItems(App.state, now);
  const deferred = L.deferredJobItems(App.state, now);
  const body = items.length
    ? taskListCard(items)
    : `<p class="sub">Ingen jobb-gjøremål nå 🌱</p>`;
  const deferredCard = deferred.length
    ? `<h2>💤 Utsatt</h2><div class="card">${deferred.map(deferredJobRowHtml).join('')}</div>`
    : '';
  return headerBar('💼 Jobb')
    + `<div class="body">`
    + captureBlock({ fixedType: 'job', placeholder: 'Nytt jobb-gjøremål…' })
    + body + deferredCard + doneSection(L.doneJobItems(App.state)) + `</div>`;
}

function noteRowHtml(it) {
  if (isEditing(it.id)) return editForm();
  const on = !!it.badge;
  return `<div class="row">`
    + `<div class="rtxt" data-edit="${it.id}"><div class="t">${esc(it.text)}</div></div>`
    + `<button class="mini ${on ? 'on' : ''}" data-notebadge="${it.id}" `
    + `title="${on ? 'Teller på badge – trykk for å bare la den ligge' : 'Bare ligger – trykk for å telle på badge'}">`
    + `${on ? '🔔' : '🔕'}</button>`
    + `<button class="mini" data-edit="${it.id}">Rediger</button></div>`;
}

function trashRowHtml(it) {
  const when = it.removedAt ? fmtDateTime(it.removedAt) : 'nylig';
  const typeLabel = { note: 'Notat', task: 'Gjøremål', job: 'Jobb', reminder: 'Påminnelse', someday: 'Langsiktig' }[it.type];
  const meta = '🗑 slettet ' + when + (typeLabel ? ' · ' + typeLabel : '');
  return `<div class="row">`
    + `<div class="rtxt"><div class="t">${esc(it.text || '(tom)')}</div>`
    + `<div class="m">${esc(meta)}</div></div>`
    + `<button class="mini" data-restore="${it.id}">Gjenopprett</button>`
    + `<button class="mini danger" data-purge="${it.id}">Slett for godt</button></div>`;
}

function renderTrash() {
  const items = L.trashItems(App.state);
  const list = items.length
    ? `<div class="card">${items.map(trashRowHtml).join('')}</div>`
    : `<p class="sub">Søppelkassa er tom 🌱</p>`;
  const emptyBtn = items.length
    ? `<button class="btn ghost" data-purgeall="1">Tøm søppelkassa (${items.length})</button>`
    : '';
  return headerBar('🗑 Søppelkasse')
    + `<div class="body">`
    + `<p class="sub">Slettede ting blir liggende her til du tømmer selv. Gjenopprett det du vil ha tilbake.</p>`
    + list + emptyBtn + `</div>`;
}

function renderNotes() {
  const items = L.noteItems(App.state);
  const body = items.length
    ? `<div class="card">${items.map(noteRowHtml).join('')}</div>`
    : `<p class="sub">Ingen notater 🌱</p>`;
  return headerBar('📝 Notater')
    + `<div class="body">`
    + captureBlock({ fixedType: 'note', placeholder: 'Nytt notat…' })
    + body + `</div>`;
}

// --- Forbedring (🌱): overskrift + lengre Markdown-beskrivelse, ingen avkryssing ---
function categoryDatalist(id) {
  const opts = L.improvementCategories(App.state).map((c) => `<option value="${esc(c)}">`).join('');
  return `<datalist id="${id}">${opts}</datalist>`;
}

function improvementAddBlock() {
  if (!App.impAddOpen) {
    return `<button class="addmini" data-impaddtoggle>＋ Ny forbedring</button>`;
  }
  const i = App.imp || { text: '', body: '', depth: '', category: '' };
  return `<div class="capture card">`
    + `<input class="inp" id="impTitle" placeholder="Overskrift…" value="${esc(i.text)}">`
    + `<input class="inp" id="impCat" list="impCatList" placeholder="Kategori (valgfritt) – f.eks. Oppgaver, Egenpleie…" value="${esc(i.category || '')}">`
    + categoryDatalist('impCatList')
    + `<textarea class="inp" id="impBody" rows="5" placeholder="Beskrivelse – Markdown: **fet**, ## overskrift, - punkt…">${esc(i.body)}</textarea>`
    + `<textarea class="inp" id="impDepth" rows="4" placeholder="Dybde (valgfritt) – dyptgående påfyll, samme Markdown…">${esc(i.depth)}</textarea>`
    + `<div class="editacts"><button class="btn" id="impAddBtn">Legg til</button>`
    + `<button class="mini" data-impaddtoggle>Avbryt</button></div>`
    + `</div>`;
}

function improvementEditForm() {
  const e = App.impEdit;
  return `<input class="inp" id="impEditTitle" placeholder="Overskrift…" value="${esc(e.text)}">`
    + `<input class="inp" id="impEditCat" list="impEditCatList" placeholder="Kategori (valgfritt)…" value="${esc(e.category || '')}">`
    + categoryDatalist('impEditCatList')
    + `<textarea class="inp" id="impEditBody" rows="7" placeholder="Beskrivelse…">${esc(e.body)}</textarea>`
    + `<textarea class="inp" id="impEditDepth" rows="5" placeholder="Dybde (valgfritt) – dyptgående påfyll…">${esc(e.depth)}</textarea>`
    + `<div class="editacts"><button class="btn" id="impEditSave">Lagre</button>`
    + `<button class="mini" id="impEditCancel">Avbryt</button>`
    + `<button class="mini danger" id="impEditDelete">Slett</button></div>`;
}

function improvementCardHtml(it) {
  if (App.impEdit && App.impEdit.id === it.id) {
    return `<div class="card improvement" data-row-id="${it.id}">${improvementEditForm()}</div>`;
  }
  const open = !!App.impOpen[it.id];
  const handle = `<span class="draghandle" data-draghandle="${it.id}" title="Dra for å flytte">⠿</span>`;
  // Kollapset: bare overskrift. Klikk på overskriften ekspanderer alt under
  // (beskrivelse, evt. dybde bak «Vis mer», og Rediger).
  const head = `<div class="imphead ${open ? 'open' : ''}">${handle}`
    + `<div class="t" data-impexpand="${it.id}">${esc(it.text)}</div>`
    + `<span class="caret" data-impexpand="${it.id}">⌄</span></div>`;
  let detail = '';
  if (open) {
    const bodyHtml = it.body ? `<div class="mdbody">${L.renderMarkdown(it.body)}</div>` : '';
    const dOpen = !!App.impDepth[it.id];
    const depthToggle = it.depth
      ? `<button class="expand" data-impdepth="${it.id}">${dOpen ? 'Vis mindre ⌃' : 'Vis mer ⌄'}</button>`
      : '';
    const depthHtml = (it.depth && dOpen)
      ? `<div class="mddepth">${L.renderMarkdown(it.depth)}</div>` : '';
    detail = bodyHtml + depthToggle + depthHtml
      + `<div class="impacts"><button class="mini" data-impedit="${it.id}">Rediger</button></div>`;
  }
  return `<div class="card improvement" data-row-id="${it.id}">${head}${detail}</div>`;
}

function renderImprovements() {
  const groups = L.improvementGroups(App.state);
  let body;
  if (!groups.length) {
    body = `<p class="sub">Ingenting her ennå 🌱 Legg til noe du vil ta vare på eller jobbe med.</p>`;
  } else {
    // Hver kategori får en synlig overskrift og sin egen drop-sone (dra innen gruppe).
    body = groups.map((g) => {
      const head = `<h2 class="impcat">${g.category ? esc(g.category) : 'Uten kategori'}</h2>`;
      return head + `<div class="impgroup" data-droplist="items">${g.items.map(improvementCardHtml).join('')}</div>`;
    }).join('');
  }
  return headerBar('🌱 Forbedring')
    + `<div class="body">`
    + improvementAddBlock()
    + body + `</div>`;
}

function submitImprovement() {
  const t = (App.imp.text || '').trim();
  const b = (App.imp.body || '').trim();
  const d = (App.imp.depth || '').trim();
  const cat = (App.imp.category || '').trim();
  if (!t && !b && !d) return;
  const c = ctx();
  App.state = L.addImprovement(App.state, { text: t, body: b || null, depth: d || null, category: cat || null }, c);
  App.imp = { text: '', body: '', depth: '', category: '' };
  App.impAddOpen = false;
  saveStateDebounced(App.state); render();
}

function openImprovementEdit(id) {
  const it = App.state.items.find((i) => i.id === id);
  if (!it) return;
  App.impEdit = { id, text: it.text || '', body: it.body || '', depth: it.depth || '', category: it.category || '' };
  render();
}

function saveImprovementEdit() {
  const e = App.impEdit;
  if (!e) return;
  const t = (e.text || '').trim();
  const b = (e.body || '').trim();
  const d = (e.depth || '').trim();
  const cat = (e.category || '').trim();
  if (!t && !b && !d) { // helt tom → slett (til søppel)
    App.impEdit = null;
    commit(L.deleteItem(App.state, { id: e.id }, ctx()));
    return;
  }
  const c = ctx();
  let next = L.setItemText(App.state, { id: e.id, text: e.text }, c);
  next = L.setItemBody(next, { id: e.id, body: b || null }, { now: c.now, id: newId() });
  next = L.setItemDepth(next, { id: e.id, depth: d || null }, { now: c.now, id: newId() });
  next = L.setItemCategory(next, { id: e.id, category: cat || null }, { now: c.now, id: newId() });
  App.impEdit = null;
  App.state = next; saveStateDebounced(App.state); render();
}

function deleteImprovementFromEdit() {
  const id = App.impEdit.id;
  App.impEdit = null;
  commit(L.deleteItem(App.state, { id }, ctx()));
}

function nudgeRowHtml(it) {
  if (isEditing(it.id)) return editForm();
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

function renderToday() {
  const now = nowIso();
  const items = L.itemsForToday(App.state, now);
  return headerBar('📌 I dag')
    + `<div class="body"><p class="sub">Det som krever deg nå.</p>`
    + listCard(items)
    + doneSection(L.doneTodayItems(App.state, now))
    + `</div>`;
}

function daysUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function mediumRowHtml(it) {
  if (isEditing(it.id)) return `<div class="trow editing" data-row-id="${it.id}">${editForm()}</div>`;
  const now = nowIso();
  const chk = `<span class="chk ${it.done ? 'on' : ''}" data-done="${it.id}"></span>`;
  const meta = [];
  if (it.insistence === 'nudge') {
    if (it.resurfaceAt && it.resurfaceAt <= now) meta.push('👋 klar nå');
    else if (it.resurfaceAt) meta.push('👋 om ' + daysUntil(it.resurfaceAt) + ' d');
  }
  const handle = `<span class="draghandle" data-draghandle="${it.id}" title="Dra for å flytte">⠿</span>`;
  return `<div class="trow" data-row-id="${it.id}"><div class="row">${handle}${chk}`
    + `<div class="rtxt" data-edit="${it.id}"><div class="t">${esc(it.text)}</div>`
    + (meta.length ? `<div class="m">${esc(meta.join(' · '))}</div>` : '')
    + `</div>`
    + `<button class="mini" data-promote="${it.id}">I dag</button></div></div>`;
}

function renderMedium() {
  const items = L.mediumItems(App.state);
  const groups = [['nag', '📣 Masete'], ['nudge', '👋 Dult'], ['chill', '😴 Chill']];
  let body = '';
  groups.forEach(([key, label]) => {
    const g = items.filter((i) => (i.insistence || 'chill') === key);
    if (g.length) body += `<h2>${label}</h2><div class="card droplist" data-droplist="items">${g.map(mediumRowHtml).join('')}</div>`;
  });
  if (!body) body = `<p class="sub">Ingenting her ennå. Fang noe som «💛 Langsiktig».</p>`;
  return headerBar('💛 Langsiktig')
    + `<div class="body">`
    + captureBlock({ fixedType: 'someday', placeholder: 'Fang noe til senere…' })
    + body + doneSection(L.doneSomedayItems(App.state)) + `</div>`;
}

function konaRowHtml(it) {
  if (isEditing(it.id)) return editForm();
  return `<div class="row">`
    + `<div class="rtxt" data-edit="${it.id}"><div class="t">${esc(it.text)}</div></div>`
    + `<button class="mini" data-edit="${it.id}">Behandle</button>`
    + `<button class="mini" data-kdismiss="${it.id}">✕</button></div>`;
}

function konaTrashRowHtml(it) {
  return `<div class="row"><div class="rtxt done"><div class="t">${esc(it.text)}</div></div>`
    + `<button class="mini" data-krestore="${it.id}">↩ Gjenopprett</button>`
    + `<button class="mini danger" data-kpurge="${it.id}">Slett for godt</button></div>`;
}

function renderKona() {
  const items = L.konaItems(App.state);
  const list = items.length
    ? `<div class="card">${items.map(konaRowHtml).join('')}</div>`
    : `<p class="sub">Ingen lapper fra Ingrid akkurat nå 🌱</p>`;
  const trash = L.konaTrashItems(App.state);
  let trashSec = '';
  if (trash.length) {
    const open = App.konaTrashOpen;
    trashSec = `<h2 class="collapse ${open ? 'open' : ''}" data-konatrashtoggle="1">`
      + `🗑 Slettet (${trash.length}) <span class="caret">⌄</span></h2>`
      + (open ? `<div class="card">${trash.map(konaTrashRowHtml).join('')}</div>`
          + `<button class="btn ghost" data-kpurgeall="1">Slett alle (${trash.length})</button>` : '');
  }
  return headerBar('💬 Ingrid')
    + `<div class="body">`
    + `<p class="sub">Ingrid legger igjen en beskjed til Tor Gunnar. Han triagerer dem selv.</p>`
    + `<div class="konacap"><input class="inp" id="konaText" placeholder="Skriv en lapp…">`
    + `<button class="btn" id="konaAdd">Legg til</button></div>`
    + list + trashSec + `</div>`;
}


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
        + `<button class="mini" data-rskip="${inst.id}">Legg bort</button>`
        + `<button class="mini" data-redit="${inst.routineId}">Rediger mal</button></div>` : '')
    + `</div>`;
}

function inactiveRowHtml(r) {
  return `<div class="row"><div class="rtxt"><div class="t">${esc(r.title)}</div>`
    + `<div class="m">${(r.subtasks || []).length} steg</div></div>`
    + `<button class="mini" data-rwake="${r.id}">Aktiver</button>`
    + `<button class="mini" data-redit="${r.id}">✎</button></div>`;
}

function renderRoutines() {
  const today = todayIso();
  const todayInst = L.routineInstancesForDate(App.state, today);
  const activeToday = todayInst.filter((i) => !i.done);
  const doneToday = todayInst.filter((i) => i.done);
  const inactive = L.inactiveRoutines(App.state, today);
  // Fullførte legges bort i en egen (lukket) seksjon.
  let doneSec = '';
  if (doneToday.length) {
    const open = App.doneRtnOpen;
    doneSec = `<h2 class="collapse ${open ? 'open' : ''}" data-donertntoggle="1">`
      + `✓ Fullførte (${doneToday.length}) <span class="caret">⌄</span></h2>`
      + (open ? doneToday.map(instCardHtml).join('') : '');
  }
  return headerBar('🔁 Rutiner')
    + `<div class="body">`
    + `<p class="sub">Alle rutiner starter inaktive – aktiver dem du vil bruke i dag. Nullstilles hver dag.</p>`
    + `<h2>Aktive</h2>` + (activeToday.length ? activeToday.map(instCardHtml).join('') : `<p class="sub">Ingen aktive rutiner. Aktiver en nedenfor.</p>`)
    + doneSec
    + `<h2>Inaktive</h2>` + (inactive.length ? `<div class="card">${inactive.map(inactiveRowHtml).join('')}</div>` : `<p class="sub">Alle rutiner er aktivert 🌱</p>`)
    + `<button class="btn" data-rnew="1">＋ Ny rutine</button>`
    + `</div>`;
}

function openRoutineEditor(id) {
  if (id) {
    const r = App.state.settings.routines.find((x) => x.id === id);
    if (!r) return;
    App.routineEdit = L.clone(r);
  } else {
    App.routineEdit = { id: null, title: '', subtasks: [{ id: 't0', text: '' }], weekdays: [], enabled: true, leadDay: false, sleeping: false };
  }
  renderRoutineEditor();
}

function renderRoutineEditor() {
  const e = App.routineEdit;
  const subRows = (e.subtasks || []).map((s, i) =>
    `<div class="trow subrow" data-row-id="${s.id}"><div class="row">`
    + `<span class="draghandle" data-draghandle="${s.id}" title="Dra for å flytte">⠿</span>`
    + `<input class="inp" style="margin:0" data-esub="${i}" value="${esc(s.text)}" placeholder="Deloppgave…">`
    + `<button class="mini" data-edel="${i}">✕</button></div></div>`).join('');
  const html = `<div class="overlay" id="ov"><div class="sheet">`
    + `<input class="inp" id="eTitle" placeholder="Rutinenavn (f.eks. Kveldssjekk)" value="${esc(e.title)}">`
    + `<div class="lab">Deloppgaver</div><div class="subdrop" data-droplist="subtasks">${subRows}</div>`
    + `<button class="btn ghost" id="eAddSub">＋ Deloppgave</button>`
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
  o.querySelector('#eAddSub').onclick = () => { e.subtasks.push({ id: 't' + Date.now().toString(36), text: '' }); renderRoutineEditor(); };
  o.querySelector('#eCancel').onclick = () => { App.routineEdit = null; o.remove(); };
  o.querySelector('#eSave').onclick = saveRoutineEditor;
  const del = o.querySelector('#eDelete');
  if (del) del.onclick = () => {
    const id = e.id; App.routineEdit = null; o.remove();
    commit(L.deleteRoutine(App.state, { id }, ctx()));
  };
  bindDrag(o);
}

function saveRoutineEditor() {
  const e = App.routineEdit;
  if (!e.title.trim()) { App.routineEdit = null; const o = document.getElementById('ov'); if (o) o.remove(); return; }
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

function renderSettings() {
  const name = App.state.settings.shortcutName || 'TorGunnar';
  return headerBar('⚙️ Innstillinger')
    + `<div class="body">`
    + `<h2>Apple Påminnelser</h2>`
    + `<p class="sub">Navnet på iOS-snarveien som legger gjøremål i Påminnelser.</p>`
    + `<input class="inp" id="setShortcut" value="${esc(name)}">`
    + `<button class="btn" id="setShortcutSave">Lagre navn</button>`
    + `<p class="sub">Engangsoppsett på iPhone:</p>`
    + `<p class="sub">1) Lag en snarvei med akkurat dette navnet. Steg i snarveien: «Hent ordbok fra inndata» → «Hent ordbokverdi» for <b>title</b> og <b>due</b> → «Dato» på due → «Opprett påminnelse» (tittel = title, forfall = datoen).</p>`
    + `<p class="sub">2) Slå på <b>Innstillinger → Varsler → Påminnelser → Tidssensitive varsler</b> så de bryter gjennom Fokus.</p>`
    + `<h2>Rolige sitater</h2>`
    + `<p class="sub">Vises under Tor Gunnar hver dag. Én per linje. Tom = standardlista.</p>`
    + `<textarea class="inp" id="setQuotes" rows="8">${esc((App.state.settings.quotes || []).join('\n'))}</textarea>`
    + `<button class="btn" id="setQuotesSave">Lagre sitater</button>`
    + `<button class="btn ghost" id="setQuotesReset">Tilbakestill til standard</button>`
    + `<h2>Romkode</h2>`
    + `<p class="sub">Appen er låst med en felles romkode. Lås denne enheten – eller bytt til en ny kode – her. (Dine notater i skya påvirkes ikke.)</p>`
    + `<button class="btn ghost" id="setLock">Lås / bytt romkode</button>`
    + `</div>`;
}

function doComplete(id, el) {
  el.classList.add('on', 'pop', 'burst');
  if (navigator.vibrate) navigator.vibrate([10, 25, 12]);
  const row = el.closest('.row');
  if (row) setTimeout(() => row.classList.add('leaving'), 160);
  setTimeout(() => {
    commit(L.completeItem(App.state, { id }, ctx()));
  }, 300);
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

// --- Inline tid-velger med +/- steppere (build 12) ---
function roundedNowIso() {
  const d = new Date();
  d.setSeconds(0, 0);
  const add = (5 - (d.getMinutes() % 5)) % 5;
  d.setMinutes(d.getMinutes() + add);
  return d.toISOString();
}
function isTimeEditing(id) { return App.timeEdit && App.timeEdit.id === id; }
function openTime(id) {
  const it = App.state.items.find((i) => i.id === id);
  App.timeEdit = { id, at: (it && it.remindAt) || roundedNowIso() };
  render();
}
function adjustTime(unit, amount) {
  const d = new Date(App.timeEdit.at);
  if (unit === 'min') d.setMinutes(d.getMinutes() + amount);
  else if (unit === 'hour') d.setHours(d.getHours() + amount);
  else if (unit === 'day') d.setDate(d.getDate() + amount);
  App.timeEdit.at = d.toISOString();
  render();
}
function quickTime(kind) {
  const d = new Date();
  if (kind === 'kveld') { d.setHours(20, 0, 0, 0); if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1); }
  else if (kind === 'morgen') { d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); }
  App.timeEdit.at = d.toISOString();
  render();
}
function saveTime() {
  const { id, at } = App.timeEdit;
  App.timeEdit = null;
  commit(L.scheduleTask(App.state, { id, at }, ctx()));
}
function stepRow(label, unit, step) {
  return `<div class="steprow"><span class="slab">${label}</span>`
    + `<button class="step" data-tstep="${unit}|-${step}">−</button>`
    + `<button class="step" data-tstep="${unit}|${step}">+</button></div>`;
}
function timeEditHtml() {
  const d = new Date(App.timeEdit.at);
  const clock = pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  const date = pad2(d.getDate()) + '.' + pad2(d.getMonth() + 1) + '.' + d.getFullYear();
  return `<div class="timeedit">`
    + `<div class="tdisp"><span class="tclock">${clock}</span><span class="tdate">${date}</span></div>`
    + `<div class="timepush">`
    + `<button class="mini" data-tstep="hour|1">+1 t</button>`
    + `<button class="mini" data-tstep="hour|3">+3 t</button>`
    + `<button class="mini" data-tstep="day|1">+1 dag</button>`
    + `<button class="mini" data-tstep="day|7">+1 uke</button></div>`
    + stepRow('Minutter', 'min', 5)
    + stepRow('Timer', 'hour', 1)
    + stepRow('Dager', 'day', 1)
    + `<div class="timequick">`
    + `<button class="mini" data-tquick="kveld">I kveld</button>`
    + `<button class="mini" data-tquick="morgen">I morgen</button></div>`
    + `<div class="timeacts"><button class="btn" data-tsave="1">Sett tid</button>`
    + `<button class="mini" data-tcancel="1">Avbryt</button></div>`
    + `</div>`;
}

function pad2(n) { return String(n).padStart(2, '0'); }
function localDue(iso) {
  const d = new Date(iso);
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
    + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function pushToIos(id) {
  const it = App.state.items.find((i) => i.id === id);
  if (!it || !it.remindAt) return;
  const url = L.buildShortcutUrl(App.state.settings.shortcutName,
    { title: it.text, due: localDue(it.remindAt) });
  window.location.href = url;
  commit(L.markPushedToIos(App.state, { id }, ctx()));
}

// Låseskjerm: uten romkode viser vi ingenting av innholdet. Koden er den ekte
// nøkkelen til de delte dataene – den lagres kun lokalt på enheten.
function renderLock(err) {
  const root = document.getElementById('app');
  root.innerHTML = `<div class="banner"><div class="b">🦸‍♂️ Tor Gunnar</div></div>`
    + `<div class="body">`
    + `<div class="capture card">`
    + `<div class="lab">Romkode</div>`
    + `<p class="sub">Skriv inn koden for å åpne de delte notatene. Du taster den bare én gang per enhet.</p>`
    + `<input class="inp" id="codeInput" placeholder="xxxx-xxxx-xxxx" `
    + `autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" inputmode="text">`
    + `<button class="btn" id="codeBtn">Lås opp</button>`
    + (err ? `<p class="sub" style="color:var(--rose);margin-top:10px">${esc(err)}</p>` : '')
    + `</div></div>`;
  const inp = root.querySelector('#codeInput');
  const go = () => {
    const code = (inp.value || '').trim();
    if (!code) { renderLock('Skriv inn koden.'); return; }
    setCode(code);
    init();
  };
  root.querySelector('#codeBtn').onclick = go;
  inp.onkeydown = (ev) => { if (ev.key === 'Enter') go(); };
  inp.focus();
}

function lockApp() {
  clearCode();
  App.state = null; App.view = 'home';
  renderLock();
}

async function init() {
  if (!hasCode()) { renderLock(); return; }
  App.state = await loadState();          // lokal cache + delt sky, flettet
  App.state = syncRoutines(App.state);
  saveStateDebounced(App.state);
  render();
  // Hent inn endringer fra andre enheter hvert 5. sekund; tegn kun om ved faktisk nytt.
  startPolling(
    () => App.state,
    (merged) => {
      // Hold in-memory state fersk (ellers kan neste lagring overskrive sky-endringen),
      // men IKKE tegn om midt i aktiv redigering/fangst – det stjeler fokus/mister tekst.
      App.state = merged;
      if (App.edit || App.routineEdit || App.timeEdit || (App.cap && App.cap.text)) return;
      render();
    },
  );
}
init();
window.App = App; // for feilsøking i konsollen
