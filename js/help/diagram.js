// Rysunek do Pomocy: przykładowy, mały model z warstwami i połączeniami, z ponumerowanymi objaśnieniami.
// To schemat (wagi przykładowe, stałe), nie prawdziwy model — prawdziwy pokazuje „Podgląd budowy” w zakładce Modele.

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, text) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };

export const LEGEND = [
  ['Neuron', 'Kółko to jedna liczba, którą sieć liczy dla bieżącego tokenu. W prawdziwym modelu kolumna ma ich dziesiątki lub setki (np. 128); w podglądzie budowy widać 12 najważniejszych.'],
  ['Połączenie = waga', 'Linia między neuronami to waga: o ile wartość jednego neuronu zmienia następny. Niebieska – dodatnia (wzmacnia), złota – ujemna (osłabia), grubsza – silniejsza. Nauka to właśnie poprawianie tych wag.'],
  ['Tokeny (wejście)', 'Kawałki tekstu ze słownika (litery albo tokeny BPE). Sieć widzi tylko ich numery.'],
  ['Embedding', 'Zamiana numeru tokenu na zestaw liczb (wektor). Tokeny o podobnym znaczeniu dostają podobne wektory.'],
  ['Uwaga (głowy)', 'Każdy token „patrzy” na wcześniejsze tokeny w oknie i wybiera, które są ważne. Kolory to głowy uwagi: każda śledzi coś innego (np. podmiot zdania, numer artykułu).'],
  ['MLP', 'Mała sieć przetwarzająca to, co zebrała uwaga. Ma 4× więcej neuronów niż szerokość modelu – tu „przechowuje” większość wiedzy.'],
  ['Połączenie omijające', 'Linia przerywana: wynik warstwy jest dodawany do wspólnego strumienia, a nie go zastępuje. Dzięki temu można układać wiele warstw jedna na drugiej.'],
  ['Warstwa transformera', 'Uwaga + MLP + wyjście warstwy to jedna warstwa. Model powtarza ją tyle razy, ile ustawisz w „Warstwy” (np. 4).'],
  ['Następny token (wyjście)', 'Na końcu sieć daje prawdopodobieństwo każdego tokenu ze słownika. Wybierany jest jeden (zależnie od temperatury) i dopisywany do tekstu.'],
];

export function modelDiagram() {
  const cols = [
    { name: 'Tokeny', n: 5, kind: 'tok', labels: ['Art', '·5', '·§', '·1', '.'] },
    { name: 'Embedding', n: 5, kind: 'emb' },
    { name: 'Uwaga', n: 6, kind: 'att' },
    { name: 'MLP', n: 8, kind: 'mlp' },
    { name: 'Wyjście warstwy', n: 5, kind: 'res' },
    { name: 'Następny token', n: 5, kind: 'out', labels: ['·Umowa', '·Termin', '·Kto', '·§', '·1'] },
  ];
  const W = 900, H = 470, top = 120, bottom = 60, colW = (W - 160) / (cols.length - 1), x0 = 90;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'hdiagram', role: 'img', 'aria-label': 'Schemat przykładowego modelu: kolumny neuronów połączone liniami z objaśnieniami' });
  const P = cols.map((c, i) => Array.from({ length: c.n }, (_, j) => ({ x: x0 + i * colW, y: top + (H - top - bottom) * (j + .5) / c.n })));
  // stałe przykładowe wagi (powtarzalne)
  let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const lines = el('g');
  for (let i = 1; i < cols.length; i++) for (const a of P[i - 1]) for (const b of P[i]) {
    const w = (rnd() * 2 - 1) ** 3, abs = Math.abs(w);
    lines.append(el('path', { d: `M${a.x},${a.y} C${a.x + colW * .45},${a.y} ${b.x - colW * .45},${b.y} ${b.x},${b.y}`, fill: 'none',
      stroke: w >= 0 ? 'var(--accent)' : 'var(--gold)', 'stroke-width': (.4 + 2.6 * abs).toFixed(2), 'stroke-opacity': (.12 + .7 * abs).toFixed(2) }));
  }
  svg.append(lines);
  // warstwa transformera (ramka) i połączenie omijające
  const lx0 = P[2][0].x - 38, lx1 = P[4][0].x + 38;
  svg.append(el('rect', { x: lx0, y: top - 30, width: lx1 - lx0, height: H - top - bottom + 44, rx: 12, fill: 'none', stroke: 'var(--ink-3)', 'stroke-dasharray': '2 5' }));
  svg.append(el('text', { x: (lx0 + lx1) / 2, y: H - 14, 'text-anchor': 'middle', class: 'hd-small' }, 'jedna warstwa transformera — powtarzana N razy'));
  svg.append(el('path', { d: `M${P[1][0].x},${top - 44} H${P[4][0].x}`, stroke: 'var(--ink-3)', 'stroke-dasharray': '5 4', fill: 'none', 'marker-end': 'url(#hd-arrow)' }));
  const defs = el('defs'); const mk = el('marker', { id: 'hd-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
  mk.append(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--ink-3)' })); defs.append(mk); svg.prepend(defs);
  // kółka i podpisy kolumn
  cols.forEach((c, i) => {
    svg.append(el('text', { x: P[i][0].x, y: 26, 'text-anchor': 'middle', class: 'hd-title' }, c.name));
    P[i].forEach((p, j) => {
      const fill = c.kind === 'att' ? `hsl(${210 + 140 * Math.floor(j / 2) / 3} 60% 60%)` : c.kind === 'mlp' ? 'var(--gold)' : (c.kind === 'tok' || c.kind === 'out') ? 'var(--panel)' : 'var(--accent)';
      svg.append(el('circle', { cx: p.x, cy: p.y, r: 9, fill, stroke: 'var(--line-2)', 'stroke-width': 1.2 }));
      if (c.labels) svg.append(el('text', { x: c.kind === 'tok' ? p.x - 15 : p.x + 15, y: p.y + 4, 'text-anchor': c.kind === 'tok' ? 'end' : 'start', class: 'hd-mono' }, c.labels[j]));
    });
  });
  // ponumerowane objaśnienia (numery jak w legendzie)
  const badge = (n, x, y) => { svg.append(el('circle', { cx: x, cy: y, r: 11, fill: 'var(--navy)', stroke: 'var(--gold)', 'stroke-width': 1.5 })); svg.append(el('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'hd-num' }, String(n))); };
  badge(1, P[3][2].x + 18, P[3][2].y - 14);                                  // neuron
  const a = P[1][1], b = P[2][2]; badge(2, (a.x + b.x) / 2, (a.y + b.y) / 2 - 18); // połączenie
  badge(3, P[0][0].x, 52); badge(4, P[1][0].x, 52); badge(5, P[2][0].x, 52); badge(6, P[3][0].x, 52);
  badge(7, (P[1][0].x + P[4][0].x) / 2, top - 44); badge(8, lx1 - 4, top - 30); badge(9, P[5][0].x, 52);
  return svg;
}
