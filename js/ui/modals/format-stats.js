// Okno ze statystykami formatowania: ile zmian zrobiła każda reguła, ile znaków i akapitów było i jest,
// jakie znaki usunięto, ostrzeżenia oraz (przy ponownym formatowaniu) czy wynik różni się od poprzedniego.
// items: [{ name, report, text, prevText?, prevReport?, prevStatus?, status?, prevVersion? }] — jeden dokument albo wiele.
// Przy ponownym formatowaniu (reformat) dochodzi porównanie z poprzednim wynikiem: liczby przed/teraz/różnica,
// reguły, które zadziałały inaczej, linie tekstu, które się zmieniły (z przykładami), i werdykt, czy to coś dało.

import { h, help, modal, num, plural } from '../dom.js';
import { RULES } from '../../cleaner/rules.js';
import { VERSIONS } from '../../version.js';

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
  const cmp = reformat && items.some(it => it.prevReport) ? comparison(items) : null;
  modal(title,
    cmp,
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

// ---------- porównanie z poprzednim formatowaniem ----------
const lineBag = t => { const m = new Map(); for (const l of t.split('\n')) { const k = l.trim(); if (k) m.set(k, (m.get(k) || 0) + 1); } return m; };
function lineDiff(a, b) {   // linie usunięte z poprzedniego wyniku i dodane w nowym (bez względu na kolejność)
  const A = lineBag(a), B = lineBag(b), gone = [], added = [];
  for (const [k, n] of A) for (let i = 0; i < n - (B.get(k) || 0); i++) gone.push(k);
  for (const [k, n] of B) for (let i = 0; i < n - (A.get(k) || 0); i++) added.push(k);
  return { gone, added };
}
const totalChanges = r => r.rules.reduce((a, x) => a + x.n, 0);
const removedCount = r => Object.values(r.removed).reduce((a, b) => a + b, 0);

function comparison(items) {
  const pairs = items.filter(it => it.prevReport);
  const agg = f => pairs.reduce((a, it) => [a[0] + f(it.prevReport, it.prevText), a[1] + f(it.report, it.text)], [0, 0]);
  const metrics = [
    ['Znaki po formatowaniu', agg((r, t) => t.length), 'Długość tekstu do nauki'],
    ['Akapity', agg(r => r.paragraphs || 0), 'Linie tekstu po formatowaniu'],
    ['Zmiany reguł', agg(r => totalChanges(r)), 'Suma zmian wszystkich reguł'],
    ['Usunięte znaki', agg(r => removedCount(r)), 'Znaki spoza listy dozwolonych'],
    ['Ostrzeżenia', agg(r => r.warnings.length), 'Mniej = lepiej'],
  ];
  // reguły, które teraz zadziałały inaczej niż poprzednio
  const ruleDiff = RULES.map(rule => {
    const [a, b] = agg(r => (r.rules.find(x => x.id === rule.id) || { n: 0 }).n);
    const was = pairs.some(it => it.prevReport.rules.some(x => x.id === rule.id)), now = pairs.some(it => it.report.rules.some(x => x.id === rule.id));
    return { name: rule.name, a, b, note: was && !now ? 'wyłączona' : !was && now ? 'włączona' : '' };
  }).filter(x => x.a !== x.b || x.note);
  let gone = [], added = [];
  for (const it of pairs) { const d = lineDiff(it.prevText, it.text); gone.push(...d.gone); added.push(...d.added); }
  const changedDocs = pairs.filter(it => it.prevText !== it.text).length;
  const back = pairs.filter(it => it.prevStatus === 'zatwierdzony' && it.status === 'do-sprawdzenia').length;
  const newer = pairs.filter(it => it.prevVersion && it.prevVersion !== VERSIONS.cleaner).length;
  const [w0, w1] = metrics[4][1];
  const verdict = !changedDocs
    ? 'Bez efektu: wynik jest identyczny jak poprzednio. Ponowne formatowanie ma sens po zmianie ustawień formatowania albo nowej wersji reguł.'
    : `Dało efekt: ${pairs.length > 1 ? `zmienił się tekst ${changedDocs} z ${pairs.length} dokumentów` : 'tekst się zmienił'} — ${num(added.length)} ${plural(added.length, 'nowa linia', 'nowe linie', 'nowych linii')}, ${num(gone.length)} ${plural(gone.length, 'usunięta', 'usunięte', 'usuniętych')}` +
      (w1 < w0 ? `, ostrzeżeń mniej o ${w0 - w1}` : w1 > w0 ? `, ostrzeżeń więcej o ${w1 - w0}` : '') + '.' +
      (back ? ` ${back === 1 ? 'Zatwierdzony dokument wrócił' : `Zatwierdzone dokumenty (${back}) wróciły`} do sprawdzenia, bo wynik jest inny.` : '');
  const sign = d => d > 0 ? '+' + num(d) : d < 0 ? '−' + num(-d) : '0';
  // pary „było → jest”: do usuniętej linii dobieramy dodaną o najdłuższym wspólnym początku; zmieniony fragment wyróżniony
  const pairsEx = [], usedAdd = new Set();
  for (const g of gone.slice(0, 200)) {
    let bi = -1, bl = -1;
    for (let i = 0; i < Math.min(added.length, 400); i++) { if (usedAdd.has(i)) continue; const l = common(g, added[i]); if (l > bl) { bl = l; bi = i; } }
    if (bi >= 0 && bl >= 10) { usedAdd.add(bi); pairsEx.push([g, added[bi]]); }
    if (pairsEx.length >= 6) break;
  }
  // pojedyncze linie (usunięte albo dodane w całości) pokazujemy tylko wtedy, gdy nie ma żadnej pary
  const onlyGone = pairsEx.length ? [] : gone.slice(0, 4), onlyAdded = pairsEx.length ? [] : added.slice(0, 4);
  return h('section.cmp' + (changedDocs ? '.yes' : '.no'),
    h('h3', 'Czy to coś dało?', help('Porównanie wyniku ponownego formatowania z poprzednim: liczby, reguły, które zadziałały inaczej, i linie tekstu, które się zmieniły.', 'formatowanie')),
    h('p.verdict', verdict),
    newer ? h('p.note', `Poprzednio sformatowano starszą wersją reguł (${[...new Set(pairs.map(it => it.prevVersion))].join(', ')}), teraz ${VERSIONS.cleaner}.`) : null,
    h('div.tablebox', h('table.stats.cmpt', h('thead', h('tr', h('th', ''), h('th.num', 'Poprzednio'), h('th.num', 'Teraz'), h('th.num', 'Różnica'))),
      h('tbody', metrics.map(([l, [a, b], t]) => h('tr' + (a === b ? '.zero' : ''), { title: t }, h('td', l), h('td.num', num(a)), h('td.num', num(b)), h('td.num.d' + (b < a ? 'neg' : b > a ? 'pos' : ''), sign(b - a))))))),
    ruleDiff.length ? [h('h4', 'Reguły, które zadziałały inaczej'), h('div.tablebox', h('table.stats', h('tbody', ruleDiff.map(x =>
      h('tr', h('td', x.name, x.note ? h('span.badge', ' ' + x.note) : null), h('td.num', `${num(x.a)} → ${num(x.b)}`))))))] : null,
    changedDocs ? h('details', { open: true }, h('summary', `Przykłady zmian (${num(Math.max(gone.length, added.length))} ${plural(Math.max(gone.length, added.length), 'zmieniona linia', 'zmienione linie', 'zmienionych linii')})`),
      pairsEx.map(([a, b]) => diffPair(a, b)),
      onlyGone.map(l => h('div.diffline.del', '− ' + short(l))), onlyAdded.map(l => h('div.diffline.add', '+ ' + short(l)))) : null);
}

const common = (a, b) => { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; };
const short = l => l.length > 160 ? l.slice(0, 160) + '…' : l;
// para linii: wspólny początek i koniec skrócone do otoczenia, środek (zmiana) wyróżniony
function diffPair(a, b) {
  const p = common(a, b); let e = 0;
  while (e < a.length - p && e < b.length - p && a[a.length - 1 - e] === b[b.length - 1 - e]) e++;
  const C = 40, pre = (p > C ? '…' : '') + a.slice(Math.max(0, p - C), p);
  const line = (t, cls, sign) => h('div.diffline.' + cls, sign + ' ' + pre, h('mark', { title: 'zmieniony fragment (· = spacja, ∅ = nic)' }, (t.slice(p, t.length - e) || '∅').replace(/ /g, '·')), t.slice(t.length - e, t.length - e + C) + (e > C ? '…' : ''));
  return h('div.diffpair', line(a, 'del', '−'), line(b, 'add', '+'));
}
