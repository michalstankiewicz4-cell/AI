// Zakładka „Dokumenty”: wgrywanie tekstów prawnych, formatowanie, raport i zatwierdzanie do nauki.
// Nic nie trafia do nauki bez zatwierdzenia: najpierw podgląd po formatowaniu i lista zmian.

import { h, help, toast, confirmBox, modal, pickFiles, num, date, clear, plural } from '../ui/dom.js';
import { readFile, ACCEPT } from '../cleaner/extract.js';
import { summary } from '../cleaner/cleaner.js';
import { listDocs, prepareDoc, saveDoc, deleteDoc, recleanDoc } from '../core/corpus.js';
import { VERSIONS } from '../version.js';

const queue = [];   // dokumenty po formatowaniu, czekające na decyzję (tylko w pamięci, do odświeżenia strony)

export default {
  id: 'dokumenty', title: 'Dokumenty', icon: '📄',
  render(root) {
    const qBox = h('div'), list = h('div'), stats = h('p.note');
    root.append(
      h('header.ph', h('h1', 'Dokumenty do nauki'),
        h('p', 'Ustawy, kodeksy, orzeczenia, artykuły i strony z paragrafami. Z nich sieć uczy się języka prawnego (krok 1). Każdy plik przechodzi przez formatowanie; do nauki trafia dopiero po Twoim zatwierdzeniu.')),
      h('section.card',
        h('div.row',
          h('button', { type: 'button', onclick: addFiles }, 'Wgraj pliki'),
          h('button.ghost', { type: 'button', onclick: pasteText }, 'Wklej tekst'),
          h('span.note', 'Pliki .txt, .md, .html (strony zapisane z przeglądarki). Kodowanie polskie (UTF-8, Windows-1250, ISO-8859-2) rozpoznawane samo.'))),
      qBox,
      h('section.card', h('h2', 'Zatwierdzone dokumenty', help('Tylko włączone dokumenty biorą udział w nauce. „Formatuj ponownie” stosuje aktualne reguły do zapisanego surowego tekstu — przydaje się po zmianie ustawień formatowania lub nowej wersji reguł.')), stats, list),
    );

    async function addFiles() {
      const files = await pickFiles(ACCEPT, true);
      for (const f of files) {
        try { queue.unshift(prepareDoc(await readFile(f))); }
        catch (e) { toast(`${f.name}: ${e.message}`, 'error'); }
      }
      drawQueue();
    }
    function pasteText() {
      const name = h('input', { type: 'text', placeholder: 'np. Kodeks cywilny – przedawnienie', value: '' });
      const ta = h('textarea', { rows: 14, placeholder: 'Wklej tekst…' });
      const close = modal('Wklej tekst',
        h('div.field', h('label', 'Nazwa'), name), h('div.field', h('label', 'Tekst'), ta),
        h('div.row.end', h('button', { type: 'button', onclick: () => {
          if (!ta.value.trim()) return toast('Pusty tekst.', 'error');
          queue.unshift(prepareDoc({ name: name.value.trim() || 'Wklejony tekst', type: 'wklejony', raw: ta.value }));
          close(); drawQueue();
        } }, 'Formatuj')));
    }

    async function drawQueue() {
      clear(qBox);
      if (!queue.length) return;
      const existing = new Set((await listDocs()).map(d => d.name));
      const clean = queue.filter(d => !d.report.warnings.length);
      qBox.append(h('section.card.queue',
        h('div.row', h('h2', `Do zatwierdzenia (${queue.length})`), h('span.sp'),
          clean.length && clean.length < queue.length ? h('button.ghost', { type: 'button', onclick: async () => { for (const d of clean) await approve(d, false); drawQueue(); drawList(); } }, `Zatwierdź bez ostrzeżeń (${clean.length})`) : null,
          h('button', { type: 'button', onclick: async () => { for (const d of [...queue]) await approve(d, false); drawQueue(); drawList(); } }, 'Zatwierdź wszystkie')),
        queue.map(d => docCard(d, existing.has(d.name)))));
    }
    function docCard(d, dup) {
      const r = d.report, removed = Object.entries(r.removed).sort((a, b) => b[1] - a[1]);
      const pre = h('pre.preview', d.text.slice(0, 4000) + (d.text.length > 4000 ? '\n…' : ''));
      let showRaw = false;
      return h('article.doc' + (r.warnings.length ? '.warn' : ''),
        h('div.row', h('b', d.name), h('span.badge', d.type), h('span.badge', d.encoding), h('span.sp'),
          h('span.note', `${num(r.before)} → ${num(r.after)} znaków · ${num(r.paragraphs)} ${plural(r.paragraphs, 'akapit', 'akapity', 'akapitów')}`)),
        dup ? h('p.warnline', 'Dokument o tej nazwie jest już zatwierdzony.') : null,
        r.warnings.map(w => h('p.warnline', w)),
        h('p.note', 'Zmiany: ' + summary(r)),
        removed.length ? h('p.note', 'Usunięte znaki: ', removed.slice(0, 30).map(([c, n]) => h('code.ch', { title: 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') }, `${c === ' ' ? '␠' : c} ×${n}`))) : null,
        h('details', h('summary', 'Podgląd'),
          h('div.row', h('button.ghost.small', { type: 'button', onclick: e => { showRaw = !showRaw; pre.textContent = (showRaw ? d.raw : d.text).slice(0, 4000); e.target.textContent = showRaw ? 'Pokaż po formatowaniu' : 'Pokaż przed formatowaniem'; } }, 'Pokaż przed formatowaniem')),
          pre),
        h('div.row.end',
          h('button.ghost', { type: 'button', onclick: () => { queue.splice(queue.indexOf(d), 1); drawQueue(); } }, 'Odrzuć'),
          h('button', { type: 'button', onclick: () => approve(d) }, 'Zatwierdź do nauki')));
    }
    async function approve(d, redraw = true) {
      if (!d.text.trim()) { toast(`${d.name}: po formatowaniu nic nie zostało.`, 'error'); return; }
      await saveDoc(d); queue.splice(queue.indexOf(d), 1);
      if (redraw) { drawQueue(); drawList(); toast(`Zatwierdzono: ${d.name}`, 'ok'); }
    }

    async function drawList() {
      const docs = await listDocs(), on = docs.filter(d => d.enabled), chars = on.reduce((a, d) => a + d.chars, 0);
      stats.textContent = docs.length
        ? `Do nauki: ${num(on.length)} z ${num(docs.length)} ${plural(docs.length, 'dokumentu', 'dokumentów', 'dokumentów')}, ${num(chars)} znaków. ` + (chars < 300000 ? 'Mała sieć zaczyna sensownie pisać od ok. 300–500 tys. znaków; im więcej tekstu, tym lepiej.' : '')
        : 'Brak zatwierdzonych dokumentów.';
      clear(list);
      if (!docs.length) return;
      list.append(h('div.tablebox', h('table',
        h('thead', h('tr', h('th', 'Nauka'), h('th', 'Nazwa'), h('th.num', 'Znaki'), h('th', 'Dodano'), h('th', 'Reguły'), h('th', ''))),
        h('tbody', docs.map(d => h('tr',
          h('td', h('input', { type: 'checkbox', checked: d.enabled, 'aria-label': 'Używaj w nauce', onchange: async e => { d.enabled = e.target.checked; await saveDoc(d); drawList(); } })),
          h('td', d.name, d.report.warnings.length ? h('span.badge.warn', { title: d.report.warnings.join('\n') }, '!') : null),
          h('td.num', num(d.chars)), h('td', date(d.addedAt)),
          h('td', h('span.badge' + (d.cleanerVersion !== VERSIONS.cleaner ? '.warn' : ''), { title: d.cleanerVersion !== VERSIONS.cleaner ? 'Sformatowano starszą wersją reguł' : 'Aktualna wersja reguł' }, 'v' + d.cleanerVersion)),
          h('td.actions',
            h('button.ghost.small', { type: 'button', onclick: () => modal(d.name, h('p.note', 'Zmiany: ' + summary(d.report)), h('pre.preview.tall', d.text)) }, 'Podgląd'),
            h('button.ghost.small', { type: 'button', onclick: async () => { await recleanDoc(d); toast('Sformatowano ponownie: ' + summary(d.report), 'ok'); drawList(); } }, 'Formatuj ponownie'),
            h('button.ghost.small.danger', { type: 'button', onclick: async () => { if (await confirmBox('Usunąć dokument?', d.name, 'Usuń', true)) { await deleteDoc(d.id); drawList(); } } }, 'Usuń')))))),
      ));
    }
    drawQueue(); drawList();
  },
};
