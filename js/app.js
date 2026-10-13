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

function openSheet(_prefillCat) { /* fylles i Task 13 */ }

App.state = loadState();
render();
window.App = App; // for feilsøking i konsollen
