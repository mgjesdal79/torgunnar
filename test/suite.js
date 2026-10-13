import { defaultState, clone, migrate } from '../js/logic.js';

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

  return results;
}
