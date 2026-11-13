// Formatowanie danych · przebieg reguł i raport.
//
// cleanDocument — dokument do nauki (pretraining): wszystkie reguły z zakresu „doc”.
// cleanLine     — jedna kwestia (rozmowa wzorcowa, wiadomość w czacie): reguły z zakresu „line”,
//                 a na końcu wszystko w jednej linii (koniec linii oznacza dla sieci koniec kwestii).
// Raport mówi, ile zmian zrobiła każda reguła, jakie znaki usunięto i co wygląda podejrzanie.

import { RULES } from './rules.js';

const enabled = (rule, o) => !o.rules || o.rules[rule.id] !== false;

function run(text, o, scope) {
  const rep = { rules: [], removed: {}, warnings: [], before: text.length, after: 0 };
  for (const rule of RULES) {
    if (!rule.scope.includes(scope) || !enabled(rule, o)) continue;
    const r = rule.apply(text, o, rep);
    text = r.text;
    rep.rules.push({ id: rule.id, name: rule.name, n: r.n });
  }
  rep.after = text.length;
  return { text, report: rep };
}

// Ostrzeżenia: rzeczy, których reguły same nie naprawią, a admin powinien je zobaczyć przed zatwierdzeniem.
function warn(original, text, rep) {
  const w = rep.warnings;
  const moji = (original.match(/Ã[\u0080-¿]|Ä[\u0080-¿…™]|Å[\u0080-¿‚›]|Ĺ[‚›şĽ]|Ä…|Ĺ‚/g) || []).length;
  if (moji > 3) w.push(`Tekst wygląda na źle odczytane kodowanie znaków (${moji} podejrzanych miejsc, np. „Ä…” zamiast „ą”). Zapisz plik jako UTF-8 albo wgraj go ponownie.`);
  const removed = Object.values(rep.removed).reduce((a, b) => a + b, 0);
  if (removed > Math.max(20, original.length * .01)) w.push(`Usunięto dużo znaków spoza dozwolonych (${removed}). Sprawdź listę poniżej: może brakuje jakiegoś znaku w ustawieniach.`);
  if (text.length < 300) w.push('Bardzo krótki tekst: do nauki przyda się niewiele.');
  const lines = text.split('\n').filter(Boolean);
  if (lines.length > 20) {
    const avg = lines.reduce((a, l) => a + l.length, 0) / lines.length;
    if (avg < 35) w.push(`Linie są bardzo krótkie (średnio ${Math.round(avg)} znaków). To może być tabela, spis treści albo tekst, którego nie udało się połączyć w akapity.`);
  }
  const digits = (text.match(/\d/g) || []).length;
  if (text.length > 500 && digits / text.length > .15) w.push('Dużo cyfr w stosunku do tekstu (ponad 15%). To może być tabela albo wykaz, który niewiele uczy języka.');
}

export function cleanDocument(text, o = {}) {
  const r = run(text, o, 'doc');
  warn(text, r.text, r.report);
  r.report.paragraphs = r.text ? r.text.split('\n').filter(Boolean).length : 0;
  return r;
}

export function cleanLine(text, o = {}) {
  const r = run(text.replace(/\s*\n\s*/g, ' '), o, 'line');
  r.text = r.text.replace(/\n/g, ' ').trim();
  return r;
}

// Krótkie podsumowanie raportu do listy: tylko reguły, które coś zmieniły.
export function summary(rep) {
  return rep.rules.filter(r => r.n).map(r => `${r.name}: ${r.n}`).join(' · ') || 'bez zmian';
}
