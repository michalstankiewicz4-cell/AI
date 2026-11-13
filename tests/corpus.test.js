// Mieszanie korpusu do nauki: dokumenty prawnicze w całości, ogólne do ustalonego udziału.
import { mixCorpus } from '../js/core/documents.js';

export default async function (t) {
  const doc = (n, general, line = 'x'.repeat(99)) => ({ general, text: Array(n / 100).fill(line).join('\n') + '\n'.slice(0, 0) });
  const legal = [doc(800, false), doc(200, false)], gen = [doc(500, true), doc(500, true), doc(500, true)];
  let c = mixCorpus([...legal, ...gen], 20);
  t.eq(c.legalChars, legal.reduce((a, d) => a + d.text.length, 0), 'prawnicze w całości');
  t.ok(c.generalChars <= Math.round(c.legalChars * 20 / 80) && c.generalChars > Math.round(c.legalChars * 20 / 80) - 100, `ogólne do 20% całości (${c.generalChars} przy prawniczych ${c.legalChars})`);
  t.ok(c.generalUsedDocs < c.generalDocs, 'nie wszystkie ogólne użyte');
  t.ok(c.text.includes('\n\n'), 'dokumenty rozdzielone pustą linią');
  c = mixCorpus([...legal, ...gen], 0);
  t.eq(c.generalChars, 0, 'udział 0% – bez tekstu ogólnego');
  t.eq(c.docs, 2, 'udział 0% – tylko prawnicze');
  c = mixCorpus(gen, 20);
  t.eq(c.generalUsedDocs, 3, 'bez prawniczych – wszystkie ogólne');
  c = mixCorpus(legal, 30);
  t.eq(c.generalDocs, 0, 'bez ogólnych – bez zmian');
}
