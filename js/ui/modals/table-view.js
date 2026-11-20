// Okno „Tabela”: przepisy z aktów albo rozmowy wzorcowe w wierszach – sortowanie po kolumnie, filtr tekstu
// i problemu, podświetlone problemy (pusty tekst, duplikat, brak licencji, zły odnośnik). Kliknięcie wiersza
// otwiera przepis w „Strukturze” albo rozmowę do edycji.

import { h, help, clear, modal, num, plural } from '../dom.js';
import { listDocs } from '../../core/documents.js';
import { listDialogs, dialogInProfile } from '../../core/dialogs.js';
import { provisionRows, dialogRows, sortRows, filterRows, problemCounts, PROBLEMS } from '../../core/datatable.js';
import { structureView } from './structure-view.js';
import { editDialogModal } from '../dialog-editor.js';

const MAX = 1000;
const COLS = {
  przepisy: [['label', 'Przepis'], ['chapter', 'Rozdział'], ['text', 'Treść'], ['license', 'Licencja'], ['problems', 'Problemy']],
  rozmowy: [['question', 'Pytanie'], ['answer', 'Odpowiedź'], ['turns', 'Kwestie'], ['source', 'Źródło'], ['status', 'Stan'], ['problems', 'Problemy']],
};

// docs – dokumenty z bieżącej listy Formatowania
export async function tableView(docs, start = 'przepisy') {
  const library = await listDocs();
  let mode = start, rows = [], sortKey = null, dir = 1;
  const q = h('input', { type: 'search', placeholder: 'Szukaj w tabeli…', oninput: () => draw() });
  const prob = h('select', { onchange: () => draw() });
  const tabs = h('div.row'), info = h('span.note'), box = h('div.dtwrap');

  async function load() {
    rows = mode === 'przepisy' ? provisionRows(docs, library) : dialogRows((await listDialogs()).filter(d => dialogInProfile(d)), library);
    const c = problemCounts(rows), any = rows.filter(r => r.problems.length).length, keep = prob.value;
    clear(prob); prob.append(h('option', { value: '' }, 'Wszystkie wiersze'), h('option', { value: 'any' }, `Z problemami (${num(any)})`),
      ...Object.entries(PROBLEMS).filter(([id]) => c[id]).map(([id, n]) => h('option', { value: id }, `${n} (${num(c[id])})`)));
    prob.value = [...prob.options].some(o => o.value === keep) ? keep : '';
    drawTabs(); draw();
  }
  function drawTabs() {
    clear(tabs);
    for (const [m, label, tip] of [['przepisy', 'Przepisy', 'Pokaż w tabeli przepisy z aktów z bieżącej listy.'], ['rozmowy', 'Rozmowy wzorcowe', 'Pokaż w tabeli rozmowy wzorcowe.']])
      tabs.append(h('button.small' + (m === mode ? '' : '.ghost'), { type: 'button', title: tip, 'aria-pressed': String(m === mode), onclick: () => { if (mode !== m) { mode = m; sortKey = null; load(); } } }, label));
  }
  function cell(r, key) {
    if (key === 'problems') return h('td', ...r.problems.map(p => h('span.tag.old', { title: p.info || null }, PROBLEMS[p.id])));
    const v = String(r[key] ?? ''), empty = (key === 'text' || key === 'question' || key === 'answer') && r.problems.some(p => p.id === 'empty');
    const td = h('td' + (key === 'text' || key === 'question' || key === 'answer' ? '.dttext' : ''), v.length > 220 ? v.slice(0, 220) + '…' : v);
    if (key === 'license' && !v) td.classList.add('dtbad');
    if (empty) td.classList.add('dtbad');
    return td;
  }
  function draw() {
    const shown = filterRows(sortKey ? sortRows(rows, sortKey, dir) : rows, q.value, prob.value);
    info.textContent = `${num(shown.length)} z ${num(rows.length)} ${plural(rows.length, 'wiersz', 'wiersze', 'wierszy')}` + (shown.length > MAX ? ` (pokazano pierwsze ${num(MAX)})` : '');
    clear(box);
    if (!rows.length) { box.append(h('p.note', mode === 'przepisy' ? 'Na liście nie ma aktów z co najmniej 3 artykułami („Art. 1.”). Najlepiej działa na aktach sformatowanych przez AI.' : 'Brak rozmów wzorcowych.')); return; }
    const cols = COLS[mode];
    const head = h('tr', ...cols.map(([k, label]) => h('th', h('button.dtsort', { type: 'button', title: 'Sortuj', onclick: () => { if (sortKey === k) dir = -dir; else { sortKey = k; dir = k === 'problems' ? -1 : 1; } draw(); } }, label + (sortKey === k ? (dir > 0 ? ' ▲' : ' ▼') : '')))));
    const body = shown.slice(0, MAX).map(r => h('tr' + (r.problems.length ? '.dtprob' : ''), { tabindex: 0, title: mode === 'przepisy' ? `${r.akt} – kliknij, aby otworzyć w Strukturze` : 'Kliknij, aby edytować rozmowę',
      onclick: () => open(r), onkeydown: e => { if (e.key === 'Enter') open(r); } }, ...cols.map(([k]) => cell(r, k))));
    box.append(h('table.dt', h('thead', head), h('tbody', ...body)));
  }
  function open(r) {
    if (r.kind === 'przepis') structureView(r.docId, r.art);
    else editDialogModal(r.dialog, () => load());
  }
  modal('Tabela', h('div.row.wrap', tabs, help('Każdy przepis (paragraf albo ustęp) albo rozmowa wzorcowa w osobnym wierszu. Kliknij nagłówek, aby posortować; „Problemy” pokazuje pusty tekst, duplikat, brak licencji i odnośnik do artykułu, którego nie ma w akcie z biblioteki. Kliknięcie wiersza otwiera przepis w Strukturze albo rozmowę do edycji.', 'tabela')),
    h('div.row.wrap.dtbar', q, prob, info), box);
  await load();
}
