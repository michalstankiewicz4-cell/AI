// Zakładka „Formatowanie”: dokumenty po konwersji na dane do nauki — podgląd przed/po, raport zmian,
// ostrzeżenia oraz decyzja: zatwierdź do nauki, odrzuć, formatuj ponownie. Do nauki trafiają tylko zatwierdzone.

import { h, help, toast, num, date, clear, plural } from '../ui/dom.js';
import { fileIcon } from '../ui/fileicon.js';
import { summary } from '../cleaner/cleaner.js';
import { listDocs, saveDoc, recleanDoc, setStatus, STATUS } from '../core/documents.js';
import { VERSIONS } from '../version.js';
import { go } from '../main.js';
import { fieldsForm } from '../ui/form.js';
import { formatStatsModal } from '../ui/modals/format-stats.js';
import { settings, saveSettings, SCHEMA } from '../core/settings.js';

// wszystkie pola grupy „cleaner” poza długością odpowiedzi wzorcowej (ta jest w „Rozmowach wzorcowych”)
const CLEANER_HERE = SCHEMA.find(g => g.group === 'cleaner').fields.map(f => f.id).filter(id => id !== 'maxAnswer');

let saveT = null;

const FILTERS = [['do-sprawdzenia', 'Do sprawdzenia'], ['zatwierdzony', 'Zatwierdzone'], ['odrzucony', 'Odrzucone'], ['all', 'Wszystkie']];

export default {
  id: 'formatowanie', title: 'Formatowanie', stage: 2, icon: '🧹',
  async render(root, _r, focusId) {
    let filter = 'do-sprawdzenia';
    if (focusId) { const d = (await listDocs()).find(x => x.id === focusId); if (d) filter = d.status; }
    const list = h('div'), stats = h('p.note'), bulk = h('div.row.wrap');
    const seg = h('div.seg', FILTERS.map(([v, l]) => h('label', h('input', { type: 'radio', name: 'ff', checked: v === filter, onchange: () => { filter = v; draw(); } }), ' ', l)));
    root.append(
      h('header.ph', h('h1', 'Formatowanie'),
        h('p', 'Konwerter zamienia wgrane dokumenty na czysty tekst do nauki: usuwa numery stron, stopki i znaki niewidoczne, skleja przeniesione wyrazy i złamane linie, ujednolica zapis. Sprawdź wynik i zatwierdź — do nauki trafiają tylko zatwierdzone dokumenty.', help('Co dokładnie robi każda reguła, z przykładami „przed → po”.', 'formatowanie'))),
      h('details.card.settings', h('summary', h('b', 'Ustawienia formatowania'), ' ', h('span.note', '— reguły, dodatkowe znaki, progi')),
        h('p.note', 'Zmiana dotyczy nowo wgranych dokumentów. Już wgrane sformatujesz od nowa przyciskiem „Formatuj wszystkie ponownie”.'),
        fieldsForm('cleaner', settings().cleaner, { only: CLEANER_HERE, onChange: () => { clearTimeout(saveT); saveT = setTimeout(async () => { await saveSettings(settings()); toast('Zapisano ustawienia formatowania.', 'ok', 1500); }, 400); } })),
      h('section.card', h('div.row.wrap', seg, h('span.sp'), bulk), stats, list));

    async function draw() {
      const all = await listDocs(), docs = filter === 'all' ? all : all.filter(d => d.status === filter);
      const appr = all.filter(d => d.status === 'zatwierdzony' && d.enabled), chars = appr.reduce((a, d) => a + d.chars, 0);
      stats.textContent = `W nauce: ${num(appr.length)} ${plural(appr.length, 'dokument', 'dokumenty', 'dokumentów')}, ${num(chars)} znaków.` + (chars && chars < 300000 ? ' Mała sieć zaczyna sensownie pisać od ok. 300–500 tys. znaków.' : '');
      const todo = all.filter(d => d.status === 'do-sprawdzenia'), clean = todo.filter(d => !d.report.warnings.length);
      const stale = all.filter(d => d.cleanerVersion !== VERSIONS.cleaner);
      clear(bulk);
      if (clean.length) bulk.append(h('button.ghost', { type: 'button', onclick: async () => { for (const d of clean) await setStatus(d, 'zatwierdzony'); toast(`Zatwierdzono ${clean.length}.`, 'ok'); draw(); } }, `Zatwierdź bez ostrzeżeń (${clean.length})`));
      bulk.append(h('button.ghost', { type: 'button', title: 'Sformatuj wszystkie dokumenty od nowa aktualnymi regułami (z oryginałów). Zatwierdzone, których wynik się zmieni, wrócą do sprawdzenia.', onclick: async () => {
        const items = []; for (const d of all) { const prev = snapshot(d); await recleanDoc(d); items.push({ name: d.name, report: d.report, text: d.text, status: d.status, ...prev }); }
        draw(); formatStatsModal(`Formatowanie ponowne: ${all.length} ${plural(all.length, 'dokument', 'dokumenty', 'dokumentów')}`, items, { reformat: true });
      } }, stale.length ? `Formatuj wszystkie ponownie (${stale.length} starszymi regułami)` : 'Formatuj wszystkie ponownie'));
      clear(list);
      if (!docs.length) list.append(h('p.note', filter === 'do-sprawdzenia' ? 'Nic nie czeka na sprawdzenie. Wgraj dokumenty w zakładce „Dokumenty”.' : 'Brak dokumentów w tym widoku.'),
        filter === 'do-sprawdzenia' ? h('button.ghost', { type: 'button', onclick: () => go('dokumenty') }, 'Dokumenty') : null);
      list.append(...docs.map(card));
      if (focusId) { const el = list.querySelector(`[data-id="${CSS.escape(focusId)}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800); } focusId = null; }
    }

    function card(d) {
      const r = d.report, removed = Object.entries(r.removed).sort((a, b) => b[1] - a[1]);
      let showRaw = false;
      const pre = h('pre.preview', cut(d.text));
      const toggle = h('button.ghost.small', { type: 'button', onclick: () => { showRaw = !showRaw; pre.textContent = cut(showRaw ? d.raw : d.text); toggle.textContent = showRaw ? 'Pokaż po formatowaniu' : 'Pokaż przed formatowaniem'; } }, 'Pokaż przed formatowaniem');
      const act = (label, fn, cls = '.ghost') => h('button' + cls, { type: 'button', onclick: async () => { await fn(); draw(); } }, label);
      return h('article.doc.st-' + d.status + (r.warnings.length ? '.warn' : ''), { dataset: { id: d.id } },
        h('div.row.wrap', fileIcon(d.type), h('div.docmain.grow', h('b', d.name), d.description ? h('div.note', d.description) : null),
          h('span.badge.st-' + d.status, STATUS[d.status]),
          h('span.note', `${num(r.before)} → ${num(r.after)} znaków · ${num(r.paragraphs)} ${plural(r.paragraphs, 'akapit', 'akapity', 'akapitów')}`)),
        r.read ? h('p.note', 'Odczyt: ' + r.read, ' ', help('Jak odczytano plik: strony z warstwą tekstową PDF albo przez OCR, obroty (do góry nogami, bokiem), wyprostowanie przekrzywienia i pewność rozpoznania.', 'ocr')) : null,
        r.warnings.map(w => h('p.warnline', w)),
        h('p.note', 'Zmiany: ' + summary(r), ' ', help('Ile razy każda reguła formatowania coś zmieniła w tym dokumencie.', 'zmiany')),
        removed.length ? h('p.note', 'Usunięte znaki ', help('Znaki spoza listy dozwolonych, z liczbą wystąpień. Potrzebne dopisz w „Ustawienia formatowania” (u góry tej zakładki) i sformatuj ponownie.', 'usuniete-znaki'), ': ',
          removed.slice(0, 30).map(([c, n]) => h('code.ch', { title: 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0') }, `${c === ' ' ? '␠' : c} ×${n}`))) : null,
        h('details', { open: d.status === 'do-sprawdzenia' }, h('summary', 'Podgląd'), h('div.row', toggle), pre),
        h('div.row.wrap',
          d.status === 'zatwierdzony' ? h('label.check', h('input', { type: 'checkbox', checked: d.enabled, onchange: async e => { d.enabled = e.target.checked; await saveDoc(d); draw(); } }), ' używaj w nauce', help('Wyłączony dokument zostaje zatwierdzony, ale nie bierze udziału w następnej nauce.', 'do-sprawdzenia')) : null,
          h('span.note', `reguły v${d.cleanerVersion}${d.cleanerVersion !== VERSIONS.cleaner ? ' (starsze)' : ''} · ${date(d.formattedAt || d.addedAt)}`),
          h('span.sp'),
          act('Formatuj ponownie', async () => { const prev = snapshot(d); await recleanDoc(d); formatStatsModal(`Formatowanie ponowne: ${d.name}`, [{ name: d.name, report: d.report, text: d.text, status: d.status, ...prev }], { reformat: true }); }),
          h('button.ghost', { type: 'button', onclick: () => formatStatsModal(`Statystyki formatowania: ${d.name}`, [{ name: d.name, report: d.report, text: d.text }]) }, 'Statystyki'),
          d.status !== 'odrzucony' ? act('Odrzuć', () => setStatus(d, 'odrzucony')) : null,
          d.status === 'zatwierdzony' ? act('Cofnij zatwierdzenie', () => setStatus(d, 'do-sprawdzenia')) : act('Zatwierdź do nauki', async () => { if (!d.text.trim()) return toast('Po formatowaniu nic nie zostało.', 'error'); await setStatus(d, 'zatwierdzony'); }, '')));
    }
    draw();
  },
};
// stan dokumentu przed ponownym formatowaniem (do porównania w statystykach)
const snapshot = d => ({ prevText: d.text, prevReport: JSON.parse(JSON.stringify(d.report)), prevStatus: d.status, prevVersion: d.cleanerVersion });
const cut = t => t.slice(0, 6000) + (t.length > 6000 ? `\n… (jeszcze ${t.length - 6000} znaków)` : '');
