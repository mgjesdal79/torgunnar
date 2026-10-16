import * as L from './logic.js';
import { loadState, saveStateDebounced, nowIso, todayIso, newId } from './store.js';

const App = { view: 'home', catId: null, sheet: null, state: null, rOpen: {}, routineEdit: null };

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
  const mediumN = L.mediumBadge(App.state);
  const special = tileHtml('💛', 'På et tidspunkt', mediumN, 'data-view="medium"')
    + tileHtml('📥', 'Innboks', { count: inboxN, level: inboxN ? 'hot' : 'calm' }, 'data-view="inbox"')
    + tileHtml('📌', 'I dag', { count: todayN, level: todayN ? 'open' : 'calm' }, 'data-view="today"')
    + tileHtml('🔁', 'Rutiner', null, 'data-view="routines"')
    + tileHtml('⚙️', 'Innstillinger', null, 'data-view="settings"');
  return `<div class="banner"><div class="b">🦸‍♂️ Tor Gunnar</div>`
    + `<div class="status">${esc(statusLine())}</div></div>`
    + `<div class="body">`
    + `<div class="capbar" data-cap="1"><span class="p">＋</span> Fang en tanke…</div>`
    + `<div class="grid">${catTiles}${special}</div></div>`;
}

function render() {
  const root = document.getElementById('app');
  const v = App.view;
  if (v === 'category') root.innerHTML = renderCategory();
  else if (v === 'inbox') root.innerHTML = renderInbox();
  else if (v === 'today') root.innerHTML = renderToday();
  else if (v === 'medium') root.innerHTML = renderMedium();
  else if (v === 'routines') root.innerHTML = renderRoutines();
  else if (v === 'settings') root.innerHTML = renderSettings();
  else root.innerHTML = renderHome();
  bind(root);
}

function bind(root) {
  root.querySelectorAll('[data-cat]').forEach((el) =>
    el.onclick = () => { App.view = 'category'; App.catId = el.dataset.cat; render(); });
  root.querySelectorAll('[data-view]').forEach((el) =>
    el.onclick = () => {
      App.view = el.dataset.view;
      if (App.view === 'routines') { App.state = syncRoutines(App.state); saveStateDebounced(App.state); }
      render();
    });
  const cap = root.querySelector('[data-cap]');
  if (cap) cap.onclick = () => openSheet(null, cap.dataset.captype || null);
  root.querySelectorAll('[data-home]').forEach((el) =>
    el.onclick = () => { App.view = 'home'; App.catId = null; render(); });
  root.querySelectorAll('[data-done]').forEach((el) =>
    el.onclick = () => doComplete(el.dataset.done, el));
  root.querySelectorAll('[data-defer]').forEach((el) =>
    el.onclick = () => openDefer(el.dataset.defer));
  root.querySelectorAll('[data-edit]').forEach((el) =>
    el.onclick = () => openEdit(el.dataset.edit));
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
}

const TYPES = [
  { id: 'note', label: '📝 Notat' },
  { id: 'task', label: '✅ Oppgave' },
  { id: 'reminder', label: '⏰ Påminnelse' },
  { id: 'someday', label: '💛 På et tidspunkt' },
];

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
function closeSheet() { App.sheet = null; const o = document.getElementById('ov'); if (o) o.remove(); }

function renderSheet() {
  const s = App.sheet;
  const cats = App.state.settings.categories.slice().sort((a, b) => a.order - b.order);
  const typeChips = TYPES.map((tp) =>
    `<span class="chip ${s.type === tp.id ? 'on' : ''}" data-type="${tp.id}">${tp.label}</span>`).join('');
  const catChips = cats.map((c) =>
    `<span class="chip ${s.category === c.id ? 'on' : ''}" data-catchip="${esc(c.id)}">${c.icon} ${esc(c.label)}</span>`).join('');
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
  const remindRow = s.type === 'reminder'
    ? `<div class="lab">Minn meg om…</div><div class="chips">`
      + App.state.settings.remindPresets.map((m) =>
          `<span class="chip" data-remind="${m}">+${m >= 60 ? (m / 60) + 't' : m + 'm'}</span>`).join('')
      + `</div>` : '';
  const html = `<div class="overlay" id="ov"><div class="sheet">`
    + `<input class="inp" id="capText" placeholder="Hva skal du ikke glemme?" value="${esc(s.text)}">`
    + `<div class="lab">Hva er dette? (valgfritt)</div><div class="chips">${typeChips}</div>`
    + insistRow
    + remindRow
    + `<div class="lab">Kategori (valgfritt)</div><div class="chips">${catChips}</div>`
    + `<button class="btn" id="capSave">${s.editId ? 'Lagre endringer' : 'Lagre'}</button>`
    + `<button class="btn ghost" id="capCancel">Avbryt</button>`
    + (s.editId ? `<button class="btn ghost" id="capDelete">Slett</button>` : '')
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
  o.querySelectorAll('[data-insist]').forEach((el) => el.onclick = () => {
    App.sheet.insistence = el.dataset.insist; renderSheet(); });
  o.querySelectorAll('[data-cad]').forEach((el) => el.onclick = () => {
    App.sheet.cadenceDays = Number(el.dataset.cad); renderSheet(); });
  o.querySelectorAll('[data-remind]').forEach((el) => el.onclick = () => {
    App.sheet._remindMin = Number(el.dataset.remind);
    o.querySelectorAll('[data-remind]').forEach((x) => x.classList.remove('on'));
    el.classList.add('on'); });
  o.querySelector('#capCancel').onclick = closeSheet;
  o.querySelector('#capSave').onclick = saveSheet;
  const del = o.querySelector('#capDelete');
  if (del) del.onclick = deleteFromSheet;
}

function deleteFromSheet() {
  const id = App.sheet.editId;
  App.sheet = null;
  commit(L.deleteItem(App.state, { id }, ctx()));
}

function saveSheet() {
  const s = App.sheet;
  if (!s.text.trim()) { closeSheet(); return; }
  const c = ctx();
  const id = s.editId || c.id;
  let next;
  if (s.editId) {
    next = L.setItemText(App.state, { id, text: s.text }, c);
    next = L.classifyItem(next, { id, type: s.type }, { now: c.now, id: newId() });
    next = L.setItemCategory(next, { id, category: s.category }, { now: c.now, id: newId() });
  } else {
    next = L.addItem(App.state, { text: s.text, type: s.type, category: s.category }, c);
  }
  if (s.type === 'someday') {
    next = L.setInsistence(next, { id, insistence: s.insistence, cadenceDays: s.cadenceDays },
                           { now: c.now, id: newId() });
  }
  if (s.type === 'reminder' && s._remindMin) {
    next = L.setReminder(next, { id, remindAt: L.addMinutesIso(c.now, s._remindMin) },
                         { now: c.now, id: newId() });
  }
  App.state = next; saveStateDebounced(App.state);
  closeSheet(); render();
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('no-NO', { day: '2-digit', month: '2-digit' });
}

function itemRowHtml(it) {
  const now = nowIso();
  const checkable = it.type === 'task' || it.type === 'reminder';
  const chk = checkable
    ? `<span class="chk ${it.done ? 'on' : ''}" data-done="${it.id}"></span>`
    : `<span style="width:26px"></span>`;
  const meta = [];
  if (it.due) meta.push('🗓 ' + it.due);
  if (it.remindAt) meta.push('⏰ ' + fmtTime(it.remindAt));
  if (it.deferred && it.resurfaceAt && !L.isResurfaced(it, now)) meta.push('💤 tilbake ' + fmtDate(it.resurfaceAt));
  const typeLabel = { note: 'Notat', task: 'Oppgave', reminder: 'Påminnelse', someday: 'På et tidspunkt' }[it.type] || 'Uklassifisert';
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
    + `<div class="body"><p class="sub">Fanget uten type. Trykk for å klassifisere eller slette.</p>`
    + listCard(items) + `</div>`;
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

function renderSettings() {
  return headerBar('⚙️ Innstillinger')
    + `<div class="body"><p class="sub">Kommer i egen plan (kategorier, kveldssjekk, rutiner, snarvei).</p></div>`;
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

App.state = loadState();
App.state = syncRoutines(App.state);
saveStateDebounced(App.state);
render();
window.App = App; // for feilsøking i konsollen
