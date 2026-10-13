import * as L from './logic.js';
import { loadState, saveStateDebounced, nowIso, newId } from './store.js';

const App = { view: 'home', catId: null, sheet: null, state: null };

function ctx() { return { now: nowIso(), id: newId() }; }
function commit(next) { App.state = next; saveStateDebounced(App.state); render(); }

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
  const v = App.view;
  if (v === 'category') root.innerHTML = renderCategory();
  else if (v === 'inbox') root.innerHTML = renderInbox();
  else if (v === 'today') root.innerHTML = renderToday();
  else if (v === 'settings') root.innerHTML = renderSettings();
  else root.innerHTML = renderHome();
  bind(root);
}

function bind(root) {
  root.querySelectorAll('[data-cat]').forEach((el) =>
    el.onclick = () => { App.view = 'category'; App.catId = el.dataset.cat; render(); });
  root.querySelectorAll('[data-view]').forEach((el) =>
    el.onclick = () => { App.view = el.dataset.view; render(); });
  const cap = root.querySelector('[data-cap]');
  if (cap) cap.onclick = () => openSheet(null);
  root.querySelectorAll('[data-home]').forEach((el) =>
    el.onclick = () => { App.view = 'home'; App.catId = null; render(); });
  root.querySelectorAll('[data-done]').forEach((el) =>
    el.onclick = () => doComplete(el.dataset.done, el));
  root.querySelectorAll('[data-defer]').forEach((el) =>
    el.onclick = () => openDefer(el.dataset.defer));
  root.querySelectorAll('[data-edit]').forEach((el) =>
    el.onclick = () => openEdit(el.dataset.edit));
}

const TYPES = [
  { id: 'note', label: '📝 Notat' },
  { id: 'task', label: '✅ Oppgave' },
  { id: 'reminder', label: '⏰ Påminnelse' },
  { id: 'someday', label: '💛 På et tidspunkt' },
];

function openSheet(prefillCat) {
  App.sheet = { editId: null, text: '', type: null, category: prefillCat || null };
  renderSheet();
}
function openEdit(id) {
  const it = App.state.items.find((i) => i.id === id);
  if (!it) return;
  App.sheet = { editId: id, text: it.text || '', type: it.type || null, category: it.category || null };
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
render();
window.App = App; // for feilsøking i konsollen
