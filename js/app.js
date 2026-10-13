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

App.state = loadState();
render();
window.App = App; // for feilsøking i konsollen
