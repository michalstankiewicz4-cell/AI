// Silnik AI · szybkie generowanie tekstu (tylko odpowiadanie, bez nauki).
//
// Przy nauce sieć liczy całe okno naraz (autograd w engine.js). Przy rozmowie to marnotrawstwo:
// dla każdego nowego tokenu trzeba by przeliczać wszystkie poprzednie. Tu każdy token przechodzi
// przez sieć raz, a jego klucze i wartości uwagi zostają w pamięci (KV cache). Koszt jednego tokenu
// to kilka milisekund nawet na słabym laptopie, więc rozmowa nie wymaga mocnego komputera.
//
// Obliczenia są dokładnie te same co w buildTransformer (worker.js): LayerNorm z eps 1e-5,
// GELU w wersji z tanh, uwaga przyczynowa ze skalą 1/√(wymiar głowy), te same wagi w tej samej kolejności.

function inferenceNet(m) {
  const { layers: L, dim: d, heads: nh, ctx: T } = m.hp, V = m.chars.length, hd = d / nh, sc = 1 / Math.sqrt(hd);
  const p = m.params.map(t => t.d);
  const Emb = p[0], Pos = p[1], blocks = [];
  for (let l = 0; l < L; l++) {
    const o = 2 + l * 12;
    const [g1, b1, Wqkv, bqkv, Wp, bp, g2, b2, W1, c1, W2, c2] = p.slice(o, o + 12);
    blocks.push({ g1, b1, Wqkv, bqkv, Wp, bp, g2, b2, W1, c1, W2, c2, K: new Float32Array(T * d), Vv: new Float32Array(T * d) });
  }
  const o = 2 + L * 12, gf = p[o], bf = p[o + 1], Wo = p[o + 2], bo = p[o + 3];
  // bufory robocze, tworzone raz
  const x = new Float32Array(d), h = new Float32Array(d), qkv = new Float32Array(3 * d), att = new Float32Array(d),
    tmp = new Float32Array(d), u = new Float32Array(4 * d), logits = new Float32Array(V), sc0 = new Float32Array(T);
  let len = 0;

  const ln = (src, g, b, dst) => {
    let mu = 0; for (let j = 0; j < d; j++) mu += src[j]; mu /= d;
    let v = 0; for (let j = 0; j < d; j++) { const z = src[j] - mu; v += z * z; } v /= d;
    const rs = 1 / Math.sqrt(v + 1e-5);
    for (let j = 0; j < d; j++) dst[j] = (src[j] - mu) * rs * g[j] + b[j];
  };
  // dst[c] = bias[c] + Σ_r src[r]·W[r, c]   (W zapisane wierszami: [rows, cols])
  const mv = (src, rows, W, cols, bias, dst) => {
    dst.set(bias);
    for (let r = 0; r < rows; r++) { const s = src[r]; if (s === 0) continue; const off = r * cols; for (let c = 0; c < cols; c++) dst[c] += s * W[off + c]; }
  };
  const gc = Math.sqrt(2 / Math.PI);

  // Jeden token na pozycji `len`; zwraca logity następnego tokenu.
  function step(tok) {
    if (len >= T) throw new Error('Okno pełne: wywołaj reset() i podaj kontekst od nowa.');
    const pos = len;
    for (let j = 0; j < d; j++) x[j] = Emb[tok * d + j] + Pos[pos * d + j];
    for (const b of blocks) {
      ln(x, b.g1, b.b1, h);
      mv(h, d, b.Wqkv, 3 * d, b.bqkv, qkv);
      b.K.set(qkv.subarray(d, 2 * d), pos * d); b.Vv.set(qkv.subarray(2 * d, 3 * d), pos * d);
      att.fill(0);
      for (let hh = 0; hh < nh; hh++) {
        const qo = hh * hd; let mx = -Infinity;
        for (let j = 0; j <= pos; j++) {
          const ko = j * d + qo; let s = 0;
          for (let k = 0; k < hd; k++) s += qkv[qo + k] * b.K[ko + k];
          s *= sc; sc0[j] = s; if (s > mx) mx = s;
        }
        let sum = 0; for (let j = 0; j <= pos; j++) { sc0[j] = Math.exp(sc0[j] - mx); sum += sc0[j]; }
        for (let j = 0; j <= pos; j++) { const w = sc0[j] / sum, vo = j * d + qo; for (let k = 0; k < hd; k++) att[qo + k] += w * b.Vv[vo + k]; }
      }
      mv(att, d, b.Wp, d, b.bp, tmp); for (let j = 0; j < d; j++) x[j] += tmp[j];
      ln(x, b.g2, b.b2, h);
      mv(h, d, b.W1, 4 * d, b.c1, u);
      for (let j = 0; j < 4 * d; j++) { const z = u[j]; u[j] = .5 * z * (1 + Math.tanh(gc * (z + .044715 * z * z * z))); }
      mv(u, 4 * d, b.W2, d, b.c2, tmp); for (let j = 0; j < d; j++) x[j] += tmp[j];
    }
    ln(x, gf, bf, h);
    mv(h, d, Wo, V, bo, logits);
    len++;
    return logits;
  }
  return { T, V, step, reset() { len = 0; }, get length() { return len; } };
}

// Generowanie: kontekst (numery tokenów) → kolejne tokeny, aż stop() powie „dość” albo skończy się limit.
// Gdy okno się zapełni, przesuwamy je: liczymy od nowa ostatnie 3/4 okna (tak samo widziała tekst przy nauce).
function generate(net, ctxIds, { temp = .8, maxTokens = 200, pick, stop }) {
  const seq = ctxIds.slice(), keep = Math.max(1, Math.floor(net.T * 3 / 4));
  const prefill = () => { net.reset(); const w = seq.slice(-keep); let lg = null; for (const t of w) lg = net.step(t); return lg; };
  let lg = prefill();
  const out = [];
  for (let i = 0; i < maxTokens; i++) {
    const t = pick(lg, temp); out.push(t); seq.push(t);
    if (stop && stop(out)) break;
    if (net.length >= net.T) lg = prefill(); else lg = net.step(t);
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { inferenceNet, generate };
