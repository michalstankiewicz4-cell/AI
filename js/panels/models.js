// Zakładka „Modele”: wszystkie wytrenowane wersje, aktywny model czatu, pliki modeli i publikacja na GitHub.

import { h, help, toast, confirmBox, modal, pickFiles, download, num, dec, date, dur, clear, plural } from '../ui/dom.js';
import { listModels, deleteModel, renameModel, setActive, getActive, saveModel, toFile, fromFile, onModels } from '../core/models.js';
import { unload } from '../core/ai.js';
import { settings } from '../core/settings.js';
import { getToken, publish as publishGH, publishedIndex, downloadPublished, modelFileName, repoInfo } from '../core/github.js';
import { listDocs, listDialogs } from '../core/corpus.js';
import { listConversations } from '../core/conversations.js';
import { dialogToText } from '../cleaner/dialogs.js';
import { tags } from '../core/settings.js';
import { VERSIONS } from '../version.js';
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
        help('Wczytanie z GitHub pobiera opublikowany model (bez tokenu: z GitHub Pages albo raw.githubusercontent.com). Przydaje się na innym komputerze.', 'wczytaj-z-github'))),
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

    // Publikacja: checkboxy z tym, co ma trafić do repo (jednym commitem). Plik modelu zawiera ustawienia i wersje.
    async function publish(m) {
      const gh = settings().github;
      if (!getToken()) return toast('Brak tokenu GitHub. Wpisz go w Ustawienia → GitHub.', 'error');
      const [docs, dialogs, convs] = await Promise.all([listDocs(), listDialogs(), listConversations()]);
      const approved = docs.filter(d => d.status === 'zatwierdzony');
      const pub = h('p.warnline', { hidden: true }, 'Repozytorium jest publiczne: dokumenty i rozmowy będą widoczne dla każdego, także w historii repo (nie da się ich potem łatwo usunąć). Nie wysyłaj danych osobowych ani poufnych.');
      const box = (id, label, checked, note, sensitive) => {
        const i = h('input', { type: 'checkbox', id: 'pub-' + id, checked, onchange: upd });
        i.dataset.sensitive = sensitive ? '1' : ''; return { id, i, el: h('div.field.check', i, h('label', { htmlFor: 'pub-' + id }, label, note ? h('span.note', ' — ' + note) : null)) };
      };
      const items = [
        box('model', `Model „${m.name}”`, true, `plik ${modelFileName(m)}, razem z ustawieniami i wersjami`),
        box('active', 'Oznacz jako aktualny model (index.json → active)', true, 'inne aplikacje (np. PiK) biorą domyślnie aktualny'),
        box('settings', 'Ustawienia i wersje', true, 'data/ustawienia.json (bez tokenu)'),
        box('documents', `Dokumenty zatwierdzone (${num(approved.length)})`, false, 'data/dokumenty.json: nazwa, opis, tekst po formatowaniu', true),
        box('dialogs', `Rozmowy wzorcowe (${num(dialogs.length)})`, false, 'data/rozmowy-wzorcowe.txt, format do wczytania', true),
        box('conversations', `Historia rozmów z czatu (${num(convs.length)})`, false, 'data/historia-rozmow.json', true),
      ];
      const log = h('p.status');
      function upd() { pub.hidden = !items.some(x => x.i.dataset.sensitive && x.i.checked); items[1].i.disabled = !items[0].i.checked; }
      const btn = h('button', { type: 'button', onclick: async () => {
        const what = Object.fromEntries(items.map(x => [x.id, x.i.checked && !x.i.disabled]));
        btn.disabled = true;
        try {
          const full = await db.get('models', m.id);
          const r = await publishGH(full, gh, what, {
            settings: settings(), versions: { ...VERSIONS },
            documents: approved.map(d => ({ name: d.name, description: d.description, type: d.type, addedAt: d.addedAt, enabled: d.enabled, chars: d.chars, cleanerVersion: d.cleanerVersion, text: d.text })),
            dialogsText: dialogs.slice().reverse().map(d => dialogToText(d.turns, tags())).join('\n\n') + '\n',
            conversations: convs,
          }, st => { log.textContent = st; });
          if (r.file) { full.published = { at: Date.now(), commit: r.commit, file: r.file }; await saveModel(full); }
          log.textContent = ''; log.append('Opublikowano: ', r.files.join(', '), '. ', h('a', { href: r.url, target: '_blank', rel: 'noopener' }, 'Zobacz commit'), '. GitHub Pages zaktualizuje się za około minutę.');
        } catch (e) { log.textContent = 'Błąd: ' + e.message; btn.disabled = false; }
      } }, 'Opublikuj');
      modal(`Publikacja na GitHub: ${m.name}`,
        h('p', `Repo ${gh.repo}, gałąź ${gh.branch}. Zaznacz, co wysłać — wszystko trafi jednym commitem.`, help('Plik modelu ma w nazwie wersję programu, w której powstał. Ustawienia i wersje są zawsze zapisane w pliku modelu; zaznaczenie „Ustawienia i wersje” dodaje je też jako osobny plik.', 'publikacja')),
        items.map(x => x.el), pub, log, h('div.row.end', btn));
      repoInfo(gh).then(r => { if (r.private) pub.textContent = 'Repozytorium jest prywatne — dane zobaczą tylko osoby z dostępem (uwaga: GitHub Pages dla prywatnego repo wymaga płatnego planu).'; }).catch(() => {});
      upd();
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
