// Zakładka „Research”: źródła dokumentów (strony www, API ELI Sejmu), sprawdzanie ich (czy działają, czy są zmiany
// i nowe dokumenty), sprawdzanie, czy dokument był już pobrany, i pobieranie do biblioteki z adresem źródła.

import { h, help, toast, confirmBox, modal, num, date, clear, plural } from '../ui/dom.js';
import { listSources, saveSource, deleteSource, newSource, hostOf, sourcesFromDocuments, docsOfSource, checkSource,
  downloadToLibrary, eliTextUrl, checkUrl, checkDocChanged, ELI_API, PUBLISHERS } from '../core/sources.js';
import { listDocs, addDoc } from '../core/documents.js';
import { go } from '../main.js';

export default {
  id: 'research', title: 'Research', icon: '🔎',
  render(root) {
    const list = h('div'), extra = h('div'), docsBox = h('div'), urlOut = h('div.urlout');
    const urlIn = h('input', { type: 'text', placeholder: 'https://… adres dokumentu (PDF, Word, strona)', 'aria-label': 'Adres dokumentu', onkeydown: e => e.key === 'Enter' && checkAddress() });
    root.append(
      h('header.ph', h('h1', 'Research'),
        h('p', 'Źródła dokumentów prawnych: strony www i API aktów prawnych Sejmu (ELI). Panel sprawdza, czy źródło działa, czy coś się zmieniło, które dokumenty już masz, a które są nowe, i pobiera je prosto do biblioteki. ',
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
      const kind = h('select', { onchange: () => { eliBox.hidden = kind.value !== 'eli'; if (kind.value === 'eli' && !url.value) url.value = ELI_API; } },
        h('option', { value: 'www', selected: s.kind === 'www' }, 'strona www z dokumentami'), h('option', { value: 'eli', selected: s.kind === 'eli' }, 'API aktów prawnych Sejmu (ELI)'));
      eliBox.hidden = s.kind !== 'eli';
      const close = modal(src ? `Źródło: ${s.name}` : 'Nowe źródło',
        h('div.fields', h('div.field', h('label', 'Nazwa'), name), h('div.field', h('label', 'Rodzaj', help('Strona www: panel szuka na niej linków do dokumentów (PDF, Word, HTML…). API ELI: lista aktów Dziennika Ustaw albo Monitora Polskiego z wybranych lat, z datą ostatniej zmiany każdego aktu.', 'research-zrodla')), kind)),
        h('div.field', h('label', 'Adres'), url), h('div.field', h('label', 'Opis'), desc), eliBox,
        h('div.row.end', h('button', { type: 'button', onclick: async () => {
          if (!name.value.trim() || !/^https?:\/\//.test(url.value.trim())) return toast('Podaj nazwę i pełny adres (https://…).', 'error');
          Object.assign(s, { name: name.value.trim(), url: url.value.trim(), kind: kind.value, description: desc.value.trim(),
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
      if (fresh.length > 1) box.append(h('button.ghost.small', { type: 'button', onclick: async e => { e.currentTarget.disabled = true; for (const l of fresh) await download(l.url, { description: `Źródło: ${s.name}` }, box); await checkSource(s); draw(); } }, `Pobierz wszystkie nowe (${fresh.length})`));
      if (L.links.length) box.append(h('div.tablebox', h('table.srctable', h('tbody', L.links.slice(0, 150).map(l => h('tr',
        h('td', h('a', { href: l.url, target: '_blank', rel: 'noopener', title: l.url }, l.title)),
        h('td', l.have ? h('span.badge.ok', 'już pobrany') : h('span.badge.corrected', 'nowy')),
        h('td.actions', l.have ? null : h('button.small', { type: 'button', onclick: async e => { const cell = e.currentTarget.parentNode; e.currentTarget.remove(); if (await download(l.url, { description: `Źródło: ${s.name}` }, cell)) l.have = true; } }, 'Pobierz'))))))));
      return h('details', { open: fresh.length > 0 }, h('summary', 'Dokumenty na stronie'), box);
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
            const ok = await download(eliTextUrl(a), { name: `${a.eli.replace(/\//g, ' ')} – ${a.title}`.slice(0, 180), description: `ELI ${a.eli} (${PUBLISHERS[a.eli.split('/')[0]] || ''})`, eli: a.eli, sourceChangeDate: a.changeDate, force: a.changed }, cell);
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

    async function draw() {
      const all = await listSources();
      clear(list); clear(extra);
      if (!all.length) list.append(h('p.note', 'Brak źródeł. Dodaj stronę www z dokumentami albo API aktów prawnych Sejmu (ELI).'));
      for (const s of all) {
        const n = (await docsOfSource(s)).length, st = h('span.status');
        list.append(h('article.source',
          h('div.row.wrap', h('b', s.name), h('span.badge', s.kind === 'eli' ? `API ELI · ${PUBLISHERS[s.eli.publisher]} · ${s.eli.years}` : 'strona www'),
            h('a.note', { href: s.url, target: '_blank', rel: 'noopener' }, hostOf(s.url) || s.url), h('span.note', `dokumentów z tego źródła: ${num(n)}`), h('span.sp'), st,
            h('button.small', { type: 'button', onclick: () => checkOne(s, st) }, 'Sprawdź'),
            h('button.ghost.small', { type: 'button', onclick: () => editSource(s) }, 'Edytuj'),
            h('button.ghost.small.danger', { type: 'button', onclick: async () => { if (await confirmBox('Usunąć źródło?', `${s.name} — dokumenty pobrane z niego zostają w bibliotece.`, 'Usuń', true)) { await deleteSource(s.id); draw(); } } }, 'Usuń')),
          s.description ? h('p.note', s.description) : null, lastLine(s), s.kind === 'eli' ? actsView(s) : linksView(s)));
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
