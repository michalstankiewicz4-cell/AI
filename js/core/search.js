// Wyszukiwanie w bibliotece: fragmenty zatwierdzonych dokumentów najlepiej pasujące do pytania (BM25).
// Czat pokazuje je pod odpowiedzią modelu – dokładny przepis z dokumentu zamiast tego, co sieć „pamięta”.
// Indeks liczy się w przeglądarce przy pierwszym pytaniu i odświeża, gdy zmieni się biblioteka.

import { listDocs, OUTDATED } from './documents.js';
import { parseStructure, actShort, unitLabel } from './structure.js';

const STOP = new Set('i w z na do o a że się nie to jest jak czy co od po za przez dla lub oraz ten ta te tego tej tym jego jej ich być może mnie mi mam ma są był była było by już tak tylko także też gdy kiedy który która które którego której ile jaki jaka jakie gdzie albo ale bo przy pod nad'.split(' '));
// prosty „rdzeń”: małe litery, pierwsze 6 znaków – wystarczy, by „urlopu”, „urlopie” i „urlop” się spotkały
export const terms = t => (String(t).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).filter(w => w.length > 1 && !STOP.has(w)).map(w => w.slice(0, 6));

// Dokument → fragmenty po akapitach, łączone do ok. 700 znaków
export function chunks(text, max = 700) {
  const out = []; let cur = '';
  for (const p of String(text).split(/\n\s*\n|\n(?=(?:Art\.|§|Rozdział|DZIAŁ)\s)/)) {
    const s = p.trim(); if (!s) continue;
    if (cur && (cur.length + s.length > max)) { out.push(cur); cur = ''; }
    if (s.length > max * 1.6) { for (let i = 0; i < s.length; i += max) out.push(s.slice(i, i + max)); continue; }
    cur = cur ? cur + '\n' + s : s;
  }
  if (cur) out.push(cur);
  return out;
}

// akt z rozpoznaną strukturą: fragment = artykuł (długi dzielony), z podpisem „art. 45 u.k.k.”; inne dokumenty – akapity
export function docChunks(d) {
  const { articles } = parseStructure(d.text);
  if (articles.length < 3) return chunks(d.text).map(text => ({ text, art: null, label: null }));
  const short = actShort(d.name) || actShort(d.description), out = [];
  for (const a of articles) { const label = unitLabel({ art: a.art }, short); for (const t of chunks(a.text, 900)) out.push({ text: `Art. ${label.slice(5).replace(short ? ' ' + short : '', '')}. ${t}`, art: a.art, label }); }
  return out;
}

export function buildIndex(docs) {
  const parts = [], df = new Map();
  for (const d of docs) for (const { text, art, label } of docChunks(d)) {
    const tf = new Map(), ts = terms(text);
    for (const w of ts) tf.set(w, (tf.get(w) || 0) + 1);
    for (const w of tf.keys()) df.set(w, (df.get(w) || 0) + 1);
    parts.push({ doc: d, text, tf, len: ts.length, art, label });
  }
  const avg = parts.reduce((a, p) => a + p.len, 0) / (parts.length || 1);
  return { parts, df, avg, N: parts.length };
}

// k1, b – zwykłe wartości BM25. Tekst ogólny i dokumenty „nieaktualne” mają mniejszą wagę.
export function searchIndex(ix, query, k = 3) {
  const q = [...new Set(terms(query))]; if (!q.length || !ix.N) return [];
  const idf = w => { const n = ix.df.get(w) || 0; return n ? Math.log(1 + (ix.N - n + .5) / (n + .5)) : 0; };
  const res = [];
  for (const p of ix.parts) {
    let s = 0, hit = 0;
    for (const w of q) { const f = p.tf.get(w); if (!f) continue; hit++; s += idf(w) * f * 2.2 / (f + 1.2 * (.25 + .75 * p.len / ix.avg)); }
    if (!hit) continue;
    s *= (p.doc.general ? .7 : 1) * ((p.doc.tags || []).includes(OUTDATED) ? .3 : 1) * (.6 + .4 * hit / q.length);
    res.push({ score: s, p });
  }
  res.sort((a, b) => b.score - a.score);
  const seen = new Set(), out = [];
  for (const { score, p } of res) {
    if (seen.has(p.text)) continue; seen.add(p.text);
    out.push({ docId: p.doc.id, art: p.art || null, label: p.label || null, name: p.doc.name, eli: p.doc.eli || null, tags: p.doc.tags || [], general: !!p.doc.general, text: p.text, score: +score.toFixed(3) });
    if (out.length >= k) break;
  }
  return out;
}

let cache = null;
export async function searchLibrary(query, k = 3) {
  const docs = (await listDocs()).filter(d => d.status === 'zatwierdzony' && d.enabled && d.text);
  const key = docs.map(d => d.id + ':' + (d.formattedAt || 0) + ':' + (d.tags || []).join(',')).join('|');
  if (!cache || cache.key !== key) cache = { key, ix: buildIndex(docs) };
  return searchIndex(cache.ix, query, k);
}
