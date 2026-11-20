// Struktura aktów prawnych: podział tekstu na artykuły, paragrafy i ustępy z metadanymi, odnośniki między przepisami
// (prosty graf) i eksport JSONL. Działa na tekście po formatowaniu – zwykłym albo w Markdown od zewnętrznego AI
// („### Art. 5.”, „#### § 1.”). Bez sieci i bez zapisu: liczone na bieżąco z tekstu dokumentu.

// skróty popularnych aktów (do podpisów „art. 45 ust. 1 u.k.k.” i rozpoznawania odnośników)
export const ACTS = [
  { short: 'k.p.c.', re: /kodeks(?:u|ie|em)? postępowania cywilnego|k\.p\.c\./i },
  { short: 'k.c.', re: /kodeks(?:u|ie|em)? cywiln\w*|\bk\.c\./i },
  { short: 'k.p.', re: /kodeks(?:u|ie|em)? pracy|\bk\.p\.(?!c)/i },
  { short: 'k.k.', re: /kodeks(?:u|ie|em)? karn\w*|\bk\.k\./i },
  { short: 'pr. bank.', re: /prawo bankowe|prawa bankowego|prawie bankowym|pr\. bank\./i },
  { short: 'u.k.k.', re: /kredycie konsumenckim|u\.k\.k\./i },
  { short: 'u.k.h.', re: /kredycie hipotecznym|u\.k\.h\./i },
  { short: 'u.r.f.', re: /rzeczniku finansowym|rozpatrywaniu reklamacji/i },
  { short: 'u.o.k.k.', re: /ochronie konkurencji i konsumentów|u\.o\.k\.k\./i },
  { short: 'RODO', re: /\bRODO\b|ochronie danych osobowych/i },
];
export function actShort(title) { const a = ACTS.find(x => x.re.test(title || '')); return a ? a.short : null; }

const H = '(?:#{1,6}\\s*)?';
const SUP = '¹²³⁴⁵⁶⁷⁸⁹⁰';
// numer artykułu w jednej postaci: „385¹”, „385^1” i „3851” (gdy indeks zgubiono) → „385^1” tylko dla dwóch pierwszych
export const normArt = a => String(a).replace(new RegExp(`[${SUP}]+`, 'g'), m => '^' + [...m].map(c => '1234567890'['¹²³⁴⁵⁶⁷⁸⁹⁰'.indexOf(c)]).join('')).replace(/\s+/g, '');
const ARTNUM = `\\d+[a-z]*(?:[${SUP}]+|\\^\\d+)?`;
const RE_ART = new RegExp(`^${H}Art\\.\\s*(${ARTNUM})\\.?\\s*(.*)$`, 'i');
const RE_PAR = new RegExp(`^${H}§\\s*(\\d+[a-z]*)\\.?\\s*(.*)$`);
const RE_UST = /^(\d+[a-z]*)\.\s+(.*)$/;
const RE_CHAP = new RegExp(`^${H}((?:KSIĘGA|Księga|TYTUŁ|Tytuł|DZIAŁ|Dział|ROZDZIAŁ|Rozdział|Oddział)\\s+[\\wIVXLC]+.*)$`);

// tekst → { units: [{ art, par, ust, chapter, text }], articles: [{ art, chapter, text, parts }] }
export function parseStructure(text) {
  const articles = []; let chapter = null, cur = null;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim(); if (!line) { if (cur) cur.lines.push(''); continue; }
    let m;
    if ((m = RE_CHAP.exec(line)) && !/^Art\./i.test(line)) { chapter = m[1].replace(/\s+/g, ' ').slice(0, 120); continue; }
    if ((m = RE_ART.exec(line))) { cur = { art: normArt(m[1]), chapter, lines: m[2] ? [m[2]] : [] }; articles.push(cur); continue; }
    if (cur) cur.lines.push(line.replace(/^#{1,6}\s*/, ''));
  }
  const units = [];
  for (const a of articles) {
    a.text = a.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(); delete a.lines;
    // podział na § (kodeksy) albo ustępy „1.” (ustawy); pierwszy ustęp bywa w linii artykułu
    a.parts = []; let p = null;
    for (const l of a.text.split('\n')) {
      let m;
      if ((m = RE_PAR.exec(l))) { p = { par: m[1], text: m[2] }; a.parts.push(p); }
      else if ((m = RE_UST.exec(l)) && !a.parts.some(x => x.par)) { p = { ust: m[1], text: m[2] }; a.parts.push(p); }
      else if (p) p.text += '\n' + l; else a.parts.push(p = { text: l });
    }
    if (a.parts.length > 1 && a.parts.some(x => x.par || x.ust)) for (const x of a.parts) units.push({ art: a.art, par: x.par || null, ust: x.ust || null, chapter: a.chapter, text: x.text.trim() });
    else units.push({ art: a.art, par: null, ust: null, chapter: a.chapter, text: a.text });
  }
  return { articles, units };
}
export const isStructured = text => parseStructure(text).articles.length >= 3;

// podpis przepisu, np. „art. 45 ust. 1 u.k.k.”
export const unitLabel = (u, short) => `art. ${u.art.replace(/\^(\d+)/, (_, d) => [...d].map(c => SUP[(+c + 9) % 10]).join(''))}${u.par ? ' § ' + u.par : u.ust ? ' ust. ' + u.ust : ''}${short ? ' ' + short : ''}`;

// ---------- odnośniki ----------
// „art. 69 ust. 1 Prawa bankowego”, „art. 385¹ k.c.”, „art. 45 ustawy o kredycie konsumenckim”, „art. 5 § 2” (ten sam akt)
const RE_REF = new RegExp(`\\bart\\.\\s*(${ARTNUM})(?:\\s*(§|ust\\.)\\s*(\\d+[a-z]*))?(?:\\s*pkt\\s*\\d+[a-z]*\\)?)?(?:\\s+(k\\.p\\.c\\.|k\\.c\\.|k\\.p\\.|k\\.k\\.|pr\\.\\s*bank\\.|u\\.k\\.k\\.|u\\.k\\.h\\.|u\\.o\\.k\\.k\\.|RODO|(?:ustawy|kodeksu|Kodeksu|Prawa|rozporządzenia)\\s[^,.;:()\\n]{3,90}))?`, 'g');
export function findRefs(text) {
  const out = []; let m; RE_REF.lastIndex = 0;
  while ((m = RE_REF.exec(String(text || '')))) {
    const art = normArt(m[1]), part = m[3] ? (m[2] === '§' ? '§ ' : 'ust. ') + m[3] : null, act = m[4] ? m[4].trim() : null;
    out.push({ art, part, act, short: act ? actShort(act) : null, raw: m[0].trim(), index: m.index });
  }
  return out;
}

// biblioteka → { docs: [{ doc, short, articles }], resolve(ref, fromDoc) → { doc, art } | null, incoming(doc, art) }
export function buildGraph(docs) {
  const items = docs.map(d => ({ doc: d, short: actShort(d.name) || actShort(d.description), articles: parseStructure(d.text).articles })).filter(x => x.articles.length >= 3);
  const byShort = new Map(items.filter(x => x.short).map(x => [x.short, x]));
  const has = (it, art) => it.articles.some(a => a.art === art);
  // akt, do którego prowadzi odnośnik (jeśli jest w bibliotece)
  const actOf = (ref, from) => {
    let it = ref.short ? byShort.get(ref.short) : null;
    if (!it && ref.act) it = items.find(x => x.doc.name.toLowerCase().includes(ref.act.toLowerCase().replace(/^(ustawy|kodeksu|prawa|rozporządzenia)\s+/i, '').slice(0, 30)));
    if (!it && !ref.act) it = items.find(x => x.doc.id === (from && from.id));
    return it || null;
  };
  const resolve = (ref, from) => { const it = actOf(ref, from); return it && has(it, ref.art) ? { doc: it.doc, art: ref.art } : null; };
  const incoming = (doc, art) => {
    const out = [];
    for (const it of items) for (const a of it.articles) for (const r of findRefs(a.text)) { const t = resolve(r, it.doc); if (t && t.doc.id === doc.id && t.art === art && !(it.doc.id === doc.id && a.art === art)) out.push({ doc: it.doc, art: a.art, short: it.short }); }
    return out;
  };
  return { items, resolve, actOf, incoming, find: id => items.find(x => x.doc.id === id) };
}

// ---------- eksport JSONL: jeden przepis (artykuł / paragraf / ustęp) w linii ----------
export function toJSONL(docs) {
  const lines = [];
  for (const d of docs) {
    const { units } = parseStructure(d.text); if (units.length < 3) continue;
    const short = actShort(d.name) || actShort(d.description);
    for (const u of units) lines.push(JSON.stringify({ akt: d.name, skrot: short, eli: d.eli || null, zrodlo: d.sourceUrl || null, stan_prawny: d.sourceChangeDate || null,
      rozdzial: u.chapter, artykul: u.art, paragraf: u.par, ustep: u.ust, przepis: unitLabel(u, short), tekst: u.text,
      odnosniki: findRefs(u.text).map(r => ({ przepis: `art. ${r.art.replace('^', '')}${r.part ? ' ' + r.part : ''}`, akt: r.short || r.act || '(ten sam akt)' })), kategorie: d.tags || [], dokument: d.id }));
  }
  return lines.join('\n') + (lines.length ? '\n' : '');
}
