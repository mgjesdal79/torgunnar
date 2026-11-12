import { defaultState, clone, migrate, addItem, activeItems, classifyItem, setItemCategory, setItemText, setReminder, completeItem, reopenItem, deleteItem, deferItem, undeferItem, isResurfaced, isPending, inboxItems, itemsForToday, categoryItems, somedayItems, taskItems, jobItems, reorderItems, deferredJobItems, noteItems, noteBadge, toggleNoteBadge, scheduleTask, markPushedToIos, buildShortcutUrl, setShortcutName, addCategory, updateCategory, deleteCategory, reorderCategories, categoryBadge, mergeState, pruneLog, addMinutesIso, weekdayKey, addDaysIso, addRoutine, updateRoutine, deleteRoutine, generateRoutineInstances, wakeRoutine, routineInstancesForDate, pruneRoutineInstances, sleepingRoutines, inactiveRoutines, allSubtasksDone, toggleRoutineSubtask, skipRoutineInstance, setInsistence, nudgeDue, snoozeNudge, promoteToToday, mediumItems, mediumBadge, improvementItems, improvementCategories, improvementGroups, addImprovement, setItemBody, setItemDepth, reorderImprovement, renderMarkdown, isKonaPending, konaItems, konaBadge, konaTrashItems, trashItems, restoreItem, purgeItem, purgeAllTrash, expireTrash, doneTaskItems, doneJobItems, doneSomedayItems, doneTodayItems, trashAllDone, DEFAULT_QUOTES, getQuotes, quoteForDay, currentQuote, rotateQuote, setQuotes } from '../js/logic.js';
const L = { weekdayKey, addDaysIso, addRoutine, updateRoutine, deleteRoutine, generateRoutineInstances, wakeRoutine, routineInstancesForDate, pruneRoutineInstances, sleepingRoutines, inactiveRoutines, allSubtasksDone, toggleRoutineSubtask, skipRoutineInstance, defaultState, mergeState, migrate, setInsistence, nudgeDue, snoozeNudge, promoteToToday, mediumItems, mediumBadge, improvementItems, improvementCategories, improvementGroups, addImprovement, setItemBody, setItemDepth, reorderImprovement, renderMarkdown, isKonaPending, konaItems, konaBadge, konaTrashItems, taskItems, jobItems, reorderItems, deferredJobItems, noteItems, noteBadge, toggleNoteBadge, scheduleTask, markPushedToIos, buildShortcutUrl, setShortcutName, deleteItem, trashItems, restoreItem, purgeItem, purgeAllTrash, expireTrash, doneTaskItems, doneJobItems, doneSomedayItems, doneTodayItems, trashAllDone, DEFAULT_QUOTES, getQuotes, quoteForDay, currentQuote, rotateQuote, setQuotes };

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

  t('defaultState har tomme lister og ingen kategorier', () => {
    const s = defaultState();
    eq(s.items, []);
    eq(s.log, []);
    eq(s.checkRuns, {});
    eq(s.settings.categories, []);
    eq(s.settings.remindPresets, [60, 180]);
    eq(s.settings.shortcutName, 'TorGunnar');
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
    s = addCategory(s, { label: 'Jobb', icon: '💼' }, { now: '2026-10-13T08:00:00Z', id: 'jobb' });
    s = addCategory(s, { label: 'Trening', icon: '🏃' }, { now: '2026-10-13T08:00:00Z', id: 'trening' });
    const c = s.settings.categories.find((x) => x.id === 'trening');
    ok(c); eq(c.label, 'Trening'); eq(c.order, 1);
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

  t('addMinutesIso legger til minutter', () => {
    eq(addMinutesIso('2026-10-13T08:00:00.000Z', 60), '2026-10-13T09:00:00.000Z');
    eq(addMinutesIso('2026-10-13T08:00:00.000Z', 180), '2026-10-13T11:00:00.000Z');
  });

  // ---- Rutiner: datamodell ----
  t('defaultState har routineInstances-array', () => {
    ok(Array.isArray(L.defaultState().routineInstances));
  });
  t('weekdayKey gir riktig ukedag', () => {
    eq(L.weekdayKey('2026-10-16'), 'fri'); // 16. okt 2026 er fredag
    eq(L.weekdayKey('2026-10-18'), 'sun');
  });
  t('addDaysIso legger til dager uten TZ-sprang', () => {
    eq(L.addDaysIso('2026-10-16', 1), '2026-10-17');
    eq(L.addDaysIso('2026-10-31', 1), '2026-11-01');
  });
  t('migrate initialiserer og rydder gamle routineInstances', () => {
    const s = L.defaultState();
    s.routineInstances = [
      { id: 'a:2026-10-10', date: '2026-10-10' },
      { id: 'a:2026-10-16', date: '2026-10-16' },
    ];
    const m = L.migrate(s, '2026-10-16');
    eq(m.routineInstances.length, 1);
    eq(m.routineInstances[0].date, '2026-10-16');
  });
  t('mergeState forener routineInstances per id (LWW)', () => {
    const a = L.defaultState(); a.routineInstances = [{ id: 'x', updatedAt: '2026-10-16T08:00:00Z', v: 1 }];
    const b = L.defaultState(); b.routineInstances = [{ id: 'x', updatedAt: '2026-10-16T09:00:00Z', v: 2 }, { id: 'y', updatedAt: '2026-10-16T09:00:00Z' }];
    const m = L.mergeState(a, b);
    const x = m.routineInstances.find((i) => i.id === 'x');
    eq(x.v, 2);
    eq(m.routineInstances.length, 2);
  });

  // ---- Rutiner: mal-CRUD ----
  t('addRoutine legger til mal med standardverdier', () => {
    const s = L.addRoutine(L.defaultState(), { routine: { title: 'Kveldssjekk', subtasks: [{ text: 'Lås dør' }], weekdays: ['mon'] } }, { now: 'N', id: 'r1' });
    const r = s.settings.routines[0];
    eq(r.id, 'r1'); eq(r.title, 'Kveldssjekk');
    eq(r.enabled, true); eq(r.sleeping, false); eq(r.leadDay, false);
    eq(r.subtasks.length, 1); ok(r.subtasks[0].id);
    eq(s.settings.updatedAt, 'N');
  });
  t('updateRoutine patcher og bumper updatedAt', () => {
    let s = L.addRoutine(L.defaultState(), { routine: { title: 'A' } }, { now: 'N1', id: 'r1' });
    s = L.updateRoutine(s, { id: 'r1', patch: { title: 'B', sleeping: true } }, { now: 'N2', id: 'x' });
    eq(s.settings.routines[0].title, 'B');
    eq(s.settings.routines[0].sleeping, true);
    eq(s.settings.routines[0].updatedAt, 'N2');
  });
  t('deleteRoutine fjerner mal og dens instanser', () => {
    let s = L.addRoutine(L.defaultState(), { routine: { title: 'A' } }, { now: 'N', id: 'r1' });
    s.routineInstances = [{ id: 'r1:2026-10-16', routineId: 'r1', date: '2026-10-16' }];
    s = L.deleteRoutine(s, { id: 'r1' }, { now: 'N2', id: 'x' });
    eq(s.settings.routines.length, 0);
    eq(s.routineInstances.length, 0);
  });
  t('updateRoutine på ukjent id returnerer uendret', () => {
    const s0 = L.defaultState();
    const s1 = L.updateRoutine(s0, { id: 'nope', patch: { title: 'X' } }, { now: 'N', id: 'x' });
    eq(s1, s0);
  });

  // ---- Rutiner: generering/vekking/rydding ----
  function routineState() {
    return L.addRoutine(L.defaultState(), { routine: { title: 'Kveld', subtasks: [{ text: 'Lås' }], weekdays: ['fri'] } }, { now: 'N', id: 'r1' });
  }
  t('generateRoutineInstances lager instans på matchende ukedag', () => {
    const s = L.generateRoutineInstances(routineState(), '2026-10-16', { now: 'N' }); // fredag
    eq(s.routineInstances.length, 1);
    eq(s.routineInstances[0].id, 'r1:2026-10-16');
    eq(s.routineInstances[0].subtasks[0].done, false);
  });
  t('generateRoutineInstances lager ingenting på ikke-matchende dag', () => {
    const s = L.generateRoutineInstances(routineState(), '2026-10-17', { now: 'N' }); // lørdag
    eq(s.routineInstances.length, 0);
  });
  t('generateRoutineInstances er idempotent', () => {
    let s = L.generateRoutineInstances(routineState(), '2026-10-16', { now: 'N' });
    s = L.generateRoutineInstances(s, '2026-10-16', { now: 'N' });
    eq(s.routineInstances.length, 1);
  });
  t('leadDay lager også morgendagens instans', () => {
    let s = L.addRoutine(L.defaultState(), { routine: { title: 'Man', weekdays: ['mon'], leadDay: true } }, { now: 'N', id: 'r1' });
    s = L.generateRoutineInstances(s, '2026-10-18', { now: 'N' }); // søndag, i morgen = mandag
    ok(s.routineInstances.some((i) => i.id === 'r1:2026-10-19'));
  });
  t('sovende maler genereres ikke automatisk', () => {
    let s = L.addRoutine(L.defaultState(), { routine: { title: 'S', weekdays: ['fri'], sleeping: true } }, { now: 'N', id: 'r1' });
    s = L.generateRoutineInstances(s, '2026-10-16', { now: 'N' });
    eq(s.routineInstances.length, 0);
  });
  t('wakeRoutine materialiserer instans for i dag', () => {
    let s = L.addRoutine(L.defaultState(), { routine: { title: 'S', sleeping: true, subtasks: [{ text: 'X' }] } }, { now: 'N', id: 'r1' });
    s = L.wakeRoutine(s, { id: 'r1', date: '2026-10-16' }, { now: 'N2' });
    eq(s.routineInstances.length, 1);
    eq(s.routineInstances[0].id, 'r1:2026-10-16');
  });
  t('routineInstancesForDate skjuler skippede', () => {
    let s = L.wakeRoutine(L.addRoutine(L.defaultState(), { routine: { title: 'S', sleeping: true } }, { now: 'N', id: 'r1' }), { id: 'r1', date: '2026-10-16' }, { now: 'N2' });
    eq(L.routineInstancesForDate(s, '2026-10-16').length, 1);
    s.routineInstances[0].skipped = true;
    eq(L.routineInstancesForDate(s, '2026-10-16').length, 0);
  });
  t('pruneRoutineInstances dropper gamle datoer', () => {
    const s = L.defaultState();
    s.routineInstances = [{ id: 'a', date: '2026-10-10' }, { id: 'b', date: '2026-10-16' }];
    const p = L.pruneRoutineInstances(s, '2026-10-16');
    eq(p.routineInstances.length, 1);
  });
  t('inactiveRoutines lister alle rutiner uten aktiv instans i dag', () => {
    let s = L.addRoutine(L.defaultState(), { routine: { title: 'A' } }, { now: 'N', id: 'r1' });
    s = L.addRoutine(s, { routine: { title: 'B' } }, { now: 'N', id: 'r2' });
    eq(L.inactiveRoutines(s, '2026-10-16').length, 2);
    s = L.wakeRoutine(s, { id: 'r1', date: '2026-10-16' }, { now: 'N2' });
    const inact = L.inactiveRoutines(s, '2026-10-16');
    eq(inact.length, 1);
    eq(inact[0].id, 'r2');
  });
  t('inactiveRoutines teller bortlagt (skipped) som inaktiv igjen', () => {
    let s = L.addRoutine(L.defaultState(), { routine: { title: 'A' } }, { now: 'N', id: 'r1' });
    s = L.wakeRoutine(s, { id: 'r1', date: '2026-10-16' }, { now: 'N2' });
    eq(L.inactiveRoutines(s, '2026-10-16').length, 0);
    s = L.skipRoutineInstance(s, { instanceId: 'r1:2026-10-16' }, { now: 'N3' });
    eq(L.inactiveRoutines(s, '2026-10-16').length, 1);
  });

  // ---- Rutiner: avkryssing ----
  function wokenInst() {
    const s = L.addRoutine(L.defaultState(), { routine: { title: 'S', sleeping: true, subtasks: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] } }, { now: 'N', id: 'r1' });
    return L.wakeRoutine(s, { id: 'r1', date: '2026-10-16' }, { now: 'N2' });
  }
  t('toggleRoutineSubtask huker av og setter done når alt er gjort', () => {
    let s = wokenInst();
    const iid = 'r1:2026-10-16';
    s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'a' }, { now: 'N3' });
    eq(s.routineInstances[0].done, false);
    s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'b' }, { now: 'N4' });
    eq(s.routineInstances[0].done, true);
    eq(s.routineInstances[0].doneAt, 'N4');
  });
  t('toggleRoutineSubtask av igjen nullstiller done', () => {
    let s = wokenInst();
    const iid = 'r1:2026-10-16';
    s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'a' }, { now: 'N3' });
    s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'b' }, { now: 'N4' });
    s = L.toggleRoutineSubtask(s, { instanceId: iid, subId: 'a' }, { now: 'N5' });
    eq(s.routineInstances[0].done, false);
    eq(s.routineInstances[0].doneAt, null);
  });
  t('allSubtasksDone: tom liste er ikke done', () => {
    eq(L.allSubtasksDone({ subtasks: [] }), false);
    eq(L.allSubtasksDone({ subtasks: [{ done: true }] }), true);
  });
  t('skipRoutineInstance markerer skipped', () => {
    let s = wokenInst();
    s = L.skipRoutineInstance(s, { instanceId: 'r1:2026-10-16' }, { now: 'N3' });
    eq(s.routineInstances[0].skipped, true);
  });

  // ---- Mellomlang liste («På et tidspunkt») ----
  function somedayState() {
    let s = defaultState();
    s = addItem(s, { text: 'Støvler', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'm1' });
    return s;
  }
  t('setInsistence nudge setter cadence + resurfaceAt', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    const it = s.items[0];
    eq(it.insistence, 'nudge'); eq(it.cadenceDays, 7);
    eq(it.resurfaceAt, '2026-10-23T08:00:00.000Z');
  });
  t('setInsistence chill nullstiller cadence/resurfaceAt', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    s = L.setInsistence(s, { id: 'm1', insistence: 'chill' }, { now: '2026-10-16T08:00:00.000Z' });
    eq(s.items[0].cadenceDays, null); eq(s.items[0].resurfaceAt, null);
  });
  t('nudgeDue: forfalt dult-sak er due, framtidig er ikke', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    eq(L.nudgeDue(s.items[0], '2026-10-20T08:00:00.000Z'), false);
    eq(L.nudgeDue(s.items[0], '2026-10-30T08:00:00.000Z'), true);
  });
  t('nudgeDue: chill-sak er aldri due', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'chill' }, { now: '2026-10-16T08:00:00.000Z' });
    eq(L.nudgeDue(s.items[0], '2026-11-30T08:00:00.000Z'), false);
  });
  t('inboxItems tar med forfalt dult-sak + uklassifisert', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Uklar' }, { now: '2026-10-16T08:00:00.000Z', id: 'u1' });
    s = addItem(s, { text: 'Støvler', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'm1' });
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    const ids = inboxItems(s, '2026-10-30T08:00:00.000Z').map((i) => i.id).sort();
    eq(ids, ['m1', 'u1']);
    const ids2 = inboxItems(s, '2026-10-20T08:00:00.000Z').map((i) => i.id);
    eq(ids2, ['u1']);
  });
  t('snoozeNudge flytter resurfaceAt fram med cadence', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nudge', cadenceDays: 3 }, { now: '2026-10-16T08:00:00.000Z' });
    s = L.snoozeNudge(s, { id: 'm1' }, { now: '2026-10-25T08:00:00.000Z' });
    eq(s.items[0].resurfaceAt, '2026-10-28T08:00:00.000Z');
  });
  t('promoteToToday gjør someday til task med forfall i dag', () => {
    let s = somedayState();
    s = L.setInsistence(s, { id: 'm1', insistence: 'nag' }, { now: '2026-10-16T08:00:00.000Z' });
    s = L.promoteToToday(s, { id: 'm1' }, { now: '2026-10-16T08:00:00.000Z' });
    const it = s.items[0];
    eq(it.type, 'task'); eq(it.due, '2026-10-16'); eq(it.insistence, null);
    const today = itemsForToday(s, '2026-10-16T09:00:00.000Z').map((i) => i.id);
    eq(today, ['m1']);
  });
  t('mediumItems: someday ikke-done sortert nag→nudge→chill', () => {
    let s = defaultState();
    s = addItem(s, { text: 'C', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'c' });
    s = addItem(s, { text: 'A', type: 'someday' }, { now: '2026-10-16T08:00:01.000Z', id: 'a' });
    s = addItem(s, { text: 'B', type: 'someday' }, { now: '2026-10-16T08:00:02.000Z', id: 'b' });
    s = L.setInsistence(s, { id: 'c', insistence: 'chill' }, { now: 'N' });
    s = L.setInsistence(s, { id: 'a', insistence: 'nag' }, { now: 'N' });
    s = L.setInsistence(s, { id: 'b', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    eq(L.mediumItems(s).map((i) => i.id), ['a', 'b', 'c']);
  });
  t('mediumItems utelater done', () => {
    let s = somedayState();
    s = completeItem(s, { id: 'm1' }, { now: 'N' });
    eq(L.mediumItems(s).length, 0);
  });
  t('mediumItems: manuell order styrer innen samme mase-gruppe', () => {
    let s = defaultState();
    s = addItem(s, { text: 'A', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'B', type: 'someday' }, { now: '2026-10-16T08:00:01.000Z', id: 'b' });
    s = addItem(s, { text: 'C', type: 'someday' }, { now: '2026-10-16T08:00:02.000Z', id: 'c' });
    // alle chill (default) → uten order: nyeste først
    eq(L.mediumItems(s).map((i) => i.id), ['c', 'b', 'a']);
    // dra a øverst
    s = L.reorderItems(s, { orderedIds: ['a', 'c', 'b'] }, { now: 'N' });
    eq(L.mediumItems(s).map((i) => i.id), ['a', 'c', 'b']);
  });
  t('migrate backfiller order på langsiktig (someday)', () => {
    let s = defaultState();
    s = addItem(s, { text: 'A', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'B', type: 'someday' }, { now: '2026-10-16T08:00:01.000Z', id: 'b' });
    s.items.forEach((i) => { delete i.order; });
    const m = migrate(s);
    const ao = m.items.find((i) => i.id === 'a').order;
    const bo = m.items.find((i) => i.id === 'b').order;
    // nyeste (B) får lavest order → øverst, som før
    if (!(bo < ao)) throw new Error('forventet B over A etter backfill');
  });
  t('mediumBadge teller kun nag', () => {
    let s = defaultState();
    s = addItem(s, { text: 'A', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'B', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'b' });
    s = L.setInsistence(s, { id: 'a', insistence: 'nag' }, { now: 'N' });
    s = L.setInsistence(s, { id: 'b', insistence: 'chill' }, { now: 'N' });
    eq(L.mediumBadge(s), { count: 1, level: 'open' });
  });
  t('mediumBadge teller nag + forfalt dult', () => {
    let s = defaultState();
    s = addItem(s, { text: 'nag', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'dult', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'b' });
    s = L.setInsistence(s, { id: 'a', insistence: 'nag' }, { now: '2026-10-16T08:00:00.000Z' });
    s = L.setInsistence(s, { id: 'b', insistence: 'nudge', cadenceDays: 7 }, { now: '2026-10-16T08:00:00.000Z' });
    // Før dult forfaller: kun nag.
    eq(L.mediumBadge(s, '2026-10-20T08:00:00.000Z'), { count: 1, level: 'open' });
    // Etter dult forfaller: nag + dult.
    eq(L.mediumBadge(s, '2026-10-30T08:00:00.000Z'), { count: 2, level: 'open' });
  });

  // === Forbedring (🌱) ===
  t('addItem default body er null', () => {
    let s = defaultState();
    s = addItem(s, { text: 'x', type: 'task' }, { now: 'N', id: 'a' });
    eq(s.items[0].body, null);
  });
  t('addImprovement lager type improvement med body', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'Tittel', body: '**fet**' }, { now: 'N', id: 'a' });
    const it = s.items[0];
    eq(it.type, 'improvement');
    eq(it.text, 'Tittel');
    eq(it.body, '**fet**');
    eq(it.done, false);
  });
  t('addImprovement uten body gir null', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'Tittel' }, { now: 'N', id: 'a' });
    eq(s.items[0].body, null);
  });
  t('improvementItems: kun improvement, nyeste først', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a' }, { now: '2026-11-01T08:00:00Z', id: 'a' });
    s = L.addImprovement(s, { text: 'b' }, { now: '2026-11-02T08:00:00Z', id: 'b' });
    s = addItem(s, { text: 't', type: 'task' }, { now: '2026-11-03T08:00:00Z', id: 't' });
    eq(L.improvementItems(s).map((i) => i.id), ['b', 'a']);
  });
  t('improvementItems utelater slettede', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a' }, { now: 'N', id: 'a' });
    s = L.deleteItem(s, { id: 'a' }, { now: 'N2' });
    eq(L.improvementItems(s).length, 0);
  });
  t('addImprovement tar med kategori (trimmet); tom → null', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a', category: '  Oppgaver ' }, { now: 'N', id: 'a' });
    eq(s.items.find((i) => i.id === 'a').category, 'Oppgaver');
    s = L.addImprovement(s, { text: 'b', category: '   ' }, { now: 'N', id: 'b' });
    eq(s.items.find((i) => i.id === 'b').category, null);
  });
  t('improvementCategories: distinkte, sortert, uten tomme', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a', category: 'Egenpleie' }, { now: 'N', id: 'a' });
    s = L.addImprovement(s, { text: 'b', category: 'Oppgaver' }, { now: 'N', id: 'b' });
    s = L.addImprovement(s, { text: 'c', category: 'Oppgaver' }, { now: 'N', id: 'c' });
    s = L.addImprovement(s, { text: 'd' }, { now: 'N', id: 'd' });
    eq(L.improvementCategories(s), ['Egenpleie', 'Oppgaver']);
  });
  t('improvementGroups: navngitte alfabetisk først, uten-kategori sist', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'u' }, { now: 'N', id: 'u' });
    s = L.addImprovement(s, { text: 'o', category: 'Oppgaver' }, { now: 'N', id: 'o' });
    s = L.addImprovement(s, { text: 'a', category: 'Anerkjennelse' }, { now: 'N', id: 'a' });
    const g = L.improvementGroups(s);
    eq(g.map((x) => x.category), ['Anerkjennelse', 'Oppgaver', null]);
    eq(g[2].items.map((i) => i.id), ['u']);
  });
  t('improvementGroups tom state → tom liste', () => {
    eq(L.improvementGroups(defaultState()).length, 0);
  });
  t('setItemBody trimmer og bumper updatedAt', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a', body: 'gammel' }, { now: 'N', id: 'a' });
    s = L.setItemBody(s, { id: 'a', body: '  ny  ' }, { now: 'N2' });
    eq(s.items[0].body, 'ny');
    eq(s.items[0].updatedAt, 'N2');
  });
  t('setItemBody med null gir null', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a', body: 'noe' }, { now: 'N', id: 'a' });
    s = L.setItemBody(s, { id: 'a', body: null }, { now: 'N2' });
    eq(s.items[0].body, null);
  });

  // === Forbedring: dybde-felt + manuell rekkefølge (build23) ===
  t('addImprovement tar med depth; uten depth → null', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a', depth: '## Dypt' }, { now: 'N', id: 'a' });
    eq(s.items[0].depth, '## Dypt');
    s = L.addImprovement(s, { text: 'b' }, { now: 'N', id: 'b' });
    eq(s.items.find((i) => i.id === 'b').depth, null);
  });
  t('setItemDepth trimmer og bumper updatedAt; null → null', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a' }, { now: 'N', id: 'a' });
    s = L.setItemDepth(s, { id: 'a', depth: '  dyp  ' }, { now: 'N2' });
    eq(s.items[0].depth, 'dyp');
    eq(s.items[0].updatedAt, 'N2');
    s = L.setItemDepth(s, { id: 'a', depth: null }, { now: 'N3' });
    eq(s.items[0].depth, null);
  });
  t('addImprovement: nye legger seg øverst (lavest order)', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a' }, { now: '2026-11-01T08:00:00Z', id: 'a' });
    s = L.addImprovement(s, { text: 'b' }, { now: '2026-11-02T08:00:00Z', id: 'b' });
    s = L.addImprovement(s, { text: 'c' }, { now: '2026-11-03T08:00:00Z', id: 'c' });
    eq(L.improvementItems(s).map((i) => i.id), ['c', 'b', 'a']);
  });
  t('reorderImprovement: flytt opp bytter med naboen over', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a' }, { now: '2026-11-01T08:00:00Z', id: 'a' });
    s = L.addImprovement(s, { text: 'b' }, { now: '2026-11-02T08:00:00Z', id: 'b' });
    // rekkefølge nå: b, a (nyest øverst). Flytt a opp → a, b
    s = L.reorderImprovement(s, { id: 'a', dir: 'up' }, { now: 'N3' });
    eq(L.improvementItems(s).map((i) => i.id), ['a', 'b']);
  });
  t('reorderImprovement: flytt ned bytter med naboen under', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a' }, { now: '2026-11-01T08:00:00Z', id: 'a' });
    s = L.addImprovement(s, { text: 'b' }, { now: '2026-11-02T08:00:00Z', id: 'b' });
    // rekkefølge: b, a. Flytt b ned → a, b
    s = L.reorderImprovement(s, { id: 'b', dir: 'down' }, { now: 'N3' });
    eq(L.improvementItems(s).map((i) => i.id), ['a', 'b']);
  });
  t('reorderImprovement: ingen-op i endene', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a' }, { now: '2026-11-01T08:00:00Z', id: 'a' });
    s = L.addImprovement(s, { text: 'b' }, { now: '2026-11-02T08:00:00Z', id: 'b' });
    const before = L.improvementItems(s).map((i) => i.id); // ['b','a']
    s = L.reorderImprovement(s, { id: 'b', dir: 'up' }, { now: 'N3' });   // allerede øverst
    s = L.reorderImprovement(s, { id: 'a', dir: 'down' }, { now: 'N4' }); // allerede nederst
    eq(L.improvementItems(s).map((i) => i.id), before);
  });
  t('reorderImprovement bumper updatedAt på begge byttede', () => {
    let s = defaultState();
    s = L.addImprovement(s, { text: 'a' }, { now: '2026-11-01T08:00:00Z', id: 'a' });
    s = L.addImprovement(s, { text: 'b' }, { now: '2026-11-02T08:00:00Z', id: 'b' });
    s = L.reorderImprovement(s, { id: 'a', dir: 'up' }, { now: 'N3' });
    eq(s.items.find((i) => i.id === 'a').updatedAt, 'N3');
    eq(s.items.find((i) => i.id === 'b').updatedAt, 'N3');
  });
  t('migrate backfiller order på gamle forbedringer (nyest øverst)', () => {
    const raw = { items: [
      { id: 'a', type: 'improvement', text: 'a', createdAt: '2026-11-01T08:00:00Z' },
      { id: 'b', type: 'improvement', text: 'b', createdAt: '2026-11-03T08:00:00Z' },
      { id: 'c', type: 'improvement', text: 'c', createdAt: '2026-11-02T08:00:00Z' },
    ] };
    const s = L.migrate(raw, '2026-11-05');
    // nyest (b) skal få lavest order → øverst; så c; så a
    eq(L.improvementItems(s).map((i) => i.id), ['b', 'c', 'a']);
  });

  // === renderMarkdown ===
  t('renderMarkdown: fet og kursiv', () => {
    eq(L.renderMarkdown('**Hei** og *der*'), '<p><strong>Hei</strong> og <em>der</em></p>');
  });
  t('renderMarkdown: overskrifter', () => {
    eq(L.renderMarkdown('# A\n## B\n### C'), '<h3>A</h3><h4>B</h4><h5>C</h5>');
  });
  t('renderMarkdown: punktliste', () => {
    eq(L.renderMarkdown('- a\n- b'), '<ul><li>a</li><li>b</li></ul>');
  });
  t('renderMarkdown: nummerert liste', () => {
    eq(L.renderMarkdown('1. a\n2. b'), '<ol><li>a</li><li>b</li></ol>');
  });
  t('renderMarkdown: avsnitt med linjeskift', () => {
    eq(L.renderMarkdown('a\nb\n\nc'), '<p>a<br>b</p><p>c</p>');
  });
  t('renderMarkdown: fet inne i punkt', () => {
    eq(L.renderMarkdown('- **Utfordring:** noe'),
      '<ul><li><strong>Utfordring:</strong> noe</li></ul>');
  });
  t('renderMarkdown: escaper HTML (XSS-trygt)', () => {
    eq(L.renderMarkdown('<script>alert(1)</script>'),
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  });
  t('renderMarkdown: tom/null gir tom streng', () => {
    eq(L.renderMarkdown(''), '');
    eq(L.renderMarkdown(null), '');
  });

  // === Fra kona ===
  t('addItem med source=kona setter feltet; uten source → null', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Handle melk', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'k1' });
    s = addItem(s, { text: 'Egen tanke' }, { now: '2026-10-16T08:00:01.000Z', id: 'n1' });
    eq(s.items.find((i) => i.id === 'k1').source, 'kona');
    eq(s.items.find((i) => i.id === 'n1').source, null);
  });
  t('konaItems: kun ubehandlede kona-lapper, nyeste først', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Eldst', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'k1' });
    s = addItem(s, { text: 'Nyest', source: 'kona' }, { now: '2026-10-16T08:00:02.000Z', id: 'k2' });
    s = addItem(s, { text: 'Ikke kona' }, { now: '2026-10-16T08:00:01.000Z', id: 'n1' });
    eq(L.konaItems(s).map((i) => i.id), ['k2', 'k1']);
  });
  t('konaItems utelater behandlede (fått type)', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Handle melk', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'k1' });
    s = classifyItem(s, { id: 'k1', type: 'task' }, { now: 'N' });
    eq(L.konaItems(s).length, 0);
  });
  t('konaItems utelater done og removed', () => {
    let s = defaultState();
    s = addItem(s, { text: 'A', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'B', source: 'kona' }, { now: '2026-10-16T08:00:01.000Z', id: 'b' });
    s = deleteItem(s, { id: 'a' }, { now: 'N' });
    s = completeItem(s, { id: 'b' }, { now: 'N' });
    eq(L.konaItems(s).length, 0);
  });
  t('isKonaPending', () => {
    ok(L.isKonaPending({ source: 'kona', type: null }));
    ok(!L.isKonaPending({ source: 'kona', type: 'task' }));
    ok(!L.isKonaPending({ source: null, type: null }));
    ok(!L.isKonaPending({ source: 'kona', type: null, done: true }));
    ok(!L.isKonaPending({ source: 'kona', type: null, removed: true }));
    ok(!L.isKonaPending(null));
  });
  t('konaBadge teller ubehandlede', () => {
    let s = defaultState();
    eq(L.konaBadge(s), { count: 0, level: 'calm' });
    s = addItem(s, { text: 'A', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'B', source: 'kona' }, { now: '2026-10-16T08:00:01.000Z', id: 'b' });
    eq(L.konaBadge(s), { count: 2, level: 'open' });
  });
  t('konaTrashItems: slettet kona-lapp havner i egen liste, ikke i søppelkassa', () => {
    let s = defaultState();
    s = addItem(s, { text: 'A', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = deleteItem(s, { id: 'a' }, { now: 'N' });
    eq(L.konaTrashItems(s).map((i) => i.id), ['a']);
    eq(L.konaItems(s).length, 0);
    eq(L.trashItems(s).length, 0); // holdes utenfor den vanlige søppelkassa
  });
  t('konaTrashItems nyeste først; gjenoppretting setter tilbake i lista', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Eldst', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'Nyest', source: 'kona' }, { now: '2026-10-16T08:00:01.000Z', id: 'b' });
    s = deleteItem(s, { id: 'a' }, { now: '2026-10-16T09:00:00.000Z' });
    s = deleteItem(s, { id: 'b' }, { now: '2026-10-16T10:00:00.000Z' });
    eq(L.konaTrashItems(s).map((i) => i.id), ['b', 'a']);
    s = L.restoreItem(s, { id: 'b' }, { now: 'N' });
    eq(L.konaTrashItems(s).map((i) => i.id), ['a']);
    ok(L.konaItems(s).some((i) => i.id === 'b'));
  });
  t('triagert kona-lapp som slettes går til vanlig søppelkasse', () => {
    let s = defaultState();
    s = addItem(s, { text: 'A', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = classifyItem(s, { id: 'a', type: 'task' }, { now: 'N' });
    s = deleteItem(s, { id: 'a' }, { now: 'N2' });
    eq(L.konaTrashItems(s).length, 0);
    eq(L.trashItems(s).map((i) => i.id), ['a']);
  });
  t('inboxItems ekskluderer kona, beholder vanlige untypede', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Kona-lapp', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'k1' });
    s = addItem(s, { text: 'Egen tanke' }, { now: '2026-10-16T08:00:01.000Z', id: 'n1' });
    const ids = inboxItems(s, '2026-10-16T09:00:00.000Z').map((i) => i.id);
    eq(ids, ['n1']);
  });
  t('konvertering flytter kona-lapp fra konaItems til mediumItems', () => {
    let s = defaultState();
    s = addItem(s, { text: 'Planlegg ferie', source: 'kona' }, { now: '2026-10-16T08:00:00.000Z', id: 'k1' });
    s = classifyItem(s, { id: 'k1', type: 'someday' }, { now: 'N' });
    eq(L.konaItems(s).length, 0);
    eq(L.mediumItems(s).map((i) => i.id), ['k1']);
  });

  // === Gjøremål / tid / Påminnelser (build 7) ===
  t('taskItems: uten manuell order ligger nyeste øverst (tid flytter ikke lenger raden)', () => {
    const now = '2026-10-16T08:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'eldst', type: 'task' }, { now: '2026-10-16T07:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'midt', type: 'task' }, { now: '2026-10-16T07:30:00.000Z', id: 'b' });
    s = addItem(s, { text: 'nyest', type: 'task' }, { now, id: 'c' });
    // En gammel rad får et klokkeslett – den skal likevel bli liggende (manuell styring vinner).
    s = L.scheduleTask(s, { id: 'a', at: '2026-10-16T09:00:00.000Z' }, { now });
    eq(L.taskItems(s, now).map((i) => i.id), ['c', 'b', 'a']);
  });
  t('taskItems: manuell order (dra-og-slipp) styrer rekkefølgen', () => {
    const now = '2026-10-16T08:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'a', type: 'task' }, { now, id: 'a' });
    s = addItem(s, { text: 'b', type: 'task' }, { now, id: 'b' });
    s = addItem(s, { text: 'c', type: 'task' }, { now, id: 'c' });
    s = L.reorderItems(s, { orderedIds: ['c', 'a', 'b'] }, { now });
    eq(L.taskItems(s, now).map((i) => i.id), ['c', 'a', 'b']);
  });
  t('reorderItems: bare items som faktisk flyttet får ny updatedAt', () => {
    let s = defaultState();
    s = addItem(s, { text: 'a', type: 'task' }, { now: '2026-10-16T07:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'b', type: 'task' }, { now: '2026-10-16T07:00:00.000Z', id: 'b' });
    s = addItem(s, { text: 'c', type: 'task' }, { now: '2026-10-16T07:00:00.000Z', id: 'c' });
    s = L.reorderItems(s, { orderedIds: ['a', 'b', 'c'] }, { now: '2026-10-16T08:00:00.000Z' });
    // a blir liggende på index 0 → skal IKKE få ny updatedAt; b og c bytter plass.
    s = L.reorderItems(s, { orderedIds: ['a', 'c', 'b'] }, { now: '2026-10-16T09:00:00.000Z' });
    const get = (id) => s.items.find((i) => i.id === id);
    eq([get('a').order, get('c').order, get('b').order], [0, 1, 2]);
    eq(get('a').updatedAt, '2026-10-16T08:00:00.000Z'); // uendret
    eq(get('c').updatedAt, '2026-10-16T09:00:00.000Z');
    eq(get('b').updatedAt, '2026-10-16T09:00:00.000Z');
  });
  t('migrate backfiller order på gjøremål (timede først, så nyeste) ved første oppgradering', () => {
    let s = defaultState();
    s = addItem(s, { text: 'eldst', type: 'task' }, { now: '2026-10-16T07:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'nyest', type: 'task' }, { now: '2026-10-16T07:30:00.000Z', id: 'b' });
    s = addItem(s, { text: 'timed', type: 'task' }, { now: '2026-10-16T07:10:00.000Z', id: 'c' });
    s = L.scheduleTask(s, { id: 'c', at: '2026-10-16T09:00:00.000Z' }, { now: '2026-10-16T08:00:00.000Z' });
    // Nullstill order for å simulere data laget før feltet fantes.
    s.items.forEach((i) => { i.order = null; });
    s = migrate(s, '2026-10-16');
    const byId = (id) => s.items.find((i) => i.id === id).order;
    // c (timed) øverst, så b (nyest), så a (eldst)
    eq([byId('c'), byId('b'), byId('a')], [0, 1, 2]);
  });
  t('taskItems utelater done, note, someday og gjemte', () => {
    const now = '2026-10-16T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'done', type: 'task' }, { now, id: 'a' });
    s = completeItem(s, { id: 'a' }, { now });
    s = addItem(s, { text: 'note', type: 'note' }, { now, id: 'b' });
    s = addItem(s, { text: 'someday', type: 'someday' }, { now, id: 'c' });
    s = addItem(s, { text: 'gjemt', type: 'task' }, { now, id: 'd' });
    s = deferItem(s, { id: 'd', resurfaceAt: '2026-10-20T00:00:00.000Z' }, { now });
    s = addItem(s, { text: 'åpen', type: 'task' }, { now, id: 'e' });
    eq(L.taskItems(s, now).map((i) => i.id), ['e']);
  });
  t('jobItems: kun åpne jobb-gjøremål, nyeste øverst uten manuell order', () => {
    const now = '2026-10-16T08:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'jobb-eldst', type: 'job' }, { now: '2026-10-16T07:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'jobb-nyest', type: 'job' }, { now: '2026-10-16T07:30:00.000Z', id: 'b' });
    s = addItem(s, { text: 'jobb-timed', type: 'job' }, { now, id: 'c' });
    s = L.scheduleTask(s, { id: 'c', at: '2026-10-16T09:00:00.000Z' }, { now });
    eq(L.jobItems(s, now).map((i) => i.id), ['c', 'b', 'a']);
  });
  t('jobItems skiller jobb fra vanlige gjøremål; scheduleTask beholder type job', () => {
    const now = '2026-10-16T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'privat', type: 'task' }, { now, id: 'a' });
    s = L.scheduleTask(s, { id: 'a', at: '2026-10-16T09:00:00.000Z' }, { now });
    s = addItem(s, { text: 'jobb', type: 'job' }, { now, id: 'b' });
    s = L.scheduleTask(s, { id: 'b', at: '2026-10-16T09:00:00.000Z' }, { now });
    eq(L.jobItems(s, now).map((i) => i.id), ['b']);
    eq(L.taskItems(s, now).map((i) => i.id), ['a']);
    eq(itemsForToday(s, now).map((i) => i.id), ['a']); // jobb holdes utenfor «I dag»
    eq(s.items.find((i) => i.id === 'b').type, 'job');
  });
  t('utsatt jobb: forsvinner fra jobItems men finnes i deferredJobItems; Hent frem henter den tilbake', () => {
    const now = '2026-10-16T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'jobb', type: 'job' }, { now, id: 'a' });
    s = deferItem(s, { id: 'a', resurfaceAt: '2026-10-20T08:00:00.000Z' }, { now });
    eq(L.jobItems(s, now).map((i) => i.id), []); // usynlig i hovedlista
    eq(L.deferredJobItems(s, now).map((i) => i.id), ['a']); // men findbar under «Utsatt»
    s = undeferItem(s, { id: 'a' }, { now });
    eq(L.jobItems(s, now).map((i) => i.id), ['a']); // hentet tilbake
    eq(L.deferredJobItems(s, now).map((i) => i.id), []);
  });
  t('utsatt jobb dukker opp igjen av seg selv når resurfaceAt har passert', () => {
    let s = defaultState();
    s = addItem(s, { text: 'jobb', type: 'job' }, { now: '2026-10-16T10:00:00.000Z', id: 'a' });
    s = deferItem(s, { id: 'a', resurfaceAt: '2026-10-20T08:00:00.000Z' }, { now: '2026-10-16T10:00:00.000Z' });
    const later = '2026-10-20T09:00:00.000Z';
    eq(L.jobItems(s, later).map((i) => i.id), ['a']);
    eq(L.deferredJobItems(s, later).map((i) => i.id), []);
  });
  t('noteItems: kun notater, nyeste først', () => {
    let s = defaultState();
    s = addItem(s, { text: 'n1', type: 'note' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'n2', type: 'note' }, { now: '2026-10-16T09:00:00.000Z', id: 'b' });
    s = addItem(s, { text: 'task', type: 'task' }, { now: '2026-10-16T10:00:00.000Z', id: 'c' });
    eq(L.noteItems(s).map((i) => i.id), ['b', 'a']);
  });
  t('noteBadge: nye notater teller ikke som standard (bare ligge)', () => {
    let s = defaultState();
    s = addItem(s, { text: 'n1', type: 'note' }, { now: 'N', id: 'a' });
    s = addItem(s, { text: 'n2', type: 'note' }, { now: 'N', id: 'b' });
    eq(L.noteBadge(s), { count: 0, level: 'calm' });
  });
  t('noteBadge: teller kun notater som er slått på', () => {
    let s = defaultState();
    s = addItem(s, { text: 'n1', type: 'note' }, { now: 'N', id: 'a' });
    s = addItem(s, { text: 'n2', type: 'note' }, { now: 'N', id: 'b' });
    s = addItem(s, { text: 'n3', type: 'note' }, { now: 'N', id: 'c' });
    s = L.toggleNoteBadge(s, { id: 'a' }, { now: 'N2' });
    s = L.toggleNoteBadge(s, { id: 'b' }, { now: 'N2' });
    eq(L.noteBadge(s), { count: 2, level: 'open' });
  });
  t('toggleNoteBadge: slår av og på, bumper updatedAt', () => {
    let s = defaultState();
    s = addItem(s, { text: 'n1', type: 'note' }, { now: 'N', id: 'a' });
    s = L.toggleNoteBadge(s, { id: 'a' }, { now: 'N2' });
    eq(s.items[0].badge, true);
    eq(s.items[0].updatedAt, 'N2');
    s = L.toggleNoteBadge(s, { id: 'a' }, { now: 'N3' });
    eq(s.items[0].badge, false);
  });
  t('noteBadge: ser bort fra slettede notater', () => {
    let s = defaultState();
    s = addItem(s, { text: 'n1', type: 'note' }, { now: 'N', id: 'a' });
    s = L.toggleNoteBadge(s, { id: 'a' }, { now: 'N2' });
    s = deleteItem(s, { id: 'a' }, { now: 'N3' });
    eq(L.noteBadge(s), { count: 0, level: 'calm' });
  });
  t('scheduleTask setter remindAt + due (dato), type task, nullstiller ios', () => {
    let s = defaultState();
    s = addItem(s, { text: 'x' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' }); // type null
    s.items[0].iosPushedAt = 'gammel';
    s = L.scheduleTask(s, { id: 'a', at: '2026-10-17T18:30:00.000Z' }, { now: '2026-10-16T08:00:00.000Z' });
    const it = s.items[0];
    eq(it.remindAt, '2026-10-17T18:30:00.000Z');
    eq(it.due, '2026-10-17');
    eq(it.type, 'task');
    eq(it.iosPushedAt, null);
  });
  t('scheduleTask beholder eksisterende type', () => {
    let s = defaultState();
    s = addItem(s, { text: 'x', type: 'someday' }, { now: 'N', id: 'a' });
    s = L.scheduleTask(s, { id: 'a', at: '2026-10-17T18:30:00.000Z' }, { now: 'N2' });
    eq(s.items[0].type, 'someday');
  });
  t('scheduleTask → vises i I dag på dagens dato selv før klokkeslett', () => {
    const now = '2026-10-16T08:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'x', type: 'task' }, { now, id: 'a' });
    s = L.scheduleTask(s, { id: 'a', at: '2026-10-16T20:00:00.000Z' }, { now });
    eq(itemsForToday(s, now).map((i) => i.id), ['a']);
  });
  t('markPushedToIos setter iosPushedAt', () => {
    let s = defaultState();
    s = addItem(s, { text: 'x', type: 'task' }, { now: 'N', id: 'a' });
    s = L.markPushedToIos(s, { id: 'a' }, { now: '2026-10-16T08:00:00.000Z' });
    eq(s.items[0].iosPushedAt, '2026-10-16T08:00:00.000Z');
  });
  t('buildShortcutUrl: input=text + egen text-param, url-enkodet JSON', () => {
    const url = L.buildShortcutUrl('Tor Gunnar', { title: 'Ring mor', due: '2026-10-17 18:30' });
    eq(url.indexOf('shortcuts://run-shortcut?name=Tor%20Gunnar'), 0);
    ok(url.indexOf('&input=text&text=') > -1, 'mangler input=text&text=: ' + url);
    const payload = JSON.parse(decodeURIComponent(url.split('&text=')[1]));
    eq(payload, { title: 'Ring mor', due: '2026-10-17 18:30' });
  });
  t('setShortcutName trimmer og faller tilbake til TorGunnar', () => {
    let s = defaultState();
    s = L.setShortcutName(s, { name: '  MinSnarvei ' }, { now: 'N' });
    eq(s.settings.shortcutName, 'MinSnarvei');
    eq(s.settings.updatedAt, 'N');
    s = L.setShortcutName(s, { name: '' }, { now: 'N2' });
    eq(s.settings.shortcutName, 'TorGunnar');
  });

  // --- chille quotes (build 7) ---
  t('getQuotes faller tilbake til standardlista når tom', () => {
    const s = defaultState();
    eq(L.getQuotes(s), L.DEFAULT_QUOTES);
    ok(L.DEFAULT_QUOTES.length === 30, 'forventet 30 standard-quotes');
  });
  t('getQuotes bruker egen liste og ignorerer tomme linjer', () => {
    const s = defaultState();
    s.settings.quotes = ['  Ro  ', '', '   ', 'Pust'];
    eq(L.getQuotes(s), ['Ro', 'Pust']);
  });
  t('getQuotes faller tilbake når egen liste kun er tomme linjer', () => {
    const s = defaultState();
    s.settings.quotes = ['  ', ''];
    eq(L.getQuotes(s), L.DEFAULT_QUOTES);
  });
  t('quoteForDay er deterministisk: samme dato → samme quote', () => {
    const s = defaultState();
    eq(L.quoteForDay(s, '2026-10-16'), L.quoteForDay(s, '2026-10-16'));
  });
  t('quoteForDay bytter quote fra dag til dag', () => {
    const s = defaultState();
    s.settings.quotes = ['A', 'B', 'C'];
    const a = L.quoteForDay(s, '2026-10-16');
    const b = L.quoteForDay(s, '2026-10-17');
    ok(a !== b, 'forventet ulik quote neste dag: ' + a + ' / ' + b);
  });
  t('quoteForDay håndterer full ISO-streng (slicer til dato)', () => {
    const s = defaultState();
    eq(L.quoteForDay(s, '2026-10-16T09:30:00.000Z'), L.quoteForDay(s, '2026-10-16'));
  });
  t('currentQuote bruker dagens quote uten pin', () => {
    const s = defaultState();
    eq(L.currentQuote(s, '2026-10-16'), L.quoteForDay(s, '2026-10-16'));
  });
  t('currentQuote respekterer pin fra i dag', () => {
    const s = defaultState();
    s.settings.quotePin = { date: '2026-10-16', text: 'Min egen ro' };
    eq(L.currentQuote(s, '2026-10-16'), 'Min egen ro');
  });
  t('currentQuote ignorerer utdatert pin (annen dag)', () => {
    const s = defaultState();
    s.settings.quotePin = { date: '2026-10-15', text: 'Gammel' };
    eq(L.currentQuote(s, '2026-10-16'), L.quoteForDay(s, '2026-10-16'));
  });
  t('rotateQuote pinner en quote ≠ den som vises nå, for i dag', () => {
    let s = defaultState();
    s.settings.quotes = ['A', 'B', 'C'];
    const before = L.currentQuote(s, '2026-10-16');
    s = L.rotateQuote(s, { dayKey: '2026-10-16' }, { now: 'N', rand: 0.99 });
    ok(s.settings.quotePin.text !== before, 'skal ikke velge samme som nå');
    eq(s.settings.quotePin.date, '2026-10-16');
    eq(L.currentQuote(s, '2026-10-16'), s.settings.quotePin.text);
    eq(s.settings.updatedAt, 'N');
  });
  t('rotateQuote med én quote klarer seg uten å krasje', () => {
    let s = defaultState();
    s.settings.quotes = ['Bare én'];
    s = L.rotateQuote(s, { dayKey: '2026-10-16' }, { now: 'N', rand: 0 });
    eq(s.settings.quotePin.text, 'Bare én');
  });
  t('setQuotes splitter på linjeskift og trimmer', () => {
    let s = defaultState();
    s = L.setQuotes(s, { text: '  Ro  \n\nPust\n   \nSenk skuldrene' }, { now: 'N' });
    eq(s.settings.quotes, ['Ro', 'Pust', 'Senk skuldrene']);
    eq(s.settings.updatedAt, 'N');
  });

  t('søppelkasse: sletting gjør removed+removedAt og dukker opp i trashItems', () => {
    const now = '2026-10-26T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'oops', type: 'task' }, { now, id: 'a' });
    s = deleteItem(s, { id: 'a' }, { now });
    eq(L.taskItems(s, now).map((i) => i.id), []); // borte fra aktiv liste
    const trash = L.trashItems(s);
    eq(trash.map((i) => i.id), ['a']);
    eq(trash[0].removedAt, now);
  });
  t('søppelkasse: Gjenopprett henter tilbake, Slett for godt gir tombstone', () => {
    const now = '2026-10-26T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'b1', type: 'task' }, { now, id: 'a' });
    s = addItem(s, { text: 'b2', type: 'task' }, { now, id: 'b' });
    s = deleteItem(s, { id: 'a' }, { now });
    s = deleteItem(s, { id: 'b' }, { now });
    s = L.restoreItem(s, { id: 'a' }, { now });
    eq(L.taskItems(s, now).map((i) => i.id), ['a']); // tilbake i aktiv liste
    eq(L.trashItems(s).map((i) => i.id), ['b']);
    s = L.purgeItem(s, { id: 'b' }, { now });
    eq(L.trashItems(s).length, 0); // ute av søppelkassa
    const b = s.items.find((i) => i.id === 'b');
    eq(b.purged, true); eq(b.removed, true); eq(b.text, ''); // beholdt som tombstone
  });
  t('purgeAllTrash: tømmer hele søppelkassa, gjenopprettede ligger trygt', () => {
    const now = '2026-10-26T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'x', type: 'task' }, { now, id: 'a' });
    s = addItem(s, { text: 'y', type: 'task' }, { now, id: 'b' });
    s = addItem(s, { text: 'beholdt', type: 'task' }, { now, id: 'c' });
    s = deleteItem(s, { id: 'a' }, { now });
    s = deleteItem(s, { id: 'b' }, { now });
    s = L.purgeAllTrash(s, { now });
    eq(L.trashItems(s).length, 0);
    eq(s.items.find((i) => i.id === 'a').purged, true);
    eq(s.items.find((i) => i.id === 'b').purged, true);
    eq(L.taskItems(s, now).map((i) => i.id), ['c']); // aktiv sak urørt
  });
  t('expireTrash: tømmer det som er eldre enn 30 dager, beholder nyere', () => {
    const now = '2026-10-26T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'gammel', type: 'task' }, { now, id: 'a' });
    s = addItem(s, { text: 'fersk', type: 'task' }, { now, id: 'b' });
    s = deleteItem(s, { id: 'a' }, { now: '2026-09-01T10:00:00.000Z' }); // 55 dager siden
    s = deleteItem(s, { id: 'b' }, { now: '2026-10-20T10:00:00.000Z' }); // 6 dager siden
    s = L.expireTrash(s, now, 30);
    eq(L.trashItems(s).map((i) => i.id), ['b']); // kun fersk igjen
    eq(s.items.find((i) => i.id === 'a').purged, true);
  });
  t('expireTrash: udatert gammel sletting får removedAt nå (klokka starter ved oppstart)', () => {
    const now = '2026-10-26T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'legacy', type: 'task' }, { now, id: 'a' });
    const it = s.items.find((i) => i.id === 'a');
    it.removed = true; // simuler gammel soft-delete uten removedAt
    s = L.expireTrash(s, now, 30);
    const after = s.items.find((i) => i.id === 'a');
    eq(after.removedAt, now);
    eq(after.purged, undefined); // ikke tømt ennå
  });

  // === Fullført-seksjon (build 20): ferdige blir liggende, ryddes samlet ===
  t('fullført: ferdig gjøremål forlater taskItems og dukker opp i doneTaskItems', () => {
    const now = '2026-10-27T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'a', type: 'task' }, { now, id: 'a' });
    s = addItem(s, { text: 'b', type: 'task' }, { now, id: 'b' });
    s = completeItem(s, { id: 'a' }, { now });
    eq(L.taskItems(s, now).map((i) => i.id), ['b']);     // aktiv liste: kun åpne
    eq(L.doneTaskItems(s).map((i) => i.id), ['a']);      // fullført-seksjon
  });
  t('doneTaskItems: nyeste fullført først, utelater removed', () => {
    const now = '2026-10-27T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'a', type: 'task' }, { now, id: 'a' });
    s = addItem(s, { text: 'b', type: 'task' }, { now, id: 'b' });
    s = addItem(s, { text: 'c', type: 'task' }, { now, id: 'c' });
    s = completeItem(s, { id: 'a' }, { now: '2026-10-27T08:00:00.000Z' });
    s = completeItem(s, { id: 'b' }, { now: '2026-10-27T09:00:00.000Z' });
    s = completeItem(s, { id: 'c' }, { now: '2026-10-27T07:00:00.000Z' });
    eq(L.doneTaskItems(s).map((i) => i.id), ['b', 'a', 'c']);
    s = deleteItem(s, { id: 'b' }, { now });
    eq(L.doneTaskItems(s).map((i) => i.id), ['a', 'c']); // ryddet er borte
  });
  t('doneJobItems / doneSomedayItems skiller på type', () => {
    const now = '2026-10-27T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'j', type: 'job' }, { now, id: 'j' });
    s = addItem(s, { text: 'm', type: 'someday' }, { now, id: 'm' });
    s = completeItem(s, { id: 'j' }, { now });
    s = completeItem(s, { id: 'm' }, { now });
    eq(L.doneJobItems(s).map((i) => i.id), ['j']);
    eq(L.doneSomedayItems(s).map((i) => i.id), ['m']);
    eq(L.jobItems(s, now).length, 0);
    eq(L.mediumItems(s).length, 0);
  });
  t('doneTodayItems: kun task/reminder krysset av i dag', () => {
    const now = '2026-10-27T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'idag', type: 'task' }, { now, id: 'a' });
    s = addItem(s, { text: 'igår', type: 'task' }, { now, id: 'b' });
    s = addItem(s, { text: 'someday', type: 'someday' }, { now, id: 'c' });
    s = completeItem(s, { id: 'a' }, { now });                                 // i dag
    s = completeItem(s, { id: 'b' }, { now: '2026-10-26T10:00:00.000Z' });     // i går
    s = completeItem(s, { id: 'c' }, { now });                                 // someday, teller ikke
    eq(L.doneTodayItems(s, now).map((i) => i.id), ['a']);
  });
  t('trashAllDone: frakter alle oppgitte ferdige til søppel, lar resten være', () => {
    const now = '2026-10-27T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'a', type: 'task' }, { now, id: 'a' });
    s = addItem(s, { text: 'b', type: 'task' }, { now, id: 'b' });
    s = addItem(s, { text: 'åpen', type: 'task' }, { now, id: 'c' });
    s = completeItem(s, { id: 'a' }, { now });
    s = completeItem(s, { id: 'b' }, { now });
    const ids = L.doneTaskItems(s).map((i) => i.id);
    s = L.trashAllDone(s, { ids }, { now, id: 'l' });
    eq(L.doneTaskItems(s).length, 0);                 // fullført-seksjon tømt
    eq(L.trashItems(s).map((i) => i.id).sort(), ['a', 'b']); // havnet i søppel
    eq(L.taskItems(s, now).map((i) => i.id), ['c']);  // åpen sak urørt
  });
  t('fullført: angre (reopen) henter ferdig sak tilbake til aktiv liste', () => {
    const now = '2026-10-27T10:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'a', type: 'task' }, { now, id: 'a' });
    s = completeItem(s, { id: 'a' }, { now });
    eq(L.doneTaskItems(s).map((i) => i.id), ['a']);
    s = reopenItem(s, { id: 'a' }, { now });
    eq(L.doneTaskItems(s).length, 0);
    eq(L.taskItems(s, now).map((i) => i.id), ['a']);
  });
  return results;
}
