// Kategorie (plakietki) dokumentów: wyświetlanie w kolorze grupy, edycja, filtr pogrupowany i okno „Grupy kategorii”.

import { h, clear, num, help, modal, toast, confirmBox } from './dom.js';
import { tagCounts, normTag, mergeTags, SUGGESTED_TAGS } from '../core/documents.js';
import { tagGroups, groupOf, groupCounts, saveTagGroups, resetTagGroups, COLORS } from '../core/taggroups.js';

const chip = (t, ...kids) => h('span.tag.c-' + groupOf(t).color, { title: 'Grupa: ' + groupOf(t).name }, t, ...kids);
const allSuggestions = extra => mergeTags(extra, tagGroups().flatMap(g => g.tags), SUGGESTED_TAGS);

// plakietki tylko do odczytu (w kolejności grup)
const order = t => { const i = tagGroups().indexOf(groupOf(t)); return i < 0 ? 99 : i; };
export const tagChips = tags => (tags || []).slice().sort((a, b) => order(a) - order(b)).map(t => chip(t));

// edycja: plakietki z „×” i pole dopisania (podpowiedzi z grup i już używanych kategorii)
let dl = 0;
export function tagEditor(doc, allTags, save) {
  const id = 'tagdl' + (++dl), box = h('div.tagedit');
  const input = h('input.taginput', { type: 'text', list: id, placeholder: '+ kategoria', 'aria-label': 'Dodaj kategorię', size: 12,
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }, onchange: () => add() });
  const opts = h('datalist', { id }, allSuggestions(allTags).map(t => h('option', { value: t, label: groupOf(t).name })));
  async function add() { const t = normTag(input.value); input.value = ''; if (!t) return; doc.tags = mergeTags(doc.tags, [t]); await save(doc); draw(); }
  function draw() {
    clear(box);
    box.append(...doc.tags.slice().sort((a, b) => order(a) - order(b)).map(t => chip(t, h('button.tagx', { type: 'button', title: `Usuń kategorię „${t}”`, 'aria-label': `Usuń kategorię ${t}`, onclick: async () => { doc.tags = doc.tags.filter(x => x !== t); await save(doc); draw(); } }, '×'))), input, opts);
  }
  draw();
  return box;
}

// filtr: kategorie pogrupowane, z liczbą dokumentów; zaznaczone muszą występować wszystkie naraz
export function tagFilter(docs, selected, onChange) {
  const groups = groupCounts(tagCounts(docs));
  if (!groups.length) return h('div');
  return h('div.tagfilter',
    ...groups.map(({ group, items }) => h('div.row.wrap.taggroup', h('span.tgname.c-' + group.color, group.name),
      ...items.map(([t, n]) => h('button.tagbtn.c-' + group.color + (selected.has(t) ? '.on' : ''), { type: 'button', 'aria-pressed': selected.has(t) ? 'true' : 'false',
        onclick: () => { selected.has(t) ? selected.delete(t) : selected.add(t); onChange(); } }, `${t} (${num(n)})`)))),
    h('div.row.wrap', selected.size ? h('button.ghost.small', { type: 'button', onclick: () => { selected.clear(); onChange(); } }, 'Wszystkie kategorie') : null,
      h('button.ghost.small', { type: 'button', onclick: () => tagGroupsModal(docs, onChange) }, 'Grupy kategorii'),
      help('Kategorie są pogrupowane (np. Rodzaj dokumentu, Dziedzina, Źródło, Stan), każda grupa ma swój kolor. W „Grupy kategorii” dodasz grupę, zmienisz jej nazwę i kolor i przypiszesz do niej kategorie.', 'kategorie')));
}

// okno edycji grup: nazwa, kolor, kategorie (po przecinku); kategorie z dokumentów spoza grup do przypisania
export function tagGroupsModal(docs, onDone = () => {}) {
  const used = tagCounts(docs || []).map(([t]) => t);
  const rows = tagGroups().map(g => ({ ...g }));
  const box = h('div');
  const draw = () => {
    clear(box);
    const inGroups = new Set(rows.flatMap(r => r.tags.map(t => t.toLowerCase())));
    const loose = used.filter(t => !inGroups.has(t.toLowerCase()));
    box.append(...rows.map((r, i) => {
      const name = h('input', { type: 'text', value: r.name, oninput: e => { r.name = e.target.value; } });
      const color = h('select', { onchange: e => { r.color = e.target.value; draw(); } }, Object.entries(COLORS).map(([l, v]) => h('option', { value: v, selected: v === r.color }, l)));
      const tags = h('textarea', { rows: 2, value: r.tags.join(', '), oninput: e => { r.tags = e.target.value.split(',').map(x => x.trim()).filter(Boolean); } });
      return h('div.tgrow.c-' + r.color, h('div.row.wrap', h('span.tgname.c-' + r.color, r.name || 'Grupa'), name, color, h('span.sp'),
        h('button.ghost.small.danger', { type: 'button', onclick: () => { rows.splice(i, 1); draw(); } }, 'Usuń grupę')), h('label.note', 'Kategorie (po przecinku)'), tags);
    }),
      h('div.row.wrap', h('button.ghost.small', { type: 'button', onclick: () => { rows.push({ id: '', name: 'Nowa grupa', color: 'green', tags: [] }); draw(); } }, 'Dodaj grupę')),
      loose.length ? h('div', h('p.note', 'Kategorie z dokumentów bez grupy (teraz w „Inne”) – kliknij, żeby dopisać do grupy:'),
        h('div.row.wrap', ...loose.map(t => h('span.tag.c-gray', t, ...rows.map(r => h('button.tagx.c-' + r.color, { type: 'button', title: `Do grupy „${r.name}”`, onclick: () => { r.tags.push(t); draw(); } }, '→' + r.name.slice(0, 10))))))) : null);
  };
  draw();
  const close = modal('Grupy kategorii', h('p.note', 'Grupy porządkują kategorie w filtrze i nadają im kolor. Kategoria może być tylko w jednej grupie; nieprzypisane są w „Inne” (szare). Zmiana grup nie zmienia kategorii dokumentów.'), box,
    h('div.row.end', h('button.ghost', { type: 'button', onclick: async () => { if (await confirmBox('Przywrócić domyślne grupy?', 'Twoje grupy zostaną zastąpione domyślnymi.', 'Przywróć')) { await resetTagGroups(); close(); onDone(); } } }, 'Przywróć domyślne'),
      h('button', { type: 'button', onclick: async () => { await saveTagGroups(rows); close(); toast('Zapisano grupy kategorii.', 'ok'); onDone(); } }, 'Zapisz grupy')));
}
