import { defaultState, clone, migrate, addItem, activeItems, classifyItem, setItemCategory, setItemText, setReminder, completeItem, reopenItem, deleteItem, deferItem, undeferItem, isResurfaced, isPending, inboxItems, itemsForToday, categoryItems, somedayItems, addCategory, updateCategory, deleteCategory, reorderCategories, categoryBadge, mergeState, pruneLog } from '../js/logic.js';

export function runTests() {
  const results = [];
  function t(name, fn) {
    try { fn(); results.push({ name, ok: true }); }
    catch (e) { results.push({ name, ok: false, err: String(e && e.stack || e) }); }
  }
  function eq(a, b, msg) {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    if (sa !== sb) throw new Error((msg || 'eq') + `\n  got: ${sa}\n  exp: ${sb}`);
  }
  function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }

  t('harness virker', () => { eq(1 + 1, 2); ok(true); });

  t('defaultState har tomme lister og kategorier', () => {
    const s = defaultState();
    eq(s.items, []);
    eq(s.log, []);
    eq(s.checkRuns, {});
    ok(Array.isArray(s.settings.categories));
    eq(s.settings.remindPresets, [60, 180]);
  });
  t('clone er dyp', () => {
    const s = defaultState(); const c = clone(s);
    c.items.push({ id: 'x' });
    eq(s.items.length, 0);
  });
  t('migrate fyller manglende felt', () => {
    const s = migrate({ items: [{ id: 'a', text: 'hei' }] }, '2026-10-13');
    ok(s.settings); ok(Array.isArray(s.settings.categories));
    eq(s.items[0].text, 'hei');
  });
  t('addItem legger til uklassifisert item i Innboks', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Kjøp gave' }, { now: '2026-10-13T08:00:00Z', id: 'i1' });
    const it = s.items[0];
    eq(it.id, 'i1'); eq(it.text, 'Kjøp gave');
    eq(it.type, null); eq(it.category, null);
    eq(it.done, false); eq(it.removed, false);
    eq(it.createdAt, '2026-10-13T08:00:00Z');
    eq(it.updatedAt, '2026-10-13T08:00:00Z');
  });
  t('addItem kan ta type og kategori med en gang', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Møte', type: 'task', category: 'jobb' },
                { now: '2026-10-13T08:00:00Z', id: 'i2' });
    eq(s.items[0].type, 'task'); eq(s.items[0].category, 'jobb');
  });
  t('addItem logger', () => {
    let s = defaultState();
    s = addItem(s, { text: 'x' }, { now: '2026-10-13T08:00:00Z', id: 'i3' });
    eq(s.log.length, 1); eq(s.log[0].type, 'item'); eq(s.log[0].action, 'add');
  });
  t('activeItems filtrerer bort removed', () => {
    let s = defaultState();
    s = addItem(s, { text: 'a' }, { now: '2026-10-13T08:00:00Z', id: 'a' });
    s.items[0].removed = true;
    eq(activeItems(s).length, 0);
  });

  function mk() {
    let s = defaultState();
    s = addItem(s, { text: 'x' }, { now: '2026-10-13T08:00:00Z', id: 'i1' });
    return s;
  }
  t('classifyItem setter type og bumper updatedAt', () => {
    let s = mk();
    s = classifyItem(s, { id: 'i1', type: 'reminder' }, { now: '2026-10-13T09:00:00Z', id: 'l' });
    eq(s.items[0].type, 'reminder');
    eq(s.items[0].updatedAt, '2026-10-13T09:00:00Z');
  });
  t('classifyItem til note nullstiller frist/remind/done', () => {
    let s = mk();
    s.items[0].due = '2026-10-14'; s.items[0].remindAt = 'x'; s.items[0].done = true;
    s = classifyItem(s, { id: 'i1', type: 'note' }, { now: '2026-10-13T09:00:00Z', id: 'l' });
    eq(s.items[0].due, null); eq(s.items[0].remindAt, null); eq(s.items[0].done, false);
  });
  t('setItemCategory', () => {
    let s = mk();
    s = setItemCategory(s, { id: 'i1', category: 'hjem' }, { now: '2026-10-13T09:00:00Z', id: 'l' });
    eq(s.items[0].category, 'hjem');
  });
  t('setItemText trimmer', () => {
    let s = mk();
    s = setItemText(s, { id: 'i1', text: '  ny  ' }, { now: '2026-10-13T09:00:00Z', id: 'l' });
    eq(s.items[0].text, 'ny');
  });
  t('setReminder setter remindAt og type reminder', () => {
    let s = mk();
    s = setReminder(s, { id: 'i1', remindAt: '2026-10-13T11:00:00Z' },
                    { now: '2026-10-13T09:00:00Z', id: 'l' });
    eq(s.items[0].remindAt, '2026-10-13T11:00:00Z');
    eq(s.items[0].type, 'reminder');
  });
  t('completeItem setter done + doneAt + logger', () => {
    let s = mk();
    s = completeItem(s, { id: 'i1' }, { now: '2026-10-13T10:00:00Z', id: 'l' });
    eq(s.items[0].done, true); eq(s.items[0].doneAt, '2026-10-13T10:00:00Z');
    ok(s.log.some((e) => e.action === 'done'));
  });
  t('reopenItem nullstiller done', () => {
    let s = mk();
    s = completeItem(s, { id: 'i1' }, { now: '2026-10-13T10:00:00Z', id: 'l' });
    s = reopenItem(s, { id: 'i1' }, { now: '2026-10-13T10:05:00Z', id: 'l' });
    eq(s.items[0].done, false); eq(s.items[0].doneAt, null);
  });
  t('deleteItem er tombstone', () => {
    let s = mk();
    s = deleteItem(s, { id: 'i1' }, { now: '2026-10-13T10:00:00Z', id: 'l' });
    eq(s.items[0].removed, true);
    eq(activeItems(s).length, 0);
  });

  t('deferItem gjemmer item og setter resurfaceAt', () => {
    let s = mk();
    s = deferItem(s, { id: 'i1', resurfaceAt: '2026-10-14T08:00:00Z' },
                  { now: '2026-10-13T10:00:00Z', id: 'l' });
    eq(s.items[0].deferred, true);
    eq(s.items[0].resurfaceAt, '2026-10-14T08:00:00Z');
    ok(s.log.some((e) => e.action === 'defer'));
  });
  t('isResurfaced: deferred i framtida = ikke synlig', () => {
    const it = { deferred: true, resurfaceAt: '2026-10-14T08:00:00Z' };
    eq(isResurfaced(it, '2026-10-13T10:00:00Z'), false);
    eq(isResurfaced(it, '2026-10-14T09:00:00Z'), true);
  });
  t('isResurfaced: ikke-deferred alltid synlig', () => {
    eq(isResurfaced({ deferred: false }, '2026-10-13T10:00:00Z'), true);
  });
  t('isPending: åpen oppgave som ikke er gjemt', () => {
    const now = '2026-10-13T10:00:00Z';
    ok(isPending({ type: 'task', done: false, deferred: false, removed: false }, now));
    eq(isPending({ type: 'task', done: true, deferred: false }, now), false);
    eq(isPending({ type: 'note', done: false, deferred: false }, now), false);
    eq(isPending({ type: 'task', done: false, deferred: true, resurfaceAt: '2026-10-20T00:00:00Z' }, now), false);
  });
  t('undeferItem vekker item', () => {
    let s = mk();
    s = deferItem(s, { id: 'i1', resurfaceAt: '2026-10-20T08:00:00Z' }, { now: '2026-10-13T10:00:00Z', id: 'l' });
    s = undeferItem(s, { id: 'i1' }, { now: '2026-10-13T11:00:00Z', id: 'l' });
    eq(s.items[0].deferred, false); eq(s.items[0].resurfaceAt, null);
  });

  t('inboxItems = uklassifisert (type null) og ikke gjemt', () => {
    let s = defaultState();
    s = addItem(s, { text: 'rå' }, { now: '2026-10-13T08:00:00Z', id: 'a' });
    s = addItem(s, { text: 'klar', type: 'task', category: 'jobb' }, { now: '2026-10-13T08:00:00Z', id: 'b' });
    const inb = inboxItems(s, '2026-10-13T09:00:00Z');
    eq(inb.length, 1); eq(inb[0].id, 'a');
  });
  t('itemsFortoday: forfalt, dagens frist, remind<=nå, resurfaced', () => {
    const now = '2026-10-13T10:00:00Z';
    let s = defaultState();
    s = addItem(s, { text: 'forfalt', type: 'task', category: 'jobb' }, { now, id: 'a' });
    s.items[0].due = '2026-10-12';
    s = addItem(s, { text: 'idag', type: 'task' }, { now, id: 'b' });
    s.items[1].due = '2026-10-13';
    s = addItem(s, { text: 'senere', type: 'task' }, { now, id: 'c' });
    s.items[2].due = '2026-10-20';
    s = addItem(s, { text: 'remind', type: 'reminder' }, { now, id: 'd' });
    s.items[3].remindAt = '2026-10-13T09:00:00Z';
    const today = itemsForToday(s, now).map((i) => i.id).sort();
    eq(today, ['a', 'b', 'd']);
  });
  t('itemsForToday tar med nettopp gjen-oppdukket deferred', () => {
    const now = '2026-10-13T10:00:00Z';
    let s = defaultState();
    s = addItem(s, { text: 'tilbake', type: 'task' }, { now, id: 'a' });
    s.items[0].deferred = true; s.items[0].resurfaceAt = '2026-10-13T09:00:00Z';
    eq(itemsForToday(s, now).map((i) => i.id), ['a']);
  });
  t('categoryItems filtrerer på kategori og aktiv', () => {
    const now = '2026-10-13T10:00:00Z';
    let s = defaultState();
    s = addItem(s, { text: 'j', type: 'task', category: 'jobb' }, { now, id: 'a' });
    s = addItem(s, { text: 'h', type: 'task', category: 'hjem' }, { now, id: 'b' });
    eq(categoryItems(s, 'jobb').map((i) => i.id), ['a']);
  });
  t('somedayItems', () => {
    const now = '2026-10-13T10:00:00Z';
    let s = defaultState();
    s = addItem(s, { text: 's', type: 'someday' }, { now, id: 'a' });
    eq(somedayItems(s).map((i) => i.id), ['a']);
  });

  t('addCategory legger til med stigende order', () => {
    let s = defaultState();
    s = addCategory(s, { label: 'Trening', icon: '🏃' }, { now: '2026-10-13T08:00:00Z', id: 'trening' });
    const c = s.settings.categories.find((x) => x.id === 'trening');
    ok(c); eq(c.label, 'Trening'); eq(c.order, 3);
  });
  t('deleteCategory foreldreløser items til Innboks (category=null)', () => {
    const now = '2026-10-13T08:00:00Z';
    let s = defaultState();
    s = addItem(s, { text: 'x', type: 'task', category: 'jobb' }, { now, id: 'a' });
    s = deleteCategory(s, { id: 'jobb' }, { now, id: 'l' });
    eq(s.settings.categories.some((c) => c.id === 'jobb'), false);
    eq(s.items[0].category, null);
  });
  t('categoryBadge: hot når forfalt/i dag, open ellers, calm når tomt', () => {
    const now = '2026-10-13T10:00:00Z';
    let s = defaultState();
    eq(categoryBadge(s, 'jobb', now).level, 'calm');
    s = addItem(s, { text: 'a', type: 'task', category: 'jobb' }, { now, id: 'a' });
    eq(categoryBadge(s, 'jobb', now).level, 'open');
    eq(categoryBadge(s, 'jobb', now).count, 1);
    s.items[0].due = '2026-10-12';
    eq(categoryBadge(s, 'jobb', now).level, 'hot');
  });
  t('categoryBadge teller ikke gjemte/fullførte', () => {
    const now = '2026-10-13T10:00:00Z';
    let s = defaultState();
    s = addItem(s, { text: 'a', type: 'task', category: 'jobb' }, { now, id: 'a' });
    s.items[0].done = true;
    eq(categoryBadge(s, 'jobb', now).count, 0);
  });

  t('mergeState: items LWW per id på updatedAt', () => {
    const now = '2026-10-13T08:00:00Z';
    let a = addItem(defaultState(), { text: 'gammel' }, { now, id: 'x' });
    let b = clone(a);
    a.items[0].text = 'A'; a.items[0].updatedAt = '2026-10-13T09:00:00Z';
    b.items[0].text = 'B'; b.items[0].updatedAt = '2026-10-13T10:00:00Z';
    const m = mergeState(a, b);
    eq(m.items[0].text, 'B');
  });
  t('mergeState: tombstone vinner når nyest', () => {
    const now = '2026-10-13T08:00:00Z';
    let a = addItem(defaultState(), { text: 'x' }, { now, id: 'x' });
    let b = clone(a);
    b.items[0].removed = true; b.items[0].updatedAt = '2026-10-13T11:00:00Z';
    const m = mergeState(a, b);
    eq(m.items[0].removed, true);
  });
  t('mergeState: nye items fra begge kommer med', () => {
    const now = '2026-10-13T08:00:00Z';
    let a = addItem(defaultState(), { text: 'a' }, { now, id: 'a' });
    let b = addItem(defaultState(), { text: 'b' }, { now, id: 'b' });
    const m = mergeState(a, b);
    eq(m.items.map((i) => i.id).sort(), ['a', 'b']);
  });
  t('mergeState: settings LWW på updatedAt', () => {
    let a = defaultState(); let b = defaultState();
    a.settings.shortcutName = 'A'; a.settings.updatedAt = '2026-10-13T09:00:00Z';
    b.settings.shortcutName = 'B'; b.settings.updatedAt = '2026-10-13T10:00:00Z';
    eq(mergeState(a, b).settings.shortcutName, 'B');
  });
  t('mergeState: log union-by-id', () => {
    const now = '2026-10-13T08:00:00Z';
    let a = addItem(defaultState(), { text: 'a' }, { now, id: 'a' });
    let b = addItem(defaultState(), { text: 'b' }, { now, id: 'b' });
    eq(mergeState(a, b).log.length, 2);
  });
  t('pruneLog beholder nyeste N', () => {
    let s = defaultState();
    for (let i = 0; i < 10; i++) s.log.push({ id: 'e' + i, at: '2026-10-13T0' + i + ':00:00Z' });
    const p = pruneLog(s, 3);
    eq(p.log.length, 3); eq(p.log[2].id, 'e9');
  });

  return results;
}
