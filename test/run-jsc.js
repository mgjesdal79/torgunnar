import { runTests } from './suite.js';
const results = runTests();
let pass = 0, fail = 0;
for (const r of results) {
  if (r.ok) { pass++; }
  else { fail++; print(`FAIL: ${r.name}\n${r.err}`); }
}
print(`\n${pass}/${pass + fail} grønne`);
if (fail) throw new Error(`${fail} tester feilet`);
