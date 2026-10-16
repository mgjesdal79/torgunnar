import { defaultState, clone, migrate, addItem, activeItems, classifyItem, setItemCategory, setItemText, setReminder, completeItem, reopenItem, deleteItem, deferItem, undeferItem, isResurfaced, isPending, inboxItems, itemsForToday, categoryItems, somedayItems, taskItems, noteItems, scheduleTask, markPushedToIos, buildShortcutUrl, setShortcutName, addCategory, updateCategory, deleteCategory, reorderCategories, categoryBadge, mergeState, pruneLog, addMinutesIso, weekdayKey, addDaysIso, addRoutine, updateRoutine, deleteRoutine, generateRoutineInstances, wakeRoutine, routineInstancesForDate, pruneRoutineInstances, sleepingRoutines, allSubtasksDone, toggleRoutineSubtask, skipRoutineInstance, setInsistence, nudgeDue, snoozeNudge, promoteToToday, mediumItems, mediumBadge, isKonaPending, konaItems, konaBadge, DEFAULT_QUOTES, getQuotes, quoteForDay, currentQuote, rotateQuote, setQuotes } from '../js/logic.js';
const L = { weekdayKey, addDaysIso, addRoutine, updateRoutine, deleteRoutine, generateRoutineInstances, wakeRoutine, routineInstancesForDate, pruneRoutineInstances, sleepingRoutines, allSubtasksDone, toggleRoutineSubtask, skipRoutineInstance, defaultState, mergeState, migrate, setInsistence, nudgeDue, snoozeNudge, promoteToToday, mediumItems, mediumBadge, isKonaPending, konaItems, konaBadge, taskItems, noteItems, scheduleTask, markPushedToIos, buildShortcutUrl, setShortcutName, DEFAULT_QUOTES, getQuotes, quoteForDay, currentQuote, rotateQuote, setQuotes };

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
  t('mediumBadge teller kun nag', () => {
    let s = defaultState();
    s = addItem(s, { text: 'A', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'B', type: 'someday' }, { now: '2026-10-16T08:00:00.000Z', id: 'b' });
    s = L.setInsistence(s, { id: 'a', insistence: 'nag' }, { now: 'N' });
    s = L.setInsistence(s, { id: 'b', insistence: 'chill' }, { now: 'N' });
    eq(L.mediumBadge(s), { count: 1, level: 'open' });
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
  t('taskItems: åpne gjøremål, timede først (tid stigende) så nyeste', () => {
    const now = '2026-10-16T08:00:00.000Z';
    let s = defaultState();
    s = addItem(s, { text: 'u-eldst', type: 'task' }, { now: '2026-10-16T07:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'u-nyest', type: 'task' }, { now: '2026-10-16T07:30:00.000Z', id: 'b' });
    s = addItem(s, { text: 'timed-sen', type: 'task' }, { now, id: 'c' });
    s = L.scheduleTask(s, { id: 'c', at: '2026-10-16T20:00:00.000Z' }, { now });
    s = addItem(s, { text: 'timed-tidlig', type: 'task' }, { now, id: 'd' });
    s = L.scheduleTask(s, { id: 'd', at: '2026-10-16T09:00:00.000Z' }, { now });
    eq(L.taskItems(s, now).map((i) => i.id), ['d', 'c', 'b', 'a']);
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
  t('noteItems: kun notater, nyeste først', () => {
    let s = defaultState();
    s = addItem(s, { text: 'n1', type: 'note' }, { now: '2026-10-16T08:00:00.000Z', id: 'a' });
    s = addItem(s, { text: 'n2', type: 'note' }, { now: '2026-10-16T09:00:00.000Z', id: 'b' });
    s = addItem(s, { text: 'task', type: 'task' }, { now: '2026-10-16T10:00:00.000Z', id: 'c' });
    eq(L.noteItems(s).map((i) => i.id), ['b', 'a']);
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

  return results;
}
