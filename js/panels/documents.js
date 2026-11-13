// Zakładka „Dokumenty”: biblioteka wgranych plików (ikonka, nazwa, data, opis).
// Wgranie zapisuje oryginał w bazie i od razu przepuszcza go przez konwerter (formatowanie);
// wynik czeka w zakładce „Formatowanie” na sprawdzenie i zatwierdzenie.

import { h, help, toast, confirmBox, modal, pickFiles, num, date, clear, plural } from '../ui/dom.js';
import { fileIcon } from '../ui/fileicon.js';
import { readFile, finishReading, ACCEPT, kindOf } from '../reader/index.js';
import { listDocs, addDoc, saveDoc, deleteDoc, findDuplicate, STATUS } from '../core/documents.js';
import { go } from '../main.js';
import { formatStatsModal } from '../ui/modals/format-stats.js';

export default {
  id: 'dokumenty', title: 'Dokumenty', stage: 2, icon: '📄',
  render(root) {
    const list = h('div'), stats = h('p.note');
    const prog = h('div.readprog', { hidden: true }, h('p.status'), h('div.progress', h('div.fill')));
    const search = h('input', { type: 'search', placeholder: 'Szukaj po nazwie i opisie…', oninput: () => draw() });
    root.append(
      h('header.ph', h('h1', 'Dokumenty'),
        h('p', 'Biblioteka tekstów prawnych: ustawy, kodeksy, orzeczenia, artykuły, strony z paragrafami. Wgrany plik trafia do bazy i od razu przechodzi przez konwerter na dane do nauki; wynik sprawdzisz i zatwierdzisz w zakładce „Formatowanie”.')),
      h('section.card',
        h('div.row.wrap',
          h('button', { type: 'button', onclick: addFiles }, 'Wgraj pliki'),
          h('button.ghost', { type: 'button', onclick: pasteText }, 'Wklej tekst'),
          h('span.note', 'Word (.docx), OpenDocument (.odt), RTF, PDF, obrazy (OCR), .txt, .md, .html.'),
          help('Każdy dokument ma ikonkę rodzaju, nazwę, datę i opis. Skany w PDF i zdjęcia przechodzą przez OCR, który sam obraca strony leżące bokiem lub do góry nogami i prostuje przekrzywione.', 'dokumenty')),
        prog),
      h('section.card', h('div.row', h('h2', 'Biblioteka'), h('span.sp'), search), stats, list));

    async function addFiles() {
      const files = await pickFiles(ACCEPT, true); let n = 0; const done = [];
      const [st, bar] = [prog.firstChild, prog.querySelector('.fill')];
      for (const [i, f] of files.entries()) {
        prog.hidden = false; st.textContent = `${f.name} (${i + 1} z ${files.length}): wczytuję…`; bar.style.width = '0%';
        if (kindOf(f) === 'pdf' || kindOf(f) === 'obraz') st.textContent += ' Pierwsze użycie OCR pobiera ok. 7 MB (model języka polskiego).';
        try {
          const read = await readFile(f, ({ page, pages, step, frac }) => {
            st.textContent = `${f.name} (${i + 1} z ${files.length}): strona ${page} z ${pages} — ${step}`;
            bar.style.width = (100 * (page - 1 + (frac || 0)) / pages).toFixed(1) + '%';
          });
          // ten sam tekst już jest w bibliotece? (także pod inną nazwą)
          const dup = await findDuplicate({ raw: read.raw });
          if (dup && !await confirmBox('Ten dokument już jest', `„${f.name}” ma taką samą treść jak „${dup.doc.name}” (dodany ${date(dup.doc.addedAt)}). Dodać mimo to?`, 'Dodaj mimo to')) continue;
          const d = await addDoc(read);
          n++; done.push({ name: d.name, report: d.report, text: d.text });
        } catch (e) { toast(`${f.name}: ${e.message}`, 'error', 8000); }
      }
      prog.hidden = true; finishReading();
      draw();
      if (n) formatStatsModal(`Wgrano i sformatowano: ${n} ${plural(n, 'dokument', 'dokumenty', 'dokumentów')}`, done);
    }
    function pasteText() {
      const name = h('input', { type: 'text', placeholder: 'np. Kodeks cywilny – przedawnienie' });
      const desc = h('input', { type: 'text', placeholder: 'skąd pochodzi, czego dotyczy (opcjonalnie)' });
      const ta = h('textarea', { rows: 14, placeholder: 'Wklej tekst…' });
      const close = modal('Wklej tekst',
        h('div.field', h('label', 'Nazwa'), name), h('div.field', h('label', 'Opis'), desc), h('div.field', h('label', 'Tekst'), ta),
        h('div.row.end', h('button', { type: 'button', onclick: async () => {
          if (!ta.value.trim()) return toast('Pusty tekst.', 'error');
          const d = await addDoc({ name: name.value.trim() || 'Wklejony tekst', type: 'wklejony', raw: ta.value, size: ta.value.length, description: desc.value.trim() });
          close(); draw(); formatStatsModal(`Formatowanie: ${d.name}`, [{ name: d.name, report: d.report, text: d.text }]);
        } }, 'Formatuj')));
    }

    async function draw() {
      const docs = await listDocs(), q = search.value.trim().toLowerCase();
      const by = s => docs.filter(d => d.status === s).length;
      stats.textContent = docs.length
        ? `${num(docs.length)} ${plural(docs.length, 'dokument', 'dokumenty', 'dokumentów')}: zatwierdzone ${num(by('zatwierdzony'))}, do sprawdzenia ${num(by('do-sprawdzenia'))}, odrzucone ${num(by('odrzucony'))}.`
        : 'Biblioteka jest pusta. Wgraj pierwsze dokumenty.';
      const shown = q ? docs.filter(d => (d.name + ' ' + d.description).toLowerCase().includes(q)) : docs;
      clear(list);
      list.append(...shown.map(d => {
        const descIn = h('textarea.desc', { rows: 1, value: d.description, placeholder: 'Opis: co to za dokument, skąd pochodzi, stan prawny…', 'aria-label': 'Opis dokumentu',
          onchange: async e => { d.description = e.target.value.trim(); await saveDoc(d); toast('Zapisano opis.', 'ok', 1200); } });
        return h('article.docrow',
          fileIcon(d.type),
          h('div.docmain',
            h('div.row.wrap', h('b.docname', d.name), h('span.note', date(d.addedAt)), h('span.note', `${num((d.raw || '').length)} znaków`), d.encoding && d.type !== 'wklejony' ? h('span.note', d.encoding) : null),
            descIn,
            h('input.srcurl', { type: 'url', value: d.sourceUrl, placeholder: 'Adres źródła (skąd pobrano): https://…', 'aria-label': 'Adres źródła',
              onchange: async e => { d.sourceUrl = e.target.value.trim(); await saveDoc(d); toast('Zapisano adres źródła.', 'ok', 1200); } })),
          h('div.docside',
            h('button.badge.st-' + d.status, { type: 'button', title: 'Pokaż w zakładce „Formatowanie”', onclick: () => go('formatowanie/' + d.id) }, STATUS[d.status]),
            h('button.ghost.small.danger', { type: 'button', onclick: async () => { if (await confirmBox('Usunąć dokument?', `${d.name} — zniknie z biblioteki i z danych do nauki.`, 'Usuń', true)) { await deleteDoc(d.id); draw(); } } }, 'Usuń')));
      }));
    }
    draw();
  },
};
