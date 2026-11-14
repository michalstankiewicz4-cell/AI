// Kategorie (plakietki) dokumentów: wyświetlanie, edycja i filtr.

import { h, clear, num } from './dom.js';
import { tagCounts, normTag, mergeTags, SUGGESTED_TAGS, OUTDATED } from '../core/documents.js';

const cls = t => t === OUTDATED || t === 'stary' ? 'span.tag.old' : 'span.tag';

// plakietki tylko do odczytu
export const tagChips = tags => (tags || []).map(t => h(cls(t), t));

// edycja: plakietki z „×” i pole dopisania (podpowiedzi z już używanych kategorii)
let dl = 0;
export function tagEditor(doc, allTags, save) {
  const id = 'tagdl' + (++dl), box = h('div.tagedit');
  const input = h('input.taginput', { type: 'text', list: id, placeholder: '+ kategoria', 'aria-label': 'Dodaj kategorię', size: 12,
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }, onchange: () => add() });
  const opts = h('datalist', { id }, mergeTags(allTags, SUGGESTED_TAGS).map(t => h('option', { value: t })));
  async function add() { const t = normTag(input.value); input.value = ''; if (!t) return; doc.tags = mergeTags(doc.tags, [t]); await save(doc); draw(); }
  function draw() {
    clear(box);
    box.append(...doc.tags.map(t => h(cls(t), t, h('button.tagx', { type: 'button', title: `Usuń kategorię „${t}”`, 'aria-label': `Usuń kategorię ${t}`, onclick: async () => { doc.tags = doc.tags.filter(x => x !== t); await save(doc); draw(); } }, '×'))), input, opts);
  }
  draw();
  return box;
}

// filtr: kategorie z liczbą dokumentów; zaznaczone muszą występować wszystkie naraz
export function tagFilter(docs, selected, onChange) {
  const counts = tagCounts(docs);
  if (!counts.length) return h('div');
  return h('div.row.wrap.tagfilter', h('span.note', 'Kategorie:'),
    ...counts.map(([t, n]) => h('button' + (t === OUTDATED || t === 'stary' ? '.tagbtn.old' : '.tagbtn') + (selected.has(t) ? '.on' : ''), { type: 'button', 'aria-pressed': selected.has(t) ? 'true' : 'false',
      onclick: () => { selected.has(t) ? selected.delete(t) : selected.add(t); onChange(); } }, `${t} (${num(n)})`)),
    selected.size ? h('button.ghost.small', { type: 'button', onclick: () => { selected.clear(); onChange(); } }, 'Wszystkie kategorie') : null);
}
