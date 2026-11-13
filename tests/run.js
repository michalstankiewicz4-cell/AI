// Uruchamia wszystkie testy z folderu tests/: node tests/run.js
import { readdirSync } from 'node:fs';
let fail = 0, pass = 0;
const t = {
  ok(c, msg) { if (c) pass++; else { fail++; console.log('  ✗', msg); } },
  eq(a, b, msg) { this.ok(a === b, `${msg} (jest: ${JSON.stringify(a)}, oczekiwano: ${JSON.stringify(b)})`); },
};
for (const f of readdirSync(new URL('.', import.meta.url)).filter(f => f.endsWith('.test.js')).sort()) {
  console.log(f);
  const mod = await import('./' + f);
  await mod.default(t);
}
console.log(`\n${pass} zaliczonych, ${fail} błędów`);
process.exit(fail ? 1 : 0);
