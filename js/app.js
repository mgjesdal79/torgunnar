import * as L from './logic.js';
import { loadState, saveStateDebounced, nowIso, todayIso, newId } from './store.js';

const App = {
  view: 'home', catId: null, state: null, rOpen: {}, routineEdit: null,
  cap: { text: '', type: 'task', insistence: 'chill', cadenceDays: 7 },
  capFixed: null, capStay: false,
  edit: null,
  timeEdit: null,
};

function ctx() { return { now: nowIso(), id: newId() }; }
function commit(next) { App.state = next; saveStateDebounced(App.state); render(); }

function syncRoutines(s) {
  const today = todayIso();
  let next = L.pruneRoutineInstances(s, today);
  next = L.generateRoutineInstances(next, today, ctx());
  return next;
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

function tileHtml(icon, label, badge, data) {
  const b = badge && badge.count
    ? `<span class="badge ${badge.level}">${badge.count}</span>` : '';
  return `<div class="tile" ${data}>${b}<span class="ic">${icon}</span>`
    + `<span class="lb">${esc(label)}</span></div>`;
}

function renderHome() {
  const now = nowIso();
  const inboxN = L.inboxItems(App.state, now).length;
  const todayItems = L.itemsForToday(App.state, now);
  const taskN = L.taskItems(App.state, now).length;
  const jobN = L.jobItems(App.state, now).length;
  const mediumN = L.mediumBadge(App.state);
  const konaN = L.konaBadge(App.state);
  const tiles = tileHtml('📥', 'Innboks', { count: inboxN, level: inboxN ? 'hot' : 'calm' }, 'data-view="inbox"')
    + tileHtml('✅', 'Gjøremål', { count: taskN, level: taskN ? 'open' : 'calm' }, 'data-view="tasks"')
    + tileHtml('💼', 'Jobb', { count: jobN, level: jobN ? 'open' : 'calm' }, 'data-view="job"')
    + tileHtml('💛', 'Langsiktig', mediumN, 'data-view="medium"')
    + tileHtml('📝', 'Notater', L.noteBadge(App.state), 'data-view="notes"')
    + tileHtml('💬', 'Ingrid', konaN, 'data-view="kona"')
    + tileHtml('🔁', 'Rutiner', null, 'data-view="routines"')
    + tileHtml('⚙️', 'Innstillinger', null, 'data-view="settings"');
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
  else if (v === 'kona') root.innerHTML = renderKona();
  else if (v === 'routines') root.innerHTML = renderRoutines();
  else if (v === 'settings') root.innerHTML = renderSettings();
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
  root.querySelectorAll('[data-edit]').forEach((el) =>
    el.onclick = () => openEdit(el.dataset.edit));
  root.querySelectorAll('[data-notebadge]').forEach((el) =>
    el.onclick = () => commit(L.toggleNoteBadge(App.state, { id: el.dataset.notebadge }, ctx())));
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
  root.querySelectorAll('[data-promote]').forEach((el) =>
    el.onclick = () => commit(L.promoteToToday(App.state, { id: el.dataset.promote }, ctx())));
  root.querySelectorAll('[data-msnooze]').forEach((el) =>
    el.onclick = () => commit(L.snoozeNudge(App.state, { id: el.dataset.msnooze }, ctx())));
  root.querySelectorAll('[data-kdismiss]').forEach((el) =>
    el.onclick = () => commit(L.deleteItem(App.state, { id: el.dataset.kdismiss }, ctx())));
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
    + (showTypes ? insistChips('cap', cap) : '')
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

function headerBar(title) {
  return `<div class="banner topnav" data-home="1" role="button" title="Til hjem">`
    + `<span class="back">‹</span>`
    + `<div class="b">${esc(title)}</div>`
    + `<span class="homeic">⌂</span></div>`;
}

function taskRowHtml(it) {
  if (isEditing(it.id)) return `<div class="card">${editForm()}</div>`;
  const now = nowIso();
  const chk = `<span class="chk ${it.done ? 'on' : ''}" data-done="${it.id}"></span>`;
  const meta = [];
  if (it.remindAt) meta.push('⏰ ' + fmtDateTime(it.remindAt));
  else if (it.due) meta.push('🗓 ' + it.due);
  if (it.deferred && it.resurfaceAt && !L.isResurfaced(it, now)) meta.push('💤 tilbake ' + fmtDate(it.resurfaceAt));
  const timeBtn = `<button class="mini" data-settime="${it.id}">⏰ ${it.remindAt ? 'Endre tid' : 'Sett tid'}</button>`;
  const iosBtn = it.remindAt
    ? (it.iosPushedAt
        ? `<button class="mini" data-ios="${it.id}">✓ i Påminnelser · send på nytt</button>`
        : `<button class="mini" data-ios="${it.id}">⏰ Legg i Påminnelser</button>`)
    : '';
  const head = `<div class="row">${chk}`
    + `<div class="rtxt ${it.done ? 'done' : ''}" data-edit="${it.id}"><div class="t">${esc(it.text)}</div>`
    + (meta.length ? `<div class="m">${esc(meta.join(' · '))}</div>` : '')
    + `</div></div>`;
  if (isTimeEditing(it.id)) return `<div class="card">${head}${timeEditHtml()}</div>`;
  return `<div class="card">${head}`
    + `<div class="taskacts">${timeBtn}${iosBtn}`
    + `<button class="mini" data-defer="${it.id}">Ikke nå</button></div></div>`;
}

function renderTasks() {
  const items = L.taskItems(App.state, nowIso());
  const body = items.length
    ? items.map(taskRowHtml).join('')
    : `<p class="sub">Ingen gjøremål nå 🌱</p>`;
  return headerBar('✅ Gjøremål')
    + `<div class="body">`
    + captureBlock({ fixedType: 'task', placeholder: 'Nytt gjøremål…' })
    + body + `</div>`;
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
    ? items.map(taskRowHtml).join('')
    : `<p class="sub">Ingen jobb-gjøremål nå 🌱</p>`;
  const deferredCard = deferred.length
    ? `<h2>💤 Utsatt</h2><div class="card">${deferred.map(deferredJobRowHtml).join('')}</div>`
    : '';
  return headerBar('💼 Jobb')
    + `<div class="body">`
    + captureBlock({ fixedType: 'job', placeholder: 'Nytt jobb-gjøremål…' })
    + body + deferredCard + `</div>`;
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
  const items = L.itemsForToday(App.state, nowIso());
  return headerBar('📌 I dag')
    + `<div class="body"><p class="sub">Det som krever deg nå.</p>` + listCard(items) + `</div>`;
}

function daysUntil(iso) {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86400000));
}

function mediumRowHtml(it) {
  if (isEditing(it.id)) return editForm();
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
  if (!body) body = `<p class="sub">Ingenting her ennå. Fang noe som «💛 Langsiktig».</p>`;
  return headerBar('💛 Langsiktig')
    + `<div class="body">`
    + captureBlock({ fixedType: 'someday', placeholder: 'Fang noe til senere…' })
    + body + `</div>`;
}

function konaRowHtml(it) {
  if (isEditing(it.id)) return editForm();
  return `<div class="row">`
    + `<div class="rtxt" data-edit="${it.id}"><div class="t">${esc(it.text)}</div></div>`
    + `<button class="mini" data-edit="${it.id}">Behandle</button>`
    + `<button class="mini" data-kdismiss="${it.id}">✕</button></div>`;
}

function renderKona() {
  const items = L.konaItems(App.state);
  const list = items.length
    ? `<div class="card">${items.map(konaRowHtml).join('')}</div>`
    : `<p class="sub">Ingen lapper fra Ingrid akkurat nå 🌱</p>`;
  return headerBar('💬 Ingrid')
    + `<div class="body">`
    + `<p class="sub">Ingrid legger igjen en beskjed til Tor Gunnar. Han triagerer dem selv.</p>`
    + `<div class="konacap"><input class="inp" id="konaText" placeholder="Skriv en lapp…">`
    + `<button class="btn" id="konaAdd">Legg til</button></div>`
    + list + `</div>`;
}

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
        + `<button class="mini" data-rskip="${inst.id}">Ikke i dag</button>`
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
  // Rutiner som allerede vises over (I dag / For i morgen / Sovende) – unngå duplikater.
  const shown = new Set();
  todayInst.forEach((i) => shown.add(i.routineId));
  tomInst.forEach((i) => shown.add(i.routineId));
  sleeping.forEach((r) => shown.add(r.id));
  const others = App.state.settings.routines.filter((r) => !shown.has(r.id));
  return headerBar('🔁 Rutiner')
    + `<div class="body">`
    + `<p class="sub">Dine rutiner maser ikke – du henter dem når du vil.</p>`
    + `<h2>I dag</h2>` + (todayInst.length ? todayInst.map(instCardHtml).join('') : `<p class="sub">Ingen aktive i dag.</p>`)
    + (tomInst.length ? `<h2>For i morgen 🌙</h2>` + tomInst.map(instCardHtml).join('') : '')
    + `<h2>Sovende</h2>` + (sleeping.length ? `<div class="card">${sleeping.map(sleepRowHtml).join('')}</div>` : `<p class="sub">Ingen sovende rutiner.</p>`)
    + (others.length ? `<h2>Andre rutiner</h2><div class="card">${others.map(tmplRowHtml).join('')}</div>` : '')
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
    + `</div>`;
}

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

App.state = loadState();
App.state = syncRoutines(App.state);
saveStateDebounced(App.state);
render();
window.App = App; // for feilsøking i konsollen
