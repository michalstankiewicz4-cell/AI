// Zakładka „Research”: źródła dokumentów (strony www, API ELI Sejmu), sprawdzanie ich (czy działają, czy są zmiany
// i nowe dokumenty), sprawdzanie, czy dokument był już pobrany, i pobieranie do biblioteki z adresem źródła.

import { h, help, toast, confirmBox, modal, num, date, clear, plural } from '../ui/dom.js';
import { listSources, saveSource, deleteSource, newSource, hostOf, sourcesFromDocuments, docsOfSource, checkSource,
  downloadToLibrary, eliTextUrl, checkUrl, checkDocChanged, ELI_API, PUBLISHERS, catalogMissing, addFromCatalog, downloadWiki } from '../core/sources.js';
import { listDocs, addDoc } from '../core/documents.js';
import { go } from '../main.js';

const KIND = { eli: 'API ELI', api: 'API (JSON)', steno: 'stenogramy Sejmu', wiki: 'Wikipedia', www: 'strona www' };

export default {
  id: 'research', title: 'Research', icon: '🔎',
  render(root) {
    const list = h('div'), extra = h('div'), docsBox = h('div'), urlOut = h('div.urlout');
    const urlIn = h('input', { type: 'text', placeholder: 'https://… adres dokumentu (PDF, Word, strona)', 'aria-label': 'Adres dokumentu', onkeydown: e => e.key === 'Enter' && checkAddress() });
    root.append(
      h('header.ph', h('h1', 'Research'),
        h('p', 'Źródła dokumentów: strony www, API aktów prawnych Sejmu (ELI), inne API, a jako tekst ogólny stenogramy Sejmu i Wikipedia. Panel sprawdza, czy źródło działa, czy coś się zmieniło, które dokumenty już masz, a które są nowe, i pobiera je prosto do biblioteki. ',
          help('Przeglądarka może pobrać plik z innego serwisu tylko wtedy, gdy ten serwis na to pozwala (CORS). Jeśli nie pozwala, sprawdzenie pokaże „brak zgody CORS” — wtedy pobierz plik ręcznie i wgraj go w Dokumentach.', 'research'))),
      h('section.card', h('h2', 'Czy dokument był już pobrany?', help('Wklej adres dokumentu. Panel szuka go w bibliotece po adresie, a jeśli go nie ma — pobiera plik i porównuje treść (ten sam tekst pod innym adresem też zostanie rozpoznany).', 'research-adres')),
        h('div.row', urlIn, h('button', { type: 'button', onclick: checkAddress }, 'Sprawdź adres')), urlOut),
      h('section.card',
        h('div.row.wrap', h('h2', 'Źródła'), h('span.sp'),
          h('button.ghost', { type: 'button', onclick: () => editSource() }, 'Dodaj źródło'),
          h('button', { type: 'button', onclick: checkAll }, 'Sprawdź wszystkie')),
        list, extra),
      h('section.card', h('h2', 'Dokumenty z adresem źródła', help('Dokumenty pobrane z Researchu albo z wpisanym adresem źródła (w Dokumentach). „Sprawdź zmiany u źródła” pobiera je jeszcze raz i porównuje treść.', 'research-zmiany')), docsBox));

    // ---------- czy już pobrany ----------
    async function checkAddress() {
      const url = urlIn.value.trim();
      if (!/^https?:\/\//.test(url)) return toast('Wpisz pełny adres zaczynający się od https://', 'error');
      clear(urlOut); urlOut.append(h('p.status', 'Sprawdzam…'));
      try {
        const r = await checkUrl(url);
        clear(urlOut);
        if (r.have) urlOut.append(h('p.okline', `Już pobrany: „${r.doc.name}” (rozpoznany po: ${r.by}, dodany ${date(r.doc.addedAt)}). `, h('a', { href: '#formatowanie/' + r.doc.id }, 'Pokaż')));
        else if (!r.reachable) urlOut.append(h('p.warnline', 'Nie ma go w bibliotece, a sprawdzić treści się nie da: ' + r.error));
        else urlOut.append(h('p', `Nie ma go w bibliotece (${num(r.chars)} znaków tekstu). `), h('button', { type: 'button', onclick: () => download(url, {}, urlOut) }, 'Pobierz do dokumentów'));
      } catch (e) { clear(urlOut); urlOut.append(h('p.warnline', e.message)); }
    }

    // ---------- pobieranie ----------
    async function download(url, opts = {}, statusEl) {
      const st = h('p.status', 'Pobieram…'); if (statusEl) statusEl.append(st);
      try {
        const r = await downloadToLibrary(url, { ...opts, onProgress: ({ page, pages, step }) => { st.textContent = `Strona ${page} z ${pages}: ${step}`; } });
        if (r.duplicate) { st.textContent = `Już w bibliotece: „${r.duplicate.doc.name}” (po: ${r.duplicate.by}).`; return false; }
        st.textContent = `Dodano „${r.doc.name}” — sprawdź w Formatowaniu.`; toast(`Pobrano: ${r.doc.name}`, 'ok'); return true;
      } catch (e) { st.textContent = 'Błąd: ' + e.message; st.classList.add('warnline'); return false; }
    }

    // ---------- źródła ----------
    function editSource(src) {
      const s = src ? { ...src, eli: src.eli ? { ...src.eli } : null } : newSource({ name: '', url: '', kind: 'www' });
      const name = h('input', { type: 'text', value: s.name, placeholder: 'np. Dziennik Ustaw, strona sądu, serwis z orzeczeniami' });
      const url = h('input', { type: 'text', value: s.url, placeholder: 'https://…' });
      const desc = h('input', { type: 'text', value: s.description, placeholder: 'czego dotyczy, co z niego pobierać (opcjonalnie)' });
      const pub = h('select', Object.entries(PUBLISHERS).map(([k, v]) => h('option', { value: k, selected: s.eli && s.eli.publisher === k }, `${v} (${k})`)));
      const years = h('input', { type: 'text', value: s.eli ? s.eli.years : String(new Date().getFullYear()), placeholder: 'np. 2024, 2025' });
      const filter = h('input', { type: 'text', value: s.eli ? s.eli.filter : '', placeholder: 'np. kodeks, cywilny, najm (puste = wszystkie akty)' });
      const eliBox = h('div.fields', h('div.field', h('label', 'Wydawnictwo'), pub), h('div.field', h('label', 'Lata', help('Z których lat sprawdzać akty (oddzielone przecinkami). Każdy rok to jedno zapytanie do API.', 'research-eli')), years),
        h('div.field', h('label', 'Tylko tytuły zawierające', help('Słowa oddzielone przecinkami: pokazywane są akty, których tytuł zawiera którekolwiek z nich. W Dzienniku Ustaw jest ok. 2000 aktów rocznie, więc filtr pomaga znaleźć te, które Cię interesują.', 'research-eli')), filter));
      const gen = h('input', { type: 'checkbox', checked: !!s.general });
      const kind = h('select', { onchange: () => { eliBox.hidden = kind.value !== 'eli'; if (kind.value === 'eli' && !url.value) url.value = ELI_API; } },
        h('option', { value: 'www', selected: s.kind === 'www' }, 'strona www z dokumentami'), h('option', { value: 'eli', selected: s.kind === 'eli' }, 'API aktów prawnych Sejmu (ELI)'), h('option', { value: 'api', selected: s.kind === 'api' }, 'API (JSON) – inne'),
        h('option', { value: 'steno', selected: s.kind === 'steno' }, 'stenogramy Sejmu (API Sejmu)'), h('option', { value: 'wiki', selected: s.kind === 'wiki' }, 'Wikipedia (API MediaWiki)'));
      eliBox.hidden = s.kind !== 'eli';
      const close = modal(src ? `Źródło: ${s.name}` : 'Nowe źródło',
        h('div.fields', h('div.field', h('label', 'Nazwa'), name), h('div.field', h('label', 'Rodzaj', help('Strona www: panel szuka na niej linków do dokumentów (PDF, Word, HTML…). API ELI: lista aktów Dziennika Ustaw albo Monitora Polskiego z wybranych lat, z datą ostatniej zmiany każdego aktu. API (JSON): dowolne API zwracające JSON – sprawdzane jest, czy działa, ile ma pozycji i czy coś się zmieniło.', 'research-zrodla')), kind)),
        h('div.field', h('label', 'Adres'), url), h('div.field', h('label', 'Opis'), desc), eliBox,
        h('div.field.check', gen, h('label', ' Tekst ogólny (nie prawniczy) ', help('Dokumenty pobrane z tego źródła dostaną oznaczenie „ogólny”. W nauce idą tylko do ustalonego udziału (Nauka → „Udział tekstu ogólnego”).', 'tekst-ogolny'))),
        h('div.row.end', h('button', { type: 'button', onclick: async () => {
          if (!name.value.trim() || !/^https?:\/\//.test(url.value.trim())) return toast('Podaj nazwę i pełny adres (https://…).', 'error');
          Object.assign(s, { name: name.value.trim(), url: url.value.trim(), kind: kind.value, description: desc.value.trim(), general: gen.checked,
            eli: kind.value === 'eli' ? { publisher: pub.value, years: years.value.trim(), filter: filter.value.trim() } : null });
          if (src && (src.url !== s.url || src.kind !== s.kind)) delete s.last;
          await saveSource(s); close(); draw();
        } }, 'Zapisz')));
    }

    async function checkOne(s, statusEl) {
      if (statusEl) statusEl.textContent = 'Sprawdzam…';
      try { await checkSource(s); } catch (e) { toast(`${s.name}: ${e.message}`, 'error'); }
      draw();
    }
    async function checkAll() {
      const all = await listSources(); if (!all.length) return toast('Najpierw dodaj źródło.', 'error');
      for (const s of all) { toast(`Sprawdzam: ${s.name}…`, 'info', 1500); try { await checkSource(s); } catch (_) { /* wynik zapisany w źródle */ } }
      draw(); toast('Sprawdzono wszystkie źródła.', 'ok');
    }

    function lastLine(s) {
      const L = s.last;
      if (!L) return h('p.note', 'Jeszcze nie sprawdzane.');
      const head = L.ok ? h('span.badge.ok', `działa · ${num(L.ms)} ms`) : h('span.badge.wrong', L.cors ? `błąd ${L.status}` : 'niedostępne / CORS');
      const ch = L.changed == null ? 'pierwsze sprawdzenie' : L.changed ? 'są zmiany od poprzedniego sprawdzenia' : 'bez zmian od poprzedniego sprawdzenia';
      return h('div', h('div.row.wrap', head, h('span.note', `sprawdzono ${date(L.at)}`), L.ok ? h('span.badge' + (L.changed ? '.corrected' : ''), ch) : null),
        L.error ? h('p.warnline', L.error) : null);
    }

    function linksView(s) {
      const L = s.last; if (!L || !L.ok || !L.links) return null;
      const fresh = L.links.filter(l => !l.have), box = h('div');
      box.append(h('p.note', `Linki do dokumentów na stronie: ${num(L.links.length)} — nowe: ${num(fresh.length)}, już pobrane: ${num(L.links.length - fresh.length)}.`));
      if (fresh.length > 1) box.append(h('button.ghost.small', { type: 'button', onclick: async e => { e.currentTarget.disabled = true; for (const l of fresh) await download(l.url, { name: l.name, description: `Źródło: ${s.name}`, general: !!s.general }, box); await checkSource(s); draw(); } }, `Pobierz wszystkie nowe (${fresh.length})`));
      if (L.links.length) box.append(h('div.tablebox', h('table.srctable', h('tbody', L.links.slice(0, 150).map(l => h('tr',
        h('td', h('a', { href: l.url, target: '_blank', rel: 'noopener', title: l.url }, l.title)),
        h('td', l.have ? h('span.badge.ok', 'już pobrany') : h('span.badge.corrected', 'nowy')),
        h('td.actions', l.have ? null : h('button.small', { type: 'button', onclick: async e => { const cell = e.currentTarget.parentNode; e.currentTarget.remove(); if (await download(l.url, { name: l.name, description: `Źródło: ${s.name}`, general: !!s.general }, cell)) l.have = true; } }, 'Pobierz'))))))));
      return h('details', { open: fresh.length > 0 }, h('summary', s.kind === 'steno' ? `Stenogramy (najnowsze ${L.links.length} z ${num(L.total || L.links.length)} dni posiedzeń)` : 'Dokumenty na stronie'), box);
    }

    function actsView(s) {
      const L = s.last; if (!L || !L.ok || !L.acts) return null;
      const fresh = L.acts.filter(a => !a.have), changed = L.acts.filter(a => a.changed);
      let mode = changed.length ? 'changed' : 'new';
      const rows = h('tbody'), box = h('div');
      const drawRows = () => {
        clear(rows);
        const sel = mode === 'new' ? fresh : mode === 'changed' ? changed : L.acts;
        rows.append(...sel.slice(0, 150).map(a => h('tr',
          h('td', h('code', a.eli)), h('td', a.title, a.changeDate ? h('div.note', `zmiana w API: ${a.changeDate.slice(0, 10)}`) : null),
          h('td', a.changed ? h('span.badge.corrected', 'zmieniony') : a.have ? h('span.badge.ok', 'już pobrany') : h('span.badge', 'nowy')),
          h('td.actions', !a.have || a.changed ? h('button.small', { type: 'button', onclick: async e => {
            const cell = e.currentTarget.parentNode; e.currentTarget.remove();
            const ok = await download(eliTextUrl(a), { general: !!s.general, name: `${a.eli.replace(/\//g, ' ')} – ${a.title}`.slice(0, 180), description: `ELI ${a.eli} (${PUBLISHERS[a.eli.split('/')[0]] || ''})`, eli: a.eli, sourceChangeDate: a.changeDate, force: a.changed }, cell);
            if (ok) { a.have = true; a.changed = false; }
          } }, a.changed ? 'Pobierz nową wersję' : 'Pobierz') : null))));
        if (sel.length > 150) rows.append(h('tr', h('td', { colSpan: 4 }, h('span.note', `Pokazano 150 z ${num(sel.length)}. Zawęź filtr tytułów w ustawieniach źródła.`))));
      };
      box.append(h('p.note', `API: ${num(L.total)} ${plural(L.total, 'akt', 'akty', 'aktów')} w wybranych latach, pasujących do filtra: ${num(L.acts.length)} — nowe: ${num(fresh.length)}, zmienione od pobrania: ${num(changed.length)}.`),
        h('div.seg', [['new', `Nowe (${fresh.length})`], ['changed', `Zmienione (${changed.length})`], ['all', 'Wszystkie']].map(([v, l]) =>
          h('label', h('input', { type: 'radio', name: 'm-' + s.id, checked: v === mode, onchange: () => { mode = v; drawRows(); } }), ' ', l))),
        h('div.tablebox', h('table.srctable', rows)));
      drawRows();
      return h('details', { open: true }, h('summary', 'Akty prawne'), box);
    }

    function apiView(s) {
      const L = s.last; if (!L || !L.ok) return null;
      return h('details', h('summary', `Odpowiedź API: ${L.count != null ? num(L.count) + ' pozycji' : 'JSON'}${L.total != null ? ` (wszystkich: ${num(L.total)})` : ''}`),
        L.sample && L.sample.length ? h('ul', L.sample.map(x => h('li', x.label, x.date ? h('span.note', ' · ' + x.date) : null))) : h('p.note', 'API działa, ale odpowiedź nie zawiera listy pozycji.'));
    }

    function wikiView(s) {
      const L = s.last; if (!L || !L.ok) return null;
      const n = h('select', [5, 10, 20, 50].map(v => h('option', { value: v, selected: v === 10 }, String(v)))), out = h('div');
      return h('div', L.articles ? h('p.note', `Artykułów w Wikipedii: ${num(L.articles)}. Pobierane są losowe artykuły dłuższe niż 3000 znaków (bez zalążków i stron ujednoznaczniających), z adresem jako podaniem źródła.`) : null,
        h('div.row.wrap', h('label', 'Ile artykułów: '), n, h('button.small', { type: 'button', onclick: async e => {
          const btn = e.currentTarget; btn.disabled = true; clear(out); const st = h('p.status', 'Pobieram…'); out.append(st);
          try {
            const got = await downloadWiki(s, +n.value, { onStep: (i, k, t) => { st.textContent = `${i} z ${k}: ${t}`; } });
            st.textContent = `Dodano ${got.length} ${plural(got.length, 'artykuł', 'artykuły', 'artykułów')} jako tekst ogólny — sprawdź w Formatowaniu.`; toast(`Pobrano ${got.length} z Wikipedii.`, 'ok');
          } catch (err) { st.textContent = 'Błąd: ' + err.message; st.classList.add('warnline'); }
          btn.disabled = false;
        } }, 'Pobierz losowe artykuły')), out);
    }

    async function draw() {
      const all = await listSources();
      clear(list); clear(extra);
      const miss = catalogMissing(all);
      if (miss.length) extra.append(h('details.catalog', { open: !all.length }, h('summary', h('b', `Znane źródła do dodania (${miss.length})`), ' ', help('Oficjalne źródła dokumentów prawnych: akty (ELI), decyzje i rekomendacje urzędów (UOKiK, UODO, KNF), interpretacje (ZUS, KIS) oraz API (SAOS, Sejm). Oznaczone „ogólny” to tekst ogólny do nauki zwykłej polszczyzny (stenogramy Sejmu, Wikipedia). Po dodaniu możesz zmienić ich ustawienia w „Edytuj”.', 'research-zrodla')),
        h('div.row.end', h('button', { type: 'button', onclick: async () => { for (const c of miss) await addFromCatalog(c); toast(`Dodano ${miss.length} źródeł.`, 'ok'); draw(); } }, `Dodaj wszystkie (${miss.length})`)),
        ...miss.map(c => h('div.row.wrap.catrow', h('b', c.name), h('span.badge', KIND[c.kind] || 'strona www'), c.general ? h('span.badge.gen', 'ogólny') : null, h('span.note', c.description), h('span.sp'),
          h('button.ghost.small', { type: 'button', onclick: async () => { await addFromCatalog(c); draw(); } }, 'Dodaj')))));
      if (!all.length) list.append(h('p.note', 'Brak źródeł. Dodaj je z „Znanych źródeł” poniżej albo przyciskiem „Dodaj źródło”.'));
      for (const s of all) {
        const n = (await docsOfSource(s)).length, st = h('span.status');
        list.append(h('article.source',
          h('div.row.wrap', h('b', s.name), h('span.badge', s.kind === 'eli' ? `API ELI · ${PUBLISHERS[s.eli.publisher]} · ${s.eli.years}` : KIND[s.kind] || 'strona www'), s.general ? h('span.badge.gen', { title: 'Tekst ogólny (nie prawniczy)' }, 'ogólny') : null,
            h('a.note', { href: s.url, target: '_blank', rel: 'noopener' }, hostOf(s.url) || s.url), h('span.note', `dokumentów z tego źródła: ${num(n)}`), h('span.sp'), st,
            h('button.small', { type: 'button', onclick: () => checkOne(s, st) }, 'Sprawdź'),
            h('button.ghost.small', { type: 'button', onclick: () => editSource(s) }, 'Edytuj'),
            h('button.ghost.small.danger', { type: 'button', onclick: async () => { if (await confirmBox('Usunąć źródło?', `${s.name} — dokumenty pobrane z niego zostają w bibliotece.`, 'Usuń', true)) { await deleteSource(s.id); draw(); } } }, 'Usuń')),
          s.description ? h('p.note', s.description) : null, lastLine(s), s.kind === 'eli' ? actsView(s) : s.kind === 'api' ? apiView(s) : s.kind === 'wiki' ? wikiView(s) : linksView(s)));
      }
      const fromDocs = await sourcesFromDocuments(all);
      if (fromDocs.length) extra.append(h('h3', 'Domeny z dokumentów, których nie ma na liście', help('Adresy źródła wpisane przy dokumentach wskazują strony, których nie ma jeszcze wśród źródeł.', 'research-zrodla')),
        ...fromDocs.map(f => h('div.row', h('span', f.host), h('span.note', `${num(f.n)} ${plural(f.n, 'dokument', 'dokumenty', 'dokumentów')}`), h('span.sp'),
          h('button.ghost.small', { type: 'button', onclick: async () => { await saveSource(newSource({ name: f.host, url: 'https://' + f.host + '/' })); draw(); } }, 'Dodaj jako źródło'))));
      drawDocs();
    }

    async function drawDocs() {
      const docs = (await listDocs()).filter(d => d.sourceUrl);
      clear(docsBox);
      if (!docs.length) { docsBox.append(h('p.note', 'Żaden dokument nie ma adresu źródła. Dokumenty pobrane tutaj dostają go same; przy wgranych ręcznie możesz go wpisać w Dokumentach.')); return; }
      const out = h('div');
      docsBox.append(h('div.row', h('span.note', `${num(docs.length)} ${plural(docs.length, 'dokument', 'dokumenty', 'dokumentów')} z adresem źródła.`), h('span.sp'),
        h('button.ghost', { type: 'button', onclick: async e => {
          e.currentTarget.disabled = true; clear(out); let ch = 0, err = 0;
          for (const d of docs) {
            const line = h('div.row.wrap', h('span', d.name)); out.append(line);
            const r = await checkDocChanged(d);
            if (!r.ok) { err++; line.append(h('span.badge.wrong', 'nie można sprawdzić'), h('span.note', r.error)); continue; }
            if (!r.changed) { line.append(h('span.badge.ok', 'bez zmian')); continue; }
            ch++; line.append(h('span.badge.corrected', 'zmieniony u źródła'), h('button.small', { type: 'button', onclick: async ev => {
              ev.currentTarget.disabled = true; const nd = await addDoc({ ...r.read, name: d.name + ' (nowa wersja)', description: d.description, sourceUrl: d.sourceUrl, eli: d.eli, sourceChangeDate: d.sourceChangeDate });
              toast('Dodano nową wersję — sprawdź w Formatowaniu.', 'ok'); go('formatowanie/' + nd.id);
            } }, 'Dodaj nową wersję'));
          }
          out.prepend(h('p', `Sprawdzono ${docs.length}: zmienione ${ch}, nie do sprawdzenia ${err}, bez zmian ${docs.length - ch - err}.`));
          e.currentTarget.disabled = false;
        } }, 'Sprawdź zmiany u źródła')), out);
    }
    draw();
  },
};
