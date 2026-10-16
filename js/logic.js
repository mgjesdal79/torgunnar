// Tor Gunnar ren logikk. Ingen DOM/nett/globaler.

export function clone(s) { return JSON.parse(JSON.stringify(s)); }

export function defaultState() {
  return {
    settings: {
      categories: [],
      nightly: [],
      routines: [],
      shortcutName: 'TorGunnar',
      remindPresets: [60, 180],
      somedayNudgeDays: 7,
      quotes: [],
      quotePin: null,
      updatedAt: null,
    },
    items: [],
    checkRuns: {},
    log: [],
    routineInstances: [],
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
  out.log = out.log.slice(-LOG_KEEP);
  if (!Array.isArray(out.routineInstances)) out.routineInstances = [];
  if (today) out.routineInstances = out.routineInstances.filter((i) => i.date >= today);
  return out;
}

function pushLog(out, entry) { out.log.push(entry); }

export function addItem(state, { text, type = null, category = null, source = null }, ctx) {
  const out = clone(state);
  const item = {
    id: ctx.id, text: String(text || '').trim(),
    type, category,
    done: false, doneAt: null,
    due: null, remindAt: null,
    resurfaceAt: null, deferred: false, iosPushedAt: null,
    source, routineId: null, routineDate: null, subtasks: null,
    insistence: null, cadenceDays: null,
    createdAt: ctx.now, updatedAt: ctx.now, removed: false,
  };
  out.items.push(item);
  pushLog(out, { id: ctx.id + ':add', type: 'item', action: 'add', itemId: ctx.id, at: ctx.now });
  return out;
}

export function activeItems(state) {
  return (state.items || []).filter((i) => !i.removed);
}

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

// Setter tidspunkt på et gjøremål: remindAt (fyrer i «I dag» på tid) + due (vises
// hele dagen) + gjør det til et gjøremål hvis det var utypet. Nullstiller ios-push.
export function scheduleTask(state, { id, at }, ctx) {
  return patchItem(state, id, (it) => {
    it.remindAt = at;
    it.due = (at || '').slice(0, 10);
    it.iosPushedAt = null;
    if (!it.type) it.type = 'task';
  }, ctx);
}

export function markPushedToIos(state, { id }, ctx) {
  return patchItem(state, id, (it) => { it.iosPushedAt = ctx.now; }, ctx);
}

// Ren URL-bygger for iOS-snarveien. Apples skjema: input=text + egen text-param.
export function buildShortcutUrl(shortcutName, { title, due }) {
  const payload = JSON.stringify({ title: title || '', due: due || '' });
  return 'shortcuts://run-shortcut?name=' + encodeURIComponent(shortcutName || '')
    + '&input=text&text=' + encodeURIComponent(payload);
}

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

function dayOf(iso) { return (iso || '').slice(0, 10); }

export function inboxItems(state, now) {
  return activeItems(state).filter((i) =>
    (i.type == null && i.source !== 'kona' && isResurfaced(i, now)) || nudgeDue(i, now));
}

// «Fra kona»: ubehandlet = fra kona, ennå uten type, ikke gjort/gjemt.
export function isKonaPending(item) {
  return !!item && !item.removed && !item.done
    && item.source === 'kona' && item.type == null;
}

export function konaItems(state) {
  return activeItems(state)
    .filter(isKonaPending)
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

export function konaBadge(state) {
  const count = konaItems(state).length;
  return { count, level: count ? 'open' : 'calm' };
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

// Åpne gjøremål. Timede (remindAt) først, stigende på tid; resten nyeste først.
export function taskItems(state, now) {
  return activeItems(state)
    .filter((i) => i.type === 'task' && !i.done && isResurfaced(i, now))
    .sort((a, b) => {
      if (a.remindAt && b.remindAt) return a.remindAt.localeCompare(b.remindAt);
      if (a.remindAt) return -1;
      if (b.remindAt) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
}

export function jobItems(state, now) {
  return activeItems(state)
    .filter((i) => i.type === 'job' && !i.done && isResurfaced(i, now))
    .sort((a, b) => {
      if (a.remindAt && b.remindAt) return a.remindAt.localeCompare(b.remindAt);
      if (a.remindAt) return -1;
      if (b.remindAt) return 1;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
}

// Utsatte jobber (deferred, ennå ikke tilbake). Jobb holdes utenfor «I dag»,
// så disse trenger et eget synlig sted så de ikke forsvinner sporløst.
export function deferredJobItems(state, now) {
  return activeItems(state)
    .filter((i) => i.type === 'job' && !i.done && i.deferred && !isResurfaced(i, now))
    .sort((a, b) => (a.resurfaceAt || '').localeCompare(b.resurfaceAt || ''));
}

export function noteItems(state) {
  return activeItems(state)
    .filter((i) => i.type === 'note')
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
}

function bumpSettings(out, ctx) { out.settings.updatedAt = ctx.now; }

export function setShortcutName(state, { name }, ctx) {
  const out = clone(state);
  out.settings.shortcutName = String(name || '').trim() || 'TorGunnar';
  bumpSettings(out, ctx);
  return out;
}

export const DEFAULT_QUOTES = [
  'Ingenting haster akkurat nå.',
  'Én ting av gangen.',
  'Pust. Resten venter.',
  'Det løser seg alltid.',
  'Ro er også fremgang.',
  'Du rekker det du rekker.',
  'Ta det med ro – jeg har oversikten.',
  'Verden kan vente litt.',
  'Ingenting brenner i dag.',
  'Sakte er fort nok.',
  'Du trenger ikke gjøre alt nå.',
  'Hvil er ikke sløsing.',
  'Det viktigste er at du puster.',
  'La skuldrene senke seg.',
  'Alt som må huskes, husker jeg.',
  'Ett steg. Så ett til.',
  'Stress løser ingenting.',
  'Gjør lite, gjør det rolig.',
  'I morgen finnes også.',
  'Du har tid.',
  'Ro i kroppen, ro i hodet.',
  'Det haster sjeldnere enn du tror.',
  'Pause er lov.',
  'Senk tempoet, ikke ambisjonene.',
  'En ting mindre å bekymre seg for.',
  'Det kommer til å gå bra.',
  'Pust inn. Pust ut. Fortsett.',
  'Du er god nok og du gjør nok.',
  'La dagen komme til deg.',
  'Rolig puls, klart hode.',
];

export function getQuotes(state) {
  const list = ((state.settings && state.settings.quotes) || [])
    .map((s) => String(s).trim()).filter(Boolean);
  return list.length ? list : DEFAULT_QUOTES;
}

function dayNumber(dayKey) {
  const parts = String(dayKey || '').slice(0, 10).split('-').map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

// Deterministisk daglig: samme dato → samme quote (ingen flimring ved refresh).
export function quoteForDay(state, dayKey) {
  const quotes = getQuotes(state);
  const i = ((dayNumber(dayKey) % quotes.length) + quotes.length) % quotes.length;
  return quotes[i];
}

// Det som faktisk vises: respekter en manuell pin fra i dag, ellers dagens quote.
export function currentQuote(state, dayKey) {
  const key = String(dayKey || '').slice(0, 10);
  const pin = state.settings && state.settings.quotePin;
  if (pin && pin.date === key && pin.text) return pin.text;
  return quoteForDay(state, key);
}

// «Roter nå»: tilfeldig quote ≠ den som vises nå, pinnes resten av dagen.
export function rotateQuote(state, { dayKey }, ctx) {
  const key = String(dayKey || '').slice(0, 10);
  const out = clone(state);
  const quotes = getQuotes(out);
  const now = currentQuote(out, key);
  const options = quotes.length > 1 ? quotes.filter((q) => q !== now) : quotes;
  const r = (ctx && ctx.rand != null) ? ctx.rand : Math.random();
  const next = options[Math.floor(r * options.length) % options.length];
  out.settings.quotePin = { date: key, text: next };
  bumpSettings(out, ctx);
  return out;
}

export function setQuotes(state, { text }, ctx) {
  const out = clone(state);
  out.settings.quotes = String(text || '')
    .split('\n').map((s) => s.trim()).filter(Boolean);
  bumpSettings(out, ctx);
  return out;
}

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
  // routineInstances LWW per id
  out.routineInstances = mergeListById(local.routineInstances, remote.routineInstances,
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

export function addMinutesIso(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}

// ---- Rutiner: dato-hjelpere ----
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export function weekdayKey(dateStr) {
  return WEEKDAYS[new Date(dateStr + 'T12:00:00').getDay()];
}
export function addDaysIso(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ---- Rutiner: mal-CRUD ----
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

// ---- Rutiner: instanser ----
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

// ---- Rutiner: avkryssing ----
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
