// Okno „Struktura i powiązania”: spis artykułów aktu, treść wybranego artykułu z klikalnymi odnośnikami
// (także do innych aktów z biblioteki) i lista przepisów, które go cytują. Pobranie aktu jako JSONL.

import { h, clear, modal, download, num } from '../dom.js';
import { listDocs } from '../../core/documents.js';
import { buildGraph, findRefs, unitLabel, toJSONL } from '../../core/structure.js';

const SUPL = a => a.replace(/\^(\d+)/, (_, d) => [...d].map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]).join(''));

export async function structureView(docId, startArt = null) {
  const g = buildGraph(await listDocs());
  let it = g.find(docId);
  if (!it) return modal('Struktura', h('p.note', 'W tym dokumencie nie rozpoznano co najmniej 3 artykułów („Art. 1.”).'));
  const toc = h('div.sttoc'), body = h('div.stbody'), q = h('input', { type: 'search', placeholder: 'Szukaj artykułu (numer albo słowo)…', oninput: () => drawToc() });
  const head = h('div.row.wrap');
  const history = [];
  function show(doc, art, push = true) {
    if (push && it) history.push([it.doc.id, cur]);
    it = g.find(doc.id); cur = art; drawHead(); drawToc(); drawBody();
  }
  let cur = startArt && it.articles.some(a => a.art === startArt) ? startArt : it.articles[0].art;
  function drawHead() {
    clear(head);
    head.append(h('b', it.doc.name), it.short ? h('span.tag.c-blue', it.short) : null, h('span.note', `${num(it.articles.length)} artykułów`), h('span.sp'),
      history.length ? h('button.ghost.small', { type: 'button', onclick: () => { const [id, art] = history.pop(); show(g.find(id).doc, art, false); } }, '← Wstecz') : null,
      h('button.ghost.small', { type: 'button', onclick: () => download(`${(it.short || it.doc.name).replace(/[^\p{L}\p{N}]+/gu, '-').slice(0, 40)}.jsonl`, toJSONL([it.doc]), 'application/x-ndjson') }, 'Pobierz JSONL'));
  }
  function drawToc() {
    clear(toc); const s = q.value.trim().toLowerCase(); let ch = null;
    for (const a of it.articles) {
      if (s && !(('art. ' + SUPL(a.art)).toLowerCase().includes(s) || a.art === s || a.text.toLowerCase().includes(s))) continue;
      if (a.chapter && a.chapter !== ch) { ch = a.chapter; toc.append(h('div.stch', ch)); }
      toc.append(h('button.stitem' + (a.art === cur ? '.on' : ''), { type: 'button', onclick: () => { cur = a.art; drawToc(); drawBody(); } }, 'Art. ' + SUPL(a.art)));
    }
  }
  function linked(text) {
    const frag = h('div.sttext'); let last = 0;
    for (const r of findRefs(text)) {
      frag.append(text.slice(last, r.index));
      const t = g.resolve(r, it.doc);
      frag.append(t ? h('a.stref', { href: '#', title: `${t.doc.name}, art. ${SUPL(t.art)}`, onclick: e => { e.preventDefault(); show(t.doc, t.art); } }, r.raw)
        : h('span.stref.miss', { title: r.act || r.short ? 'Tego aktu albo artykułu nie ma w bibliotece' : 'Artykuł tego samego aktu, którego nie rozpoznano' }, r.raw));
      last = r.index + r.raw.length;
    }
    frag.append(text.slice(last)); return frag;
  }
  function drawBody() {
    clear(body);
    const a = it.articles.find(x => x.art === cur); if (!a) return;
    const refs = findRefs(a.text), inc = g.incoming(it.doc, a.art);
    body.append(h('h3', unitLabel({ art: a.art }, it.short) + (a.chapter ? ' · ' + a.chapter : '')), linked(a.text),
      h('div.stlinks', h('b', `Odnośniki z tego artykułu (${refs.length})`),
        refs.length ? h('ul', refs.map(r => { const t = g.resolve(r, it.doc); return h('li', t ? h('a', { href: '#', onclick: e => { e.preventDefault(); show(t.doc, t.art); } }, `${r.raw} → ${t.doc.name}`) : h('span.note', `${r.raw} – brak w bibliotece`)); })) : h('p.note', 'brak'),
        h('b', `Cytowany przez (${inc.length})`),
        inc.length ? h('ul', inc.slice(0, 50).map(x => h('li', h('a', { href: '#', onclick: e => { e.preventDefault(); show(x.doc, x.art); } }, `${unitLabel({ art: x.art }, x.short)} – ${x.doc.name}`)))) : h('p.note', 'żaden przepis z biblioteki')));
  }
  drawHead(); drawToc(); drawBody();
  modal('Struktura i powiązania', head, h('div.stwrap', h('div.stside', q, toc), body));
}
