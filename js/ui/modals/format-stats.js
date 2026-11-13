// Okno ze statystykami formatowania: ile zmian zrobiła każda reguła, ile znaków i akapitów było i jest,
// jakie znaki usunięto, ostrzeżenia oraz (przy ponownym formatowaniu) czy wynik różni się od poprzedniego.
// items: [{ name, report, prevText?, text }] — jeden dokument albo wiele (wtedy suma i lista dokumentów).

import { h, help, modal, num, plural } from '../dom.js';
import { RULES } from '../../cleaner/rules.js';

export function formatStatsModal(title, items, { reformat = false } = {}) {
  const sum = Object.fromEntries(RULES.map(r => [r.id, 0])), removed = {};
  let before = 0, after = 0, paras = 0, warns = 0, changed = 0;
  for (const it of items) {
    const r = it.report;
    r.rules.forEach(x => { sum[x.id] = (sum[x.id] || 0) + x.n; });
    Object.entries(r.removed).forEach(([c, n]) => { removed[c] = (removed[c] || 0) + n; });
    before += r.before; after += r.after; paras += r.paragraphs || 0; warns += r.warnings.length;
    if (reformat && it.prevText !== it.text) changed++;
  }
  const total = Object.values(sum).reduce((a, b) => a + b, 0), max = Math.max(1, ...Object.values(sum));
  const rows = RULES.filter(r => sum[r.id] != null).map(r => h('tr' + (sum[r.id] ? '' : '.zero'),
    h('td', r.name), h('td.num', num(sum[r.id])),
    h('td.barcell', h('span.bar', { style: { width: (100 * sum[r.id] / max).toFixed(1) + '%' } }))));
  const removedList = Object.entries(removed).sort((a, b) => b[1] - a[1]);
  const pct = before ? Math.round(100 * (before - after) / before) : 0;
  modal(title,
    h('div.statgrid',
      stat(num(total), plural(total, 'zmiana', 'zmiany', 'zmian'), 'Suma zmian wszystkich reguł'),
      stat(`${num(before)} → ${num(after)}`, 'znaków', `Tekst skrócił się o ${pct}% (usunięte śmieci, sklejone linie, zbędne spacje)`),
      stat(num(paras), plural(paras, 'akapit', 'akapity', 'akapitów'), 'Akapity po formatowaniu (linie tekstu)'),
      items.length > 1 ? stat(num(items.length), plural(items.length, 'dokument', 'dokumenty', 'dokumentów'), 'Ile dokumentów sformatowano') : null,
      reformat ? stat(num(changed), 'z innym wynikiem', 'Ile dokumentów ma teraz inny tekst niż przed ponownym formatowaniem. Zatwierdzone z innym wynikiem wróciły do sprawdzenia.') : null,
      warns ? stat(num(warns), plural(warns, 'ostrzeżenie', 'ostrzeżenia', 'ostrzeżeń'), 'Sprawdź je przy dokumentach w zakładce Formatowanie') : null),
    items.length === 1 && items[0].report.read ? h('p.note', 'Odczyt: ' + items[0].report.read) : null,
    h('h3', 'Zmiany według reguł', help('Ile razy każda reguła coś zmieniła. Kliknij, żeby zobaczyć opis reguł z przykładami.', 'formatowanie')),
    h('div.tablebox', h('table.stats', h('tbody', rows))),
    removedList.length ? [h('h3', 'Usunięte znaki', help('Znaki spoza listy dozwolonych. Potrzebne dopisz w Formatowanie → Ustawienia formatowania.', 'usuniete-znaki')),
      h('p', removedList.slice(0, 40).map(([c, n]) => h('code.ch', { title: 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') }, `${c === ' ' ? '␠' : c} ×${n}`)))] : null,
    items.length > 1 ? h('details', h('summary', `Dokumenty (${items.length})`), h('div.tablebox', h('table.stats', h('tbody', items.map(it => {
      const n = it.report.rules.reduce((a, x) => a + x.n, 0);
      return h('tr', h('td', it.name), h('td.num', `${num(n)} ${plural(n, 'zmiana', 'zmiany', 'zmian')}`), h('td.num', `${num(it.report.before)} → ${num(it.report.after)} znaków`),
        reformat ? h('td', it.prevText !== it.text ? 'inny wynik' : 'bez różnic') : null);
    }))))) : null);
}
const stat = (v, l, t) => h('div.stat', { title: t }, h('b', v), h('span', l));
