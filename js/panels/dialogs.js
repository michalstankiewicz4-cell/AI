// Zakładka „Rozmowy wzorcowe”: zestaw do dostrajania. Import z pliku, dopisywanie ręczne, edycja,
// włączanie/wyłączanie. Każda kwestia przechodzi przez formatowanie, a rozmowa przez sprawdzenie formatu.

import { h, help, toast, confirmBox, modal, pickFiles, num, date, clear, download, plural } from '../ui/dom.js';
import { parseDialogs, dialogToText } from '../cleaner/dialogs.js';
import { listDialogs, makeDialog, saveDialog, deleteDialog } from '../core/dialogs.js';
import { settings, saveSettings, cleanerOpts, tags } from '../core/settings.js';
import { fieldsForm } from '../ui/form.js';
import { dialogEditor } from '../ui/dialog-editor.js';
import { db } from '../core/db.js';

export default {
  id: 'rozmowy-wzorcowe', title: 'Rozmowy wzorcowe', stage: 2, icon: '💬',
  render(root) {
    const listBox = h('div'), stats = h('p.note');
    const search = h('input', { type: 'search', placeholder: 'Szukaj w rozmowach…', oninput: () => drawList() });
    root.append(
      h('header.ph', h('h1', 'Rozmowy wzorcowe'),
        h('p', 'Krok 2. Przykłady pytań i poprawnych odpowiedzi. Na nich sieć uczy się odpowiadać (dostrajanie). Nie trzeba opisać wszystkich możliwych pytań: sieć uogólnia na podobne, ale im więcej różnorodnych przykładów z danego tematu, tym lepiej.')),
      h('section.card',
        h('div.row',
          h('button', { type: 'button', onclick: addManual }, 'Dodaj rozmowę'),
          h('button.ghost', { type: 'button', onclick: importFile }, 'Wczytaj z pliku'),
          h('button.ghost', { type: 'button', onclick: exportFile }, 'Pobierz jako plik'),
          help(`Format pliku .txt: każda kwestia w osobnej linii, zaczyna się znacznikiem („${settings().general.userTag}” albo „${settings().general.botTag}”), rozmowy oddzielone pustą linią. Szczegóły w Pomocy.`, 'format-pliku'))),
      h('details.card.settings', h('summary', h('b', 'Ustawienia rozmów wzorcowych')), fieldsForm('cleaner', settings().cleaner, { only: ['maxAnswer'], onChange: () => saveSettings(settings()) })),
      h('section.card', h('div.row', h('h2', 'Zestaw'), h('span.sp'), search), stats, listBox));

    function addManual() {
      const close = modal('Nowa rozmowa wzorcowa', dialogEditor([], async turns => {
        try { await saveDialog(makeDialog(turns, 'ręcznie')); close(); toast('Dodano rozmowę.', 'ok'); drawList(); } catch (e) { toast(e.message, 'error'); }
      }));
    }
    async function importFile() {
      const [f] = await pickFiles('.txt,text/plain', false); if (!f) return;
      const text = new TextDecoder().decode(await f.arrayBuffer());
      const r = parseDialogs(text, tags(), cleanerOpts());
      const close = modal(`Wczytywanie: ${f.name}`,
        h('p', `Poprawnych rozmów: ${num(r.dialogs.length)}. Błędnych: ${num(r.errors.length)} (nie zostaną dodane).`),
        r.errors.length ? h('div.errors', r.errors.slice(0, 50).map(e => h('div.err', h('b', `Linia ${e.line}: `), e.msg, h('pre.small', e.text)))) : null,
        r.notes.length ? h('details', h('summary', `Uwagi (${r.notes.length})`), h('ul', r.notes.slice(0, 50).map(n => h('li', n)))) : null,
        h('div.row.end', h('button', { type: 'button', disabled: !r.dialogs.length, onclick: async () => {
          const recs = r.dialogs.map(d => makeDialog(d, 'plik', { file: f.name }));
          await db.putMany('dialogs', recs); close(); toast(`Dodano ${recs.length} ${plural(recs.length, 'rozmowę', 'rozmowy', 'rozmów')}.`, 'ok'); drawList();
        } }, `Dodaj ${num(r.dialogs.length)}`)));
    }
    async function exportFile() {
      const all = await listDialogs();
      if (!all.length) return toast('Zestaw jest pusty.', 'error');
      download('rozmowy-wzorcowe.txt', all.slice().reverse().map(d => dialogToText(d.turns, tags())).join('\n\n') + '\n', 'text/plain;charset=utf-8');
    }
    async function drawList() {
      const all = await listDialogs(), q = search.value.trim().toLowerCase();
      const on = all.filter(d => d.enabled).length;
      stats.textContent = all.length ? `${num(all.length)} ${plural(all.length, 'rozmowa', 'rozmowy', 'rozmów')}, do dostrajania: ${num(on)}.` : 'Zestaw jest pusty.';
      const shown = q ? all.filter(d => d.turns.some(t => t.text.toLowerCase().includes(q))) : all;
      clear(listBox);
      listBox.append(...shown.slice(0, 300).map(d => h('article.dialog' + (d.enabled ? '' : '.off'),
        h('div.row', h('input', { type: 'checkbox', checked: d.enabled, 'aria-label': 'Używaj w dostrajaniu', onchange: async e => { d.enabled = e.target.checked; await saveDialog(d); drawList(); } }),
          h('span.badge', d.source), h('span.note', date(d.addedAt)), h('span.sp'),
          h('button.ghost.small', { type: 'button', onclick: () => {
            const close = modal('Edycja rozmowy', dialogEditor(d.turns, async turns => {
              try { const n = makeDialog(turns, d.source); Object.assign(d, { turns: n.turns, cleanerVersion: n.cleanerVersion }); await saveDialog(d); close(); drawList(); } catch (e) { toast(e.message, 'error'); }
            }));
          } }, 'Edytuj'),
          h('button.ghost.small.danger', { type: 'button', onclick: async () => { if (await confirmBox('Usunąć rozmowę?', d.turns[0].text, 'Usuń', true)) { await deleteDialog(d.id); drawList(); } } }, 'Usuń')),
        d.turns.map(t => h('p.turnline.' + t.role, h('b', t.role === 'user' ? settings().general.userTag : settings().general.botTag), ' ', t.text)))));
      if (shown.length > 300) listBox.append(h('p.note', `Pokazano 300 z ${num(shown.length)}. Zawęź wyszukiwanie.`));
    }
    drawList();
  },
};
