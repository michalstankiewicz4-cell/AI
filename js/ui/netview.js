// Podgląd budowy modelu: warstwy jako kolumny kółek (neuronów), połączone liniami z prawdziwych wag.
//
// Kolumny (od lewej): tokeny → embedding → dla każdej warstwy: uwaga, sieć MLP, wyjście warstwy → przewidywany token.
// Kolumna ma za dużo neuronów, żeby pokazać wszystkie (np. 512), więc rysujemy najważniejsze (o największych wagach)
// i podpis „+ N”. Linia: grubość i krycie = siła wagi, kolor niebieski = dodatnia, złoty = ujemna.
// Połączenia: tokeny→embedding (Emb), → uwaga (część wartości Wqkv), uwaga → MLP (W1), MLP → wyjście (W2),
// ostatnie wyjście → tokeny (Wo). Najechanie na kółko pokazuje jego połączenia i opis kolumny.

import { h } from './dom.js';

const SHOW = 12;

function columns(rec) {
  const { layers: L, dim: d, heads: nh } = rec.hp, V = rec.chars.length, t = rec.tensors;
  const blk = l => { const o = 2 + l * 12; return { Wqkv: t[o + 2], W1: t[o + 8], W2: t[o + 10] }; };
  const Wo = t[2 + L * 12 + 2];
  // macierz [rows, cols] jako funkcja (wiersz, kolumna) → waga
  const M = (arr, cols, c0 = 0) => (r, c) => arr[r * cols + c0 + c];
  const cols = [{ name: 'Tokeny', sub: `słownik ${V}`, n: V, kind: 'tok' }, { name: 'Embedding', sub: `wymiar ${d} na token`, n: d, kind: 'emb', w: M(t[0], d), params: V * d + rec.hp.ctx * d }];
  for (let l = 0; l < L; l++) {
    const b = blk(l);
    cols.push({ name: `Uwaga ${l + 1}`, sub: `${nh} głowy × ${d / nh}`, n: d, kind: 'att', heads: nh, w: M(b.Wqkv, 3 * d, 2 * d), params: 4 * d * d + 6 * d });
    cols.push({ name: `MLP ${l + 1}`, sub: `${4 * d} neuronów`, n: 4 * d, kind: 'mlp', w: M(b.W1, 4 * d), params: 8 * d * d + 7 * d });
    cols.push({ name: `Wyjście ${l + 1}`, sub: `wymiar ${d}`, n: d, kind: 'res', w: M(b.W2, d) });
  }
  cols.push({ name: 'Następny token', sub: `prawdopodobieństwa ${V}`, n: V, kind: 'out', w: M(Wo, V), params: d * V + V + 2 * d });
  return cols;
}

// Wybór pokazywanych neuronów: o największej sumie |wag| wchodzących (dla tokenów: wychodzących).
function pick(cols) {
  cols.forEach((c, i) => {
    const score = new Float64Array(c.n), prev = cols[i - 1], next = cols[i + 1];
    if (c.w && prev) for (let r = 0; r < prev.n; r++) for (let k = 0; k < c.n; k++) score[k] += Math.abs(c.w(r, k));
    else if (next && next.w) for (let k = 0; k < c.n; k++) for (let j = 0; j < Math.min(next.n, 64); j++) score[k] += Math.abs(next.w(k, j));
    c.idx = [...score.keys()].sort((a, b) => score[b] - score[a]).slice(0, Math.min(SHOW, c.n)).sort((a, b) => a - b);
  });
}

export function netView(model) {
  const rec = model.record, cols = columns(rec);
  pick(cols);
  const css = getComputedStyle(document.documentElement), v = k => css.getPropertyValue(k).trim();
  const colW = 104, W = 60 + cols.length * colW, H = 490, top = 92, bottom = 40;
  const canvas = h('canvas.netview', { width: W * (devicePixelRatio || 1), height: H * (devicePixelRatio || 1), style: { width: W + 'px', height: H + 'px' } });
  const info = h('p.status', 'Najedź na kółko, żeby zobaczyć jego połączenia.');
  const pos = cols.map((c, i) => c.idx.map((k, j) => ({ x: 40 + i * colW + colW / 2, y: top + (H - top - bottom) * (j + .5) / c.idx.length, k })));
  // największa waga na połączeniu kolumn — skala grubości linii
  const scale = cols.map((c, i) => { if (!c.w || !i) return 1; let m = 1e-9; for (const a of cols[i - 1].idx) for (const b of c.idx) m = Math.max(m, Math.abs(c.w(a, b))); return m; });
  let hover = null;

  const draw = () => {
    const g = canvas.getContext('2d'), dpr = devicePixelRatio || 1;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    const pos_ = v('--accent'), neg = v('--gold'), ink = v('--ink'), ink3 = v('--ink-3'), panel = v('--panel'), line = v('--line-2');
    // połączenie omijające (residual): strumień przechodzi obok każdego bloku
    g.strokeStyle = line; g.setLineDash([4, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(pos[1][0].x, top - 22); g.lineTo(pos[cols.length - 2][0].x, top - 22); g.stroke(); g.setLineDash([]);
    g.fillStyle = ink3; g.font = '10px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('połączenie omijające (residual) — strumień, do którego każdy blok dopisuje swój wynik', (pos[1][0].x + pos[cols.length - 2][0].x) / 2, top - 28);
    // linie
    for (let i = 1; i < cols.length; i++) {
      const c = cols[i]; if (!c.w) continue;
      for (const a of pos[i - 1]) for (const b of pos[i]) {
        const w = c.w(a.k, b.k), s = Math.abs(w) / scale[i];
        const hl = hover && ((hover.i === i && hover.p === b) || (hover.i === i - 1 && hover.p === a));
        if (hover && !hl) { g.globalAlpha = .04 * s; } else g.globalAlpha = hl ? .25 + .75 * s : .08 + .5 * s * s;
        g.strokeStyle = w >= 0 ? pos_ : neg; g.lineWidth = hl ? .6 + 2.4 * s : .4 + 1.6 * s;
        g.beginPath(); g.moveTo(a.x, a.y); g.bezierCurveTo(a.x + colW * .45, a.y, b.x - colW * .45, b.y, b.x, b.y); g.stroke();
      }
    }
    g.globalAlpha = 1;
    // kółka i podpisy
    cols.forEach((c, i) => {
      const x = pos[i][0].x;
      g.fillStyle = ink; g.font = '600 11.5px system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(c.name, x, 20);
      g.fillStyle = ink3; g.font = '10px system-ui, sans-serif'; g.fillText(c.sub, x, 34);
      pos[i].forEach(p => {
        const r = 7.5, active = hover && hover.p === p;
        g.beginPath(); g.arc(p.x, p.y, active ? r + 2 : r, 0, Math.PI * 2);
        g.fillStyle = c.kind === 'att' ? `hsl(${210 + 140 * Math.floor(p.k / (rec.hp.dim / c.heads)) / c.heads} 60% 60%)` : (c.kind === 'tok' || c.kind === 'out') ? panel : (c.kind === 'mlp' ? neg : pos_);
        g.globalAlpha = c.kind === 'mlp' ? .75 : 1; g.fill(); g.globalAlpha = 1;
        g.lineWidth = active ? 2 : 1; g.strokeStyle = active ? ink : line; g.stroke();
        if (c.kind === 'tok' || c.kind === 'out') {
          const s = JSON.stringify(rec.chars[p.k]).slice(1, -1).replace(/ /g, '·');
          g.fillStyle = ink; g.font = '10px ui-monospace, monospace'; g.textAlign = c.kind === 'tok' ? 'right' : 'left';
          g.fillText(s.slice(0, 8), c.kind === 'tok' ? p.x - 12 : p.x + 12, p.y + 3.5); g.textAlign = 'center';
        }
      });
      if (c.n > c.idx.length) { g.fillStyle = ink3; g.font = '10px system-ui, sans-serif'; g.fillText(`+ ${c.n - c.idx.length}`, x, H - bottom + 22); }
    });
  };
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 144;
    pos.forEach((col, i) => col.forEach(p => { const dd = (p.x - x) ** 2 + (p.y - y) ** 2; if (dd < bd) { bd = dd; best = { i, p }; } }));
    if ((best && best.p) !== (hover && hover.p)) {
      hover = best; draw();
      if (best) {
        const c = cols[best.i];
        info.textContent = `${c.name} · ${c.sub}${c.params ? ` · ${c.params.toLocaleString('pl-PL')} parametrów w bloku` : ''} · neuron nr ${best.p.k}` +
          (c.kind === 'tok' || c.kind === 'out' ? ` („${rec.chars[best.p.k]}”)` : '');
      } else info.textContent = 'Najedź na kółko, żeby zobaczyć jego połączenia.';
    }
  });
  canvas.addEventListener('mouseleave', () => { hover = null; draw(); });
  draw();
  return h('div.netbox',
    h('p.note', `Pokazane są najważniejsze neurony każdej kolumny (największe wagi); razem ${rec.params.toLocaleString('pl-PL')} parametrów. Linie: niebieskie = waga dodatnia, złote = ujemna, grubsza = silniejsza. Kolory kółek w kolumnach uwagi oznaczają głowy.`),
    h('div.netscroll', canvas), info);
}
