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
