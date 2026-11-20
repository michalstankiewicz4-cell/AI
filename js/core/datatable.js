// Widok „Tabela”: przepisy albo rozmowy wzorcowe jako wiersze z wykrytymi problemami (bez UI).
import { parseStructure, actShort, unitLabel, findRefs, buildGraph } from './structure.js';

export const PROBLEMS = { empty: 'pusty tekst', dup: 'duplikat', license: 'brak licencji', ref: 'zły odnośnik' };
const norm = t => String(t || '').toLowerCase().replace(/\s+/g, ' ').trim();
const refName = r => `art. ${r.art.replace('^', '')}${r.part ? ' ' + r.part : ''}${r.short ? ' ' + r.short : r.act ? ' ' + r.act : ''}`;

// odnośniki do aktów z biblioteki, które nie wskazują istniejącego artykułu (akty spoza biblioteki nie są błędem)
function badRefs(text, graph, from) {
  return findRefs(text).filter(r => graph.actOf(r, from) && !graph.resolve(r, from)).map(refName);
}

// oznacza duplikaty: ten sam tekst (bez wielkości liter i spacji) w więcej niż jednym wierszu
function markDups(rows, key, minLen = 20) {
  const by = new Map();
  for (const r of rows) { const k = norm(key(r)); if (k.length < minLen) continue; if (!by.has(k)) by.set(k, []); by.get(k).push(r); }
  for (const g of by.values()) if (g.length > 1) for (const r of g) r.problems.push({ id: 'dup', info: 'Ten sam tekst: ' + g.filter(x => x !== r).map(x => x.label).slice(0, 5).join(', ') });
}

// przepisy (paragraf albo ustęp, a gdy ich brak – artykuł) z aktów mających co najmniej 3 artykuły
export function provisionRows(docs, library = docs) {
  const graph = buildGraph(library), rows = [];
  for (const d of docs) {
    const { units } = parseStructure(d.text); if (units.length < 3) continue;
    const short = actShort(d.name) || actShort(d.description);
    units.forEach((u, i) => {
      const body = u.text.replace(/^Art\.\s*\S+\s*/, '').replace(/^(§\s*\d+[a-z]*|\d+[a-z]*)\.\s*/, '').trim();
      const row = { kind: 'przepis', id: `${d.id}#${i}`, docId: d.id, art: u.art, order: i, akt: d.name, label: unitLabel(u, short), chapter: u.chapter || '', text: u.text, license: d.license || '', status: d.status, problems: [] };
      if (body.length < 3) row.problems.push({ id: 'empty' });
      if (!d.license) row.problems.push({ id: 'license', info: 'Dokument nie ma wpisanej licencji (Dokumenty → Licencja).' });
      const bad = badRefs(u.text, graph, d); if (bad.length) row.problems.push({ id: 'ref', info: 'Brak w bibliotece: ' + bad.join(', ') });
      rows.push(row);
    });
  }
  markDups(rows, r => r.text.replace(/^Art\.\s*\S+\s*/, '').replace(/^(§\s*\d+[a-z]*|\d+[a-z]*)\.\s*/, ''));
  return rows;
}

// rozmowy wzorcowe: pierwsze pytanie i pierwsza odpowiedź; odnośniki sprawdzane w bibliotece
export function dialogRows(dialogs, library = []) {
  const graph = buildGraph(library);
  const rows = dialogs.map(d => {
    const q = d.turns.find(t => t.role === 'user'), a = d.turns.find(t => t.role !== 'user');
    const row = { kind: 'rozmowa', id: d.id, dialog: d, label: (q ? q.text : '').slice(0, 80), question: q ? q.text : '', answer: a ? a.text : '', turns: d.turns.length, source: d.source || '', tags: (d.tags || []).join(', '),
      status: d.draft ? 'do uzupełnienia' : d.enabled ? 'w dostrajaniu' : 'wyłączona', problems: [] };
    if (d.turns.some(t => !String(t.text || '').trim()) || !q || !a) row.problems.push({ id: 'empty', info: 'Pytanie albo odpowiedź jest puste.' });
    const bad = d.turns.flatMap(t => badRefs(t.text, graph, null)); if (bad.length) row.problems.push({ id: 'ref', info: 'Brak w bibliotece: ' + bad.join(', ') });
    return row;
  });
  markDups(rows, r => r.question, 10);
  return rows;
}

export const problemCounts = rows => { const c = {}; for (const r of rows) for (const p of r.problems) c[p.id] = (c[p.id] || 0) + 1; return c; };

// sortowanie po kolumnie; liczby w tekście porównywane jak liczby (art. 9 przed art. 10)
export function sortRows(rows, key, dir = 1) {
  const val = r => key === 'problems' ? r.problems.length : key === 'label' && r.kind === 'przepis' ? `${r.akt}\u0000${String(r.order).padStart(6, '0')}` : r[key] ?? '';
  return [...rows].sort((a, b) => { const x = val(a), y = val(b); return dir * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pl', { numeric: true })); });
}

// filtr: tekst (w dowolnej kolumnie) i problem ('' – wszystkie, 'any' – z jakimkolwiek problemem, albo id problemu)
export function filterRows(rows, q = '', problem = '') {
  const s = norm(q);
  return rows.filter(r => (!problem || (problem === 'any' ? r.problems.length : r.problems.some(p => p.id === problem)))
    && (!s || norm([r.label, r.akt, r.chapter, r.text, r.question, r.answer, r.source, r.tags, r.license, r.status].join(' ')).includes(s)));
}
