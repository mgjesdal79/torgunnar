// PandaCoins ren logikk. Ingen DOM/nett/globaler.

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
  out.log = out.log.slice(-LOG_KEEP);
  return out;
}

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

export function addMinutesIso(iso, minutes) {
  return new Date(new Date(iso).getTime() + minutes * 60000).toISOString();
}
