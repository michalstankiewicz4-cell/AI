// Zakładka „Modele”: wszystkie wytrenowane wersje, aktywny model czatu, pliki modeli i publikacja na GitHub.

import { h, help, toast, confirmBox, modal, pickFiles, download, num, dec, date, dur, clear, plural } from '../ui/dom.js';
import { listModels, deleteModel, renameModel, setActive, getActive, saveModel, toFile, fromFile, onModels } from '../core/models.js';
import { unload } from '../core/ai.js';
import { modelFileName } from '../core/github.js';
import { publishModal } from '../ui/modals/publish.js';
import { githubImportModal, addModelConfirm } from '../ui/modals/github-import.js';
import { db } from '../core/db.js';
import { go } from '../main.js';
import { netView } from '../ui/netview.js';

export default {
  id: 'modele', title: 'Modele', icon: '📦',
  render(root) {
    const listBox = h('div');
    root.append(
      h('header.ph', h('h1', 'Modele'),
        h('p', 'Każda nauka i każde dostrajanie zapisuje nową wersję modelu. Aktywny model odpowiada w czacie. Model można pobrać jako plik albo opublikować na GitHub (repo z ustawień), skąd będzie dostępny pod adresem GitHub Pages — np. dla przyszłej integracji z PiK.')),
      h('section.card', h('div.row',
        h('button.ghost', { type: 'button', onclick: importFile }, 'Wczytaj z pliku'),
        h('button.ghost', { type: 'button', onclick: () => githubImportModal() }, 'Wczytaj z GitHub'),
        help('Pobiera opublikowane modele i dane (ustawienia, dokumenty, rozmowy) bez tokenu. Przenosi pracę na inny komputer.', 'wczytaj-z-github'))),
      listBox);

    async function draw() {
      const all = await listModels(), active = await getActive(), names = Object.fromEntries(all.map(m => [m.id, m.name]));
      clear(listBox);
      if (!all.length) { listBox.append(h('section.card', h('p', 'Nie ma jeszcze modeli. '), h('button', { type: 'button', onclick: () => go('nauka') }, 'Przejdź do nauki'))); return; }
      listBox.append(...all.map(m => {
        const me = m.metrics || {};
        return h('section.card.model' + (m.id === active ? '.active' : ''),
          h('div.row.wrap',
            h('h2', m.name), h('span.badge', m.kind === 'base' ? 'bazowy' : 'dostrojony'), m.id === active ? h('span.badge.ok', 'aktywny w czacie') : null,
            m.published ? h('span.badge', { title: `Opublikowano ${date(m.published.at)}` }, 'na GitHub') : null, h('span.sp'), h('span.note', date(m.createdAt))),
          h('dl.metrics.inline',
            h('dt', 'Bity na znak', help('Na tekście sprawdzającym (dokumenty albo rozmowy odłożone na bok). Mniej = lepiej. Porównuj modele tego samego rodzaju.', 'bity-na-znak')), h('dd', dec(me.bpc, 2)),
            h('dt', 'Błąd', help('Średni błąd na token w tekście sprawdzającym (entropia krzyżowa). Mniej = lepiej; nie porównuj modeli z różnym słownikiem — do tego są bity na znak.', 'blad')), h('dd', dec(me.val, 3)),
            h('dt', 'Parametry', help('Liczba wag sieci. Więcej = większa pojemność, ale potrzeba więcej tekstu i czasu nauki.', 'parametry')), h('dd', num(m.record.params)),
            h('dt', 'Budowa', help('Warstwy × szerokość, głowy uwagi, okno (ile tokenów sieć widzi naraz) i słownik (BPE: liczba sklejeń, albo litery).', 'budowa')), h('dd', `${m.hp.layers} warstw × ${m.hp.dim}, ${m.hp.heads} głowy, okno ${m.hp.ctx}, ${m.record.tok ? 'BPE ' + m.record.tok.merges.length : 'litery'}`),
            h('dt', 'Nauka', help('Wykonane kroki, czas i urządzenie. Jeśli nauka wróciła do najlepszego momentu, liczba kroków to wszystkie wykonane.', 'nauka-modelu')), h('dd', `${num(me.steps)} kroków, ${dur(me.seconds || 0)}, ${me.device || ''}`),
            h('dt', 'Dane'), h('dd', m.kind === 'base' ? `${num(m.data.docs)} ${plural(m.data.docs, 'dokument', 'dokumenty', 'dokumentów')}, ${num(m.data.chars)} znaków${m.data.mode === 'continue' ? ' (dalsza nauka)' : ''}` : `${num(m.data.dialogs)} ${plural(m.data.dialogs, 'rozmowa wzorcowa', 'rozmowy wzorcowe', 'rozmów wzorcowych')}`),
            m.parent ? [h('dt', 'Od modelu'), h('dd', names[m.parent] || '(usunięty)')] : null,
            h('dt', 'Wersje', help('Wersje programu, silnika i reguł formatowania, z którymi powstał model.', 'wersje-modelu')), h('dd', `program ${m.versions.app}, silnik ${m.versions.engine}, reguły ${m.versions.cleaner}`)),
          m.sample ? h('details', h('summary', 'Próbka z końca nauki'), h('pre.sample', m.sample)) : null,
          h('div.row.wrap',
            m.id !== active ? h('button', { type: 'button', onclick: async () => { await setActive(m.id); toast(`Aktywny: ${m.name}`, 'ok'); } }, 'Ustaw jako aktywny') : null,
            h('button.ghost', { type: 'button', onclick: async () => modal(`Budowa modelu: ${m.name}`, netView(await db.get('models', m.id))) }, 'Podgląd budowy'),
            h('button.ghost', { type: 'button', onclick: async () => { const full = await db.get('models', m.id); download(modelFileName(full).replace('models/', ''), JSON.stringify(toFile(full))); } }, 'Pobierz plik'),
            h('button.ghost', { type: 'button', onclick: () => publishModal(m) }, 'Opublikuj na GitHub'),
            h('button.ghost', { type: 'button', onclick: async () => { const n = prompt('Nowa nazwa', m.name); if (n && n.trim()) await renameModel(m.id, n.trim()); } }, 'Zmień nazwę'),
            h('span.sp'),
            h('button.ghost.danger', { type: 'button', onclick: async () => { if (await confirmBox('Usunąć model?', `${m.name} — tej operacji nie da się cofnąć (chyba że masz plik albo wersję na GitHub).`, 'Usuń', true)) { await unload(m.id); await deleteModel(m.id); } } }, 'Usuń')));
      }));
    }

    async function importFile() {
      const [f] = await pickFiles('.json,application/json', false); if (!f) return;
      try { await addModelConfirm(fromFile(JSON.parse(await f.text())), f.name); } catch (e) { toast(e.message, 'error'); }
    }

    const off = onModels(draw);
    draw();
    return off;
  },
};
