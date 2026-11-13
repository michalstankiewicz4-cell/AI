// Każda ikona [?] w panelu musi prowadzić do istniejącego działu Pomocy, a każdy przykład reguły musi coś zmieniać.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { SECTIONS, TOPIC } from '../js/help/content.js';
import { SCHEMA } from '../js/core/settings.js';
import { RULES } from '../js/cleaner/rules.js';

const files = d => readdirSync(d).flatMap(f => { const p = d + '/' + f; return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : []; });

export default function (t) {
  const root = new URL('../js', import.meta.url).pathname, used = new Set();
  for (const f of files(root)) for (const m of readFileSync(f, 'utf8').matchAll(/help\([^;]*?,\s*'([a-z0-9.\-_]+)'\)/g)) used.add(m[1]);
  for (const g of SCHEMA) for (const f of g.fields) used.add(`${g.group}.${f.id}`);
  const missing = [...used].filter(x => !TOPIC[x]);
  t.eq(missing.join(', '), '', `wszystkie tematy [?] mają dział w Pomocy (${used.size} tematów)`);
  t.eq(new Set(SECTIONS.map(s => s.id)).size, SECTIONS.length, 'identyfikatory działów są unikalne');
  for (const s of SECTIONS) for (const b of s.body) {
    if (b[0] === 'rule') { const r = RULES.find(x => x.id === b[1]).apply(b[2], { repeatMin: 4, dedupeMin: 40 }, { removed: {} }); t.ok(r.n > 0, `przykład reguły ${b[1]} pokazuje zmianę`); }
    if (b[0] === 'link') t.ok(SECTIONS.some(x => x.id === b[1]), `odnośnik ${b[1]} prowadzi do działu`);
  }
}
