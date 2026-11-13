// Zakładka „Modele”: wszystkie wytrenowane wersje, aktywny model czatu, pliki modeli i publikacja na GitHub.

import { h, help, toast, confirmBox, modal, pickFiles, download, num, dec, date, dur, clear, plural } from '../ui/dom.js';
import { listModels, deleteModel, renameModel, setActive, getActive, saveModel, toFile, fromFile, onModels } from '../core/models.js';
import { unload } from '../core/ai.js';
import { settings } from '../core/settings.js';
import { getToken, publishModel, publishedIndex, downloadPublished } from '../core/github.js';
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
        h('button.ghost', { type: 'button', onclick: fromGitHub }, 'Wczytaj z GitHub'),
        help('Wczytanie z GitHub pobiera opublikowany model (bez tokenu: z GitHub Pages albo raw.githubusercontent.com). Przydaje się na innym komputerze.'))),
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
            h('dt', 'Bity na znak', help('Na tekście sprawdzającym (dokumenty albo rozmowy odłożone na bok). Mniej = lepiej. Porównuj modele tego samego rodzaju.')), h('dd', dec(me.bpc, 2)),
            h('dt', 'Błąd'), h('dd', dec(me.val, 3)),
            h('dt', 'Parametry'), h('dd', num(m.record.params)),
            h('dt', 'Budowa'), h('dd', `${m.hp.layers} warstw × ${m.hp.dim}, ${m.hp.heads} głowy, okno ${m.hp.ctx}, ${m.record.tok ? 'BPE ' + m.record.tok.merges.length : 'litery'}`),
            h('dt', 'Nauka'), h('dd', `${num(me.steps)} kroków, ${dur(me.seconds || 0)}, ${me.device || ''}`),
            h('dt', 'Dane'), h('dd', m.kind === 'base' ? `${num(m.data.docs)} ${plural(m.data.docs, 'dokument', 'dokumenty', 'dokumentów')}, ${num(m.data.chars)} znaków${m.data.mode === 'continue' ? ' (dalsza nauka)' : ''}` : `${num(m.data.dialogs)} ${plural(m.data.dialogs, 'rozmowa wzorcowa', 'rozmowy wzorcowe', 'rozmów wzorcowych')}`),
            m.parent ? [h('dt', 'Od modelu'), h('dd', names[m.parent] || '(usunięty)')] : null,
            h('dt', 'Wersje'), h('dd', `program ${m.versions.app}, silnik ${m.versions.engine}, reguły ${m.versions.cleaner}`)),
          m.sample ? h('details', h('summary', 'Próbka z końca nauki'), h('pre.sample', m.sample)) : null,
          h('div.row.wrap',
            m.id !== active ? h('button', { type: 'button', onclick: async () => { await setActive(m.id); toast(`Aktywny: ${m.name}`, 'ok'); } }, 'Ustaw jako aktywny') : null,
            h('button.ghost', { type: 'button', onclick: async () => modal(`Budowa modelu: ${m.name}`, netView(await db.get('models', m.id))) }, 'Podgląd budowy'),
            h('button.ghost', { type: 'button', onclick: async () => { const full = await db.get('models', m.id); download(`model-${m.name.replace(/\s+/g, '-').toLowerCase()}.json`, JSON.stringify(toFile(full))); } }, 'Pobierz plik'),
            h('button.ghost', { type: 'button', onclick: () => publish(m) }, 'Opublikuj na GitHub'),
            h('button.ghost', { type: 'button', onclick: async () => { const n = prompt('Nowa nazwa', m.name); if (n && n.trim()) await renameModel(m.id, n.trim()); } }, 'Zmień nazwę'),
            h('span.sp'),
            h('button.ghost.danger', { type: 'button', onclick: async () => { if (await confirmBox('Usunąć model?', `${m.name} — tej operacji nie da się cofnąć (chyba że masz plik albo wersję na GitHub).`, 'Usuń', true)) { await unload(m.id); await deleteModel(m.id); } } }, 'Usuń')));
      }));
    }

    async function importFile() {
      const [f] = await pickFiles('.json,application/json', false); if (!f) return;
      try { await addModel(fromFile(JSON.parse(await f.text())), f.name); } catch (e) { toast(e.message, 'error'); }
    }
    async function addModel(m, from) {
      if (await db.get('models', m.id) && !await confirmBox('Model już istnieje', `Model „${m.name}” jest już w bazie. Zastąpić go?`, 'Zastąp')) return;
      await unload(m.id); await saveModel(m); toast(`Wczytano „${m.name}” (${from}).`, 'ok');
    }

    function publish(m) {
      const gh = settings().github;
      if (!getToken()) return toast('Brak tokenu GitHub. Wpisz go w Ustawienia → GitHub.', 'error');
      const active = h('input', { type: 'checkbox', checked: true, id: 'pub-active' }), log = h('p.status');
      const btn = h('button', { type: 'button', onclick: async () => {
        btn.disabled = true;
        try {
          const full = await db.get('models', m.id);
          const r = await publishModel(full, gh, { makeActive: active.checked, onStep: s => { log.textContent = s; } });
          full.published = { at: Date.now(), commit: r.commit, file: r.file }; await saveModel(full);
          log.textContent = ''; log.append('Opublikowano. ', h('a', { href: r.url, target: '_blank', rel: 'noopener' }, 'Zobacz commit'), ` · plik ${r.file}. GitHub Pages zaktualizuje się za około minutę.`);
        } catch (e) { log.textContent = 'Błąd: ' + e.message; btn.disabled = false; }
      } }, 'Opublikuj');
      modal(`Publikacja: ${m.name}`,
        h('p', `Repo: ${gh.repo}, gałąź ${gh.branch}. Model trafi do pliku models/${m.id}.json, a lista modeli do models/index.json — jednym commitem.`),
        h('div.field.check', active, h('label', { htmlFor: 'pub-active' }, 'Oznacz jako aktualny model (index.json → active)'), help('Inne aplikacje (np. PiK) mogą brać zawsze model oznaczony jako aktualny.')),
        log, h('div.row.end', btn));
    }

    async function fromGitHub() {
      const gh = settings().github, box = h('div', h('p.status', 'Pobieram listę…'));
      const close = modal('Opublikowane modele', box);
      try {
        const idx = await publishedIndex(gh);
        clear(box);
        if (!idx.models || !idx.models.length) { box.append(h('p', 'Brak opublikowanych modeli.')); return; }
        box.append(...idx.models.map(e => h('div.row.wrap.pubrow',
          h('b', e.name), h('span.badge', e.kind === 'base' ? 'bazowy' : 'dostrojony'), e.id === idx.active ? h('span.badge.ok', 'aktualny') : null,
          h('span.note', `${date(e.publishedAt)} · ${num(e.params)} parametrów · bity/znak ${dec(e.metrics && e.metrics.bpc, 2)}`), h('span.sp'),
          h('button.small', { type: 'button', onclick: async ev => { ev.target.disabled = true; ev.target.textContent = 'Pobieram…'; try { await addModel(await downloadPublished(e, gh), 'GitHub'); close(); } catch (err) { toast(err.message, 'error'); ev.target.disabled = false; ev.target.textContent = 'Wczytaj'; } } }, 'Wczytaj'))));
      } catch (e) { clear(box); box.append(h('p.warnline', e.message)); }
    }

    const off = onModels(draw);
    draw();
    return off;
  },
};
