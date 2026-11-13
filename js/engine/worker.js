// Silnik AI · wątek w tle: nauka (pretraining), dostrajanie do rozmowy (finetuning) i odpowiedzi w czacie.
//
// Oparte na GameLaboratory/labs/lang (krok 4 „Transformer” i krok 5 „Rozmowa”), zmienione pod potrzeby AI:
//  • tylko transformer (najlepsza z konstrukcji laboratorium), na tokenach BPE albo literach,
//  • nauka i dostrajanie na karcie graficznej (GPU) albo procesorze (WASM SIMD / zwykły JS),
//  • dostrajanie z maskowaniem także na GPU (zmiana w gpu.js),
//  • dalsza nauka istniejącego modelu (ten sam słownik) i dostrajanie od już dostrojonego,
//  • odpowiedzi liczone przez infer.js z pamięcią KV: szybko także na słabym komputerze,
//  • kilka modeli naraz w pamięci, rozpoznawanych po identyfikatorze nadanym przez panel.
//
// Protokół: panel wysyła {cmd, ...}, wątek odpowiada {type, ...}. Opis w docs/architektura.md.

importScripts('engine.js', 'wasm.js', 'gpu.js', 'bpe.js', 'infer.js');

const post = (m, tr) => self.postMessage(m, tr || []);
const now = () => performance.now();
const randInt = n => Math.floor(Math.random() * n);
const pause = () => new Promise(r => setTimeout(r, 0));

const models = new Map();       // id → { m, net }  (net: siatka do szybkiego generowania, tworzona przy pierwszej odpowiedzi)
let job = null;                 // trwająca nauka: { id, stop }

// ---------- transformer (ta sama budowa co w laboratorium) ----------
function buildTransformer(hp, ch) {
  const { layers: L, dim: d, heads: nh, ctx: T } = hp, Vm = ch.length;
  const one = n => { const t = zeros([n]); t.d.fill(1); return t; };
  const Emb = param([Vm, d], .3), P = param([T, d], .1), params = [Emb, P], blocks = [];
  const s = 1 / Math.sqrt(d), sr = s / Math.sqrt(2 * L);
  for (let l = 0; l < L; l++) {
    const b = { g1: one(d), b1: zeros([d]), Wqkv: param([d, 3 * d], s), bqkv: zeros([3 * d]), Wp: param([d, d], sr), bp: zeros([d]),
      g2: one(d), b2: zeros([d]), W1: param([d, 4 * d], s), c1: zeros([4 * d]), W2: param([4 * d, d], sr / 2), c2: zeros([d]) };
    blocks.push(b); params.push(...Object.values(b));
  }
  const gf = one(d), bf = zeros([d]), Wo = param([d, Vm], .01), bo = zeros([Vm]);
  params.push(gf, bf, Wo, bo);
  const forward = (X, B, Tw) => {
    let x = addPos(gather(Emb, X), P, Tw);
    for (const b of blocks) {
      const at = causalAttention(addBias(matmul(layerNorm(x, b.g1, b.b1), b.Wqkv), b.bqkv), B, Tw, nh);
      x = add(x, addBias(matmul(at, b.Wp), b.bp));
      x = add(x, addBias(matmul(gelu(addBias(matmul(layerNorm(x, b.g2, b.b2), b.W1), b.c1)), b.W2), b.c2));
    }
    return addBias(matmul(layerNorm(x, gf, bf), Wo), bo);
  };
  return { hp, chars: ch, params, forward, count: params.reduce((a, p) => a + p.size, 0) };
}
function tokenizerOf(chars, tk) { return tk && tk.merges && tk.merges.length ? bpeTokenizer(chars, tk.merges, tk.nBase) : charTokenizer(chars); }
function cloneModel(src, hp) {
  const m = buildTransformer({ ...src.hp, ...hp, layers: src.hp.layers, dim: src.hp.dim, heads: src.hp.heads, ctx: src.hp.ctx }, src.chars);
  m.params.forEach((p, i) => p.d.set(src.params[i].d)); m.tok = src.tok; return m;
}
function validateHP(hp) {
  if (hp.dim % hp.heads) throw new Error('Szerokość musi dzielić się przez liczbę głów uwagi.');
  if ((hp.dim / hp.heads) % 4) throw new Error('Szerokość na jedną głowę (szerokość ÷ głowy) musi być wielokrotnością 4.');
}

// ---------- dane: tokeny, maska celów, podział nauka/sprawdzanie ----------
// D = { tokens, nTrain, tmask, cpt }. tmask[i] = 0 → tego tokenu nie oceniamy (kwestia rozmówcy).
const tgt = (D, i) => D.tmask && !D.tmask[i] ? -1 : D.tokens[i];
function charsPerToken(D, chars, from, to) { let c = 0; for (let i = from; i < to; i++) c += chars[D.tokens[i]].length; return to > from ? c / (to - from) : 1; }
function batch(D, B, T, from, to) {
  const X = new Int32Array(B * T), Y = new Int32Array(B * T);
  for (let b = 0; b < B; b++) { const s = from + randInt(to - from - T - 1); for (let t = 0; t < T; t++) { X[b * T + t] = D.tokens[s + t]; Y[b * T + t] = tgt(D, s + t + 1); } }
  return { X, Y };
}
// Stałe okna do sprawdzania: te same przez całą naukę, więc kolejne pomiary da się porównywać.
function evalXY(D, T, from, to, S) {
  const span = to - from - T - 2, X = new Int32Array(S * T), Y = new Int32Array(S * T);
  for (let b = 0; b < S; b++) { const s = from + Math.floor(span * (b + .5) / S); for (let t = 0; t < T; t++) { X[b * T + t] = D.tokens[s + t]; Y[b * T + t] = tgt(D, s + t + 1); } }
  return { X, Y };
}
// Średnia z drugiej połowy okien (każdy oceniany token ma przed sobą co najmniej T/2 kontekstu), bez zamaskowanych.
// Przy maskowaniu (rozmowy) liczymy wszystkie pozycje okna, bo ocenianych tokenów jest mało; null = nic do oceny.
function meanRows(rows, Y, S, T, all) { let l = 0, n = 0; for (let b = 0; b < S; b++) for (let t = all ? 0 : T >> 1; t < T; t++) { const i = b * T + t; if (Y[i] >= 0) { l += rows[i]; n++; } } return n ? l / n : null; }
function cpuRows(m, { X, Y }, S, T) {
  const lg = m.forward(X, S, T).d, Vm = m.chars.length, out = new Float32Array(S * T);
  for (let i = 0; i < S * T; i++) {
    if (Y[i] < 0) continue;
    const o = i * Vm; let mx = -Infinity; for (let j = 0; j < Vm; j++) mx = Math.max(mx, lg[o + j]);
    let sum = 0; for (let j = 0; j < Vm; j++) sum += Math.exp(lg[o + j] - mx);
    out[i] = Math.log(sum) + mx - lg[o + Y[i]];
  }
  return out;
}

// ---------- generowanie ----------
function pickLogits(lg, temp) {
  let mx = -Infinity; for (const v of lg) if (v > mx) mx = v;
  const w = new Float64Array(lg.length); let s = 0;
  for (let i = 0; i < lg.length; i++) { w[i] = Math.exp((lg[i] - mx) / temp); s += w[i]; }
  let r = Math.random() * s;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return i; }
  return w.length - 1;
}
// Tekst z modelu: prompt → ciąg dalszy. Przy tokenach BPE końcowe spacje promptu odcinamy (spacja należy do następnego słowa).
function complete(m, net, prompt, { temp = .8, maxTokens = 200, untilNewline = false }) {
  const tk = m.tok, bpe = tk.merges.length > 0, nl = Math.max(0, m.chars.indexOf('\n'));
  let ids = tk.encode(bpe ? prompt.replace(/[^\S\n]+$/, '') : prompt);
  if (!ids.length) ids = [nl];
  const out = generate(net, ids, { temp, maxTokens, pick: pickLogits,
    stop: untilNewline ? o => tk.decode(o).trimStart().includes('\n') : null });
  return tk.decode(out);
}
function netOf(id) {
  const e = models.get(id);
  if (!e) throw new Error('Model nie jest wczytany do pamięci wątku.');
  if (!e.net) e.net = inferenceNet(e.m);
  return e;
}
// Dialog jako tekst: każda kwestia w osobnej linii, „<znacznik> <treść>”.
const dialogLine = (turn, tags) => `${turn.role === 'user' ? tags.user : tags.bot} ${turn.text}`;

// ---------- nauka (wspólna dla pretrainingu i dostrajania) ----------
function cpuBackend(hp) {
  try { return setBackend(hp.device === 'cpu' ? 'js' : 'wasm') === 'wasm' ? 'procesor · WASM SIMD' : 'procesor · JS'; }
  catch (err) { post({ type: 'warn', msg: err.message + ' Liczę zwykłym JS.' }); setBackend('js'); return 'procesor · JS'; }
}
let gpuEng = null;
async function getGPU() { if (!gpuEng || gpuEng.lost) gpuEng = await GPUEngine.create(); return gpuEng; }

async function trainModel(m, D, hp, meta) {
  const me = job = { id: meta.jobId, stop: false };
  const T = hp.ctx, B = hp.batch || 16, S = 32, nTok = D.tokens.length;
  if (D.nTrain < T + 2) throw new Error(`Za mało tekstu do nauki: ${D.nTrain} tokenów, potrzeba więcej niż okno (${T}).`);
  // za krótka część sprawdzająca: sprawdzamy na tekście do nauki (panel dostaje o tym informację)
  const ownVal = nTok - D.nTrain - 1 > T + 2, vFrom = ownVal ? D.nTrain + 1 : 1, vTo = ownVal ? nTok : D.nTrain;
  const vXY = evalXY(D, T, vFrom, vTo, S), tXY = evalXY(D, T, 1, D.nTrain, S);
  let g = null, device;
  if (hp.device === 'gpu') { const eng = await getGPU(); g = new GPUTransformer(eng, m, B, S); device = 'karta graficzna · ' + eng.name; }
  else device = cpuBackend(hp);
  const opt = g ? null : new Adam(m.params, hp.lr);
  const evalLoss = async xy => meanRows(g ? await g.evalRows(xy.X, xy.Y) : cpuRows(m, xy, S, T), xy.Y, S, T, !!D.tmask);
  if (await evalLoss(vXY) == null) throw new Error('W części sprawdzającej nie ma żadnej odpowiedzi AI do oceny. Dodaj więcej rozmów wzorcowych.');
  const snap = () => g ? g.snapshot() : m.params.map(p => p.d.slice());
  const sample = async () => { if (g) await g.pull(); return complete(m, inferenceNet(m), meta.prompt || '', { temp: .8, maxTokens: meta.sampleTokens || 80, untilNewline: !!meta.prompt }); };

  const t0 = now();
  let step = 0, ema = null, val = await evalLoss(vXY), best = { val, step: 0, w: snap() }, tVal = now(), tSample = now(), k = 1, ms = null;
  const base = () => ({ jobId: me.id, step, steps: hp.steps, train: ema, val, bestVal: best.val, bestStep: best.step, ms, device, params: m.count, elapsed: now() - t0, ownVal });
  post({ type: 'progress', ...base(), sample: await sample() });
  while (!me.stop && step < hp.steps) {
    const lr = hp.lr * (step > hp.steps * .7 ? .2 : 1);   // pod koniec mniejsze kroki: dopracowanie szczegółów
    const s0 = step, ts = now(); let L = 0;
    if (g) {
      const n = Math.min(k, hp.steps - step);
      g.steps(Array.from({ length: n }, () => batch(D, B, T, 0, D.nTrain)), lr, 1);
      L = await g.lastLoss(); step += n;
      ms = (now() - ts) / n; k = Math.max(1, Math.min(64, Math.round(150 / ms)));
      ema = ema == null ? L : ema * Math.pow(.97, n) + L * (1 - Math.pow(.97, n));
    } else {
      while (now() - ts < 60 && step < hp.steps) {
        const { X, Y } = batch(D, B, T, 0, D.nTrain), loss = crossEntropy(m.forward(X, B, T), Y);
        opt.zeroGrad(); backward(loss); opt.clip(1); opt.lr = lr; opt.step(); step++;
        ema = ema == null ? loss.d[0] : ema * .97 + loss.d[0] * .03;
      }
      ms = (now() - ts) / (step - s0);
    }
    const msg = { type: 'progress' };
    if (now() - tVal > 1500) { tVal = now(); val = await evalLoss(vXY); if (val < best.val - 1e-4) best = { val, step, w: snap() }; }
    if (now() - tSample > 9000) { tSample = now(); msg.sample = await sample(); }
    post({ ...msg, ...base() });
    await pause();                                          // miejsce na „stop” i odpowiedzi w czacie
  }
  // koniec: jeśli sieć zaczęła uczyć się na pamięć (błąd sprawdzający wyraźnie wzrósł), wracamy do najlepszego momentu
  val = await evalLoss(vXY); let restored = false;
  if (val < best.val - 1e-4) best = { val, step };
  else if (val > best.val + .01) { if (g) g.restore(); else m.params.forEach((p, i) => p.d.set(best.w[i])); val = best.val; restored = true; }
  if (g) await g.pull();
  const train = await evalLoss(tXY);
  if (job === me) job = null;
  models.set(meta.newId, { m, net: null });
  const tensors = m.params.map(p => p.d.slice());
  post({ type: 'done', ...base(), val, train, restored, stopped: me.stop, sample: await sample(), cpt: D.cpt,
    record: { hp, chars: m.chars, tok: m.tok.merges.length ? { merges: m.tok.merges, nBase: m.tok.nBase } : null, tensors, params: m.count } },
  tensors.map(t => t.buffer));
}

// ---------- pretraining: nauka języka na dokumentach ----------
async function pretrain(c) {
  let m, tok, dropped = {};
  if (c.from) {                                   // dalsza nauka istniejącego modelu: słownik i budowa zostają
    const src = models.get(c.from); if (!src) throw new Error('Model do dalszej nauki nie jest wczytany.');
    m = cloneModel(src.m, { steps: c.hp.steps, lr: c.hp.lr, device: c.hp.device, batch: c.hp.batch }); tok = m.tok;
    const known = new Set(tok.vocab.slice(0, tok.nBase));
    for (const ch of c.text) if (!known.has(ch)) dropped[ch] = (dropped[ch] || 0) + 1;
  } else {
    validateHP(c.hp);
    const nm = /^bpe(\d+)$/.exec(c.hp.unit || '');
    // Słownik obejmuje też znaki, których w dokumentach mogło nie być, a które dopuszcza formatowanie
    // i których używają znaczniki rozmowy (c.vocabChars) — inaczej model nie umiałby ich zapisać ani przeczytać.
    const extra = c.vocabChars || '';
    tok = nm ? bpeTrain(c.text + '\n' + extra, +nm[1], (r, n) => post({ type: 'tokprogress', jobId: c.jobId, r, n }))
             : charTokenizer([...new Set(c.text + extra)].sort((a, b) => a.localeCompare(b, 'pl')));
    m = buildTransformer(c.hp, tok.vocab); m.tok = tok;
  }
  const tokens = Int32Array.from(tok.encode(c.text)), nTrain = Math.floor(tokens.length * .9);
  const D = { tokens, nTrain, tmask: null };
  D.cpt = charsPerToken(D, m.chars, nTrain, tokens.length);
  post({ type: 'data', jobId: c.jobId, V: m.chars.length, tokens: tokens.length, nTrain, cpt: D.cpt, unit: tok.merges.length ? 'bpe' : 'char', merges: tok.merges.length, dropped });
  await trainModel(m, D, { ...m.hp, steps: c.hp.steps, lr: c.hp.lr, device: c.hp.device, batch: c.hp.batch, unit: c.hp.unit }, { jobId: c.jobId, newId: c.newId, prompt: '' });
}

// ---------- dostrajanie: uczenie odpowiadania na rozmowach ----------
// Uczymy kopię modelu na dialogach. Przy maskowaniu błąd liczy się tylko na kwestiach AI:
// sieć ma nauczyć się odpowiadać, a nie mówić za użytkownika.
async function finetune(c) {
  const src = models.get(c.from); if (!src) throw new Error('Model do dostrojenia nie jest wczytany.');
  const m = cloneModel(src.m, {}), tok = m.tok, tags = c.tags;
  const known = new Set(tok.vocab.slice(0, tok.nBase)), dropped = {};
  for (const tg of [tags.user, tags.bot]) {
    const miss = [...tg].filter(ch => !known.has(ch));
    if (miss.length) throw new Error(`Znacznik „${tg}” zawiera znaki, których model nie zna (${[...new Set(miss)].join(' ')}). Zmień znacznik w ustawieniach albo naucz model na tekście z tymi znakami.`);
  }
  const clean = s => [...s].filter(ch => { if (known.has(ch)) return true; dropped[ch] = (dropped[ch] || 0) + 1; return false; }).join('');
  const convs = c.dialogs.map(d => d.map(t => clean(dialogLine(t, tags))).join('\n')).filter(Boolean);
  if (convs.length < 2) throw new Error('Do dostrojenia potrzeba co najmniej 2 rozmów wzorcowych.');
  const nv = Math.max(1, Math.round(convs.length * (c.hp.valShare ?? .1)));
  const trainText = convs.slice(0, -nv).join('\n\n') + '\n\n', full = trainText + convs.slice(-nv).join('\n\n') + '\n';
  // maska znaków: 1 dla treści kwestii AI (po znaczniku, razem z końcem linii — sieć uczy się też kończyć odpowiedź)
  const cm = new Uint8Array(full.length), bt = tags.bot; let ls = 0;
  for (let i = 0; i <= full.length; i++) if (i === full.length || full[i] === '\n') {
    if (full.startsWith(bt, ls)) for (let j = ls + bt.length; j <= Math.min(i, full.length - 1); j++) cm[j] = 1;
    ls = i + 1;
  }
  const ids = tok.encode(full), tokens = Int32Array.from(ids), nTrain = tok.encode(trainText).length;
  const tm = new Uint8Array(ids.length); let pos = 0;
  ids.forEach((t, i) => { tm[i] = cm[pos] || 0; pos += m.chars[t].length; });
  const D = { tokens, nTrain, tmask: c.hp.mask ? tm : null };
  D.cpt = charsPerToken(D, m.chars, nTrain, tokens.length);
  const first = c.dialogs[c.dialogs.length - 1].find(t => t.role === 'user');
  post({ type: 'data', jobId: c.jobId, conv: convs.length, val: nv, tokens: tokens.length, learn: tm.reduce((a, b) => a + b, 0), cpt: D.cpt, dropped });
  await trainModel(m, D, { ...m.hp, steps: c.hp.steps, lr: c.hp.lr, device: c.hp.device, batch: c.hp.batch, mask: c.hp.mask },
    { jobId: c.jobId, newId: c.newId, prompt: `${first ? clean(dialogLine(first, tags)) : ''}\n${tags.bot}`, sampleTokens: 120 });
}

// ---------- odpowiedź w czacie ----------
function reply(c) {
  const e = netOf(c.id), t0 = now();
  const hist = c.history.slice(-(c.turns * 2 + 1)).map(t => dialogLine(t, c.tags)).join('\n') + '\n' + c.tags.bot;
  const raw = complete(e.m, e.net, hist, { temp: c.temp, maxTokens: c.maxTokens, untilNewline: true });
  return { text: raw.trimStart().split('\n')[0].trim(), ms: now() - t0 };
}

// ---------- karta graficzna: czy jest i jak się nazywa ----------
async function gpuInfo() {
  if (!self.navigator || !navigator.gpu) return { ok: false, msg: 'Ta przeglądarka nie udostępnia WebGPU.' };
  try { const eng = await getGPU(); return { ok: true, name: eng.name }; } catch (err) { return { ok: false, msg: String(err && err.message || err) }; }
}

self.onmessage = async e => {
  const c = e.data;
  try {
    if (c.cmd === 'load') {
      const r = c.record, m = buildTransformer(r.hp, r.chars);
      if (r.tensors.length !== m.params.length || r.tensors.some((t, i) => t.length !== m.params[i].size)) throw new Error('Plik modelu jest niekompletny albo z innej wersji silnika.');
      m.params.forEach((p, i) => p.d.set(r.tensors[i])); m.tok = tokenizerOf(r.chars, r.tok);
      models.set(c.id, { m, net: null });
      post({ type: 'loaded', reqId: c.reqId, id: c.id, params: m.count });
    }
    else if (c.cmd === 'unload') { models.delete(c.id); post({ type: 'unloaded', reqId: c.reqId, id: c.id }); }
    else if (c.cmd === 'pretrain' || c.cmd === 'finetune') {
      if (job) throw new Error('Trwa już nauka. Zatrzymaj ją albo poczekaj na koniec.');
      (c.cmd === 'pretrain' ? pretrain(c) : finetune(c)).catch(err => { job = null; post({ type: 'error', jobId: c.jobId, msg: String(err && err.message || err) }); });
    }
    else if (c.cmd === 'stop') { if (job) job.stop = true; }
    else if (c.cmd === 'reply') post({ type: 'reply', reqId: c.reqId, ...reply(c) });
    else if (c.cmd === 'complete') { const en = netOf(c.id); post({ type: 'complete', reqId: c.reqId, text: complete(en.m, en.net, c.prompt, c) }); }
    else if (c.cmd === 'gpuinfo') post({ type: 'gpuinfo', reqId: c.reqId, ...(await gpuInfo()) });
  } catch (err) { post({ type: 'error', reqId: c.reqId, jobId: c.jobId, msg: String(err && err.message || err) }); }
};
