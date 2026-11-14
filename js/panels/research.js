// Zakładka „Research”: źródła dokumentów (strony www, API ELI Sejmu), sprawdzanie ich (czy działają, czy są zmiany
// i nowe dokumenty), sprawdzanie, czy dokument był już pobrany, i pobieranie do biblioteki z adresem źródła.

import { h, help, toast, confirmBox, modal, num, date, clear, plural, pickFiles, download as saveFile } from '../ui/dom.js';
import { listSources, saveSource, deleteSource, newSource, hostOf, sourcesFromDocuments, docsOfSource, checkSource,
  downloadToLibrary, eliTextUrl, checkUrl, checkDocChanged, ELI_API, PUBLISHERS, catalogMissing, addFromCatalog, downloadWiki, downloadEliAct, downloadWikiTitle, findNewerConsolidated, isSaos, saosUrl, downloadSaosJudgment } from '../core/sources.js';
import { listPacks, savePack, deletePack, packToFile, packFromFile } from '../core/packs.js';
import { listDialogs, addQuestionDrafts } from '../core/dialogs.js';
import { listDocs, addDoc, mergeTags, markOutdated } from '../core/documents.js';
import { tagChips } from '../ui/tags.js';
import { go } from '../main.js';

const STATUS_TXT = { dodano: 'dodano', jest: 'już jest', zmieniony: 'nowa wersja', 'inny-tytul': 'pominięto – inny tytuł niż w pakiecie', brak: 'brak takiego artykułu', blad: 'błąd' };
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
      const tagsIn = h('input', { type: 'text', value: (s.tags || []).join(', '), placeholder: 'np. Prawo pracy, orzeczenie' });
      const kind = h('select', { onchange: () => { eliBox.hidden = kind.value !== 'eli'; if (kind.value === 'eli' && !url.value) url.value = ELI_API; } },
        h('option', { value: 'www', selected: s.kind === 'www' }, 'strona www z dokumentami'), h('option', { value: 'eli', selected: s.kind === 'eli' }, 'API aktów prawnych Sejmu (ELI)'), h('option', { value: 'api', selected: s.kind === 'api' }, 'API (JSON) – inne'),
        h('option', { value: 'steno', selected: s.kind === 'steno' }, 'stenogramy Sejmu (API Sejmu)'), h('option', { value: 'wiki', selected: s.kind === 'wiki' }, 'Wikipedia (API MediaWiki)'));
      eliBox.hidden = s.kind !== 'eli';
      const close = modal(src ? `Źródło: ${s.name}` : 'Nowe źródło',
        h('div.fields', h('div.field', h('label', 'Nazwa'), name), h('div.field', h('label', 'Rodzaj', help('Strona www: panel szuka na niej linków do dokumentów (PDF, Word, HTML…). API ELI: lista aktów Dziennika Ustaw albo Monitora Polskiego z wybranych lat, z datą ostatniej zmiany każdego aktu. API (JSON): dowolne API zwracające JSON – sprawdzane jest, czy działa, ile ma pozycji i czy coś się zmieniło.', 'research-zrodla')), kind)),
        h('div.field', h('label', 'Adres'), url), h('div.field', h('label', 'Opis'), desc), eliBox,
        h('div.field', h('label', 'Kategorie dokumentów z tego źródła ', help('Pobrane z tego źródła dokumenty dostaną te kategorie (plakietki) – po przecinku. W Dokumentach i Formatowaniu można po nich filtrować.', 'kategorie')), tagsIn),
        h('div.field.check', gen, h('label', ' Tekst ogólny (nie prawniczy) ', help('Dokumenty pobrane z tego źródła dostaną oznaczenie „ogólny”. W nauce idą tylko do ustalonego udziału (Nauka → „Udział tekstu ogólnego”).', 'tekst-ogolny'))),
        h('div.row.end', h('button', { type: 'button', onclick: async () => {
          if (!name.value.trim() || !/^https?:\/\//.test(url.value.trim())) return toast('Podaj nazwę i pełny adres (https://…).', 'error');
          Object.assign(s, { name: name.value.trim(), url: url.value.trim(), kind: kind.value, description: desc.value.trim(), general: gen.checked, tags: mergeTags(tagsIn.value.split(',')),
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
      if (fresh.length > 1) box.append(h('button.ghost.small', { type: 'button', onclick: async e => { e.currentTarget.disabled = true; for (const l of fresh) await download(l.url, { name: l.name, description: `Źródło: ${s.name}`, general: !!s.general, tags: s.tags || [] }, box); await checkSource(s); draw(); } }, `Pobierz wszystkie nowe (${fresh.length})`));
      if (L.links.length) box.append(h('div.tablebox', h('table.srctable', h('tbody', L.links.slice(0, 150).map(l => h('tr',
        h('td', h('a', { href: l.url, target: '_blank', rel: 'noopener', title: l.url }, l.title)),
        h('td', l.have ? h('span.badge.ok', 'już pobrany') : h('span.badge.corrected', 'nowy')),
        h('td.actions', l.have ? null : h('button.small', { type: 'button', onclick: async e => { const cell = e.currentTarget.parentNode; e.currentTarget.remove(); if (await download(l.url, { name: l.name, description: `Źródło: ${s.name}`, general: !!s.general, tags: s.tags || [] }, cell)) l.have = true; } }, 'Pobierz'))))))));
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
            const ok = await download(eliTextUrl(a), { general: !!s.general, tags: s.tags || [], name: `${a.eli.replace(/\//g, ' ')} – ${a.title}`.slice(0, 180), description: `ELI ${a.eli} (${PUBLISHERS[a.eli.split('/')[0]] || ''})`, eli: a.eli, sourceChangeDate: a.changeDate, force: a.changed }, cell);
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
      if (isSaos(s.url) && L.sample && L.sample.some(x => x.id != null)) return saosView(s, L);
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

    // Pakiety tematyczne: źródła + akty (ELI) + hasła Wikipedii (tekst ogólny) + typowe pytania; wbudowane i własne
    async function packsView(all) {
      const packs = await listPacks();
      let docs = await listDocs(), have = new Set(docs.map(d => d.eli).filter(Boolean)), urls = docs.map(d => d.sourceUrl || '');
      const refresh = async () => { docs = await listDocs(); have = new Set(docs.map(d => d.eli).filter(Boolean)); urls = docs.map(d => d.sourceUrl || ''); };
      const wikiHave = t => urls.some(u => u.startsWith('https://pl.wikipedia.org/wiki/') && decodeURIComponent(u.slice(30)).replace(/_/g, ' ').toLowerCase() === t.toLowerCase());
      const dlgKeys = new Set((await listDialogs()).map(d => (d.turns[0] ? d.turns[0].text : '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()));
      return h('details.packs', { open: true }, h('summary', h('b', `Pakiety tematyczne (${packs.length})`), ' ', help('Pakiet to gotowy zestaw do jednej dziedziny: źródła do listy, akty prawne z Dziennika Ustaw (po identyfikatorze ELI, ze sprawdzeniem tytułu), hasła Wikipedii pobierane jako tekst ogólny i typowe pytania jako szkielety rozmów wzorcowych. Już pobrane są pomijane, więc pakiet można uruchamiać wielokrotnie. Własne pakiety tworzysz przyciskiem „Nowy pakiet”.', 'pakiety')),
        h('div.row.wrap', h('button.ghost.small', { type: 'button', onclick: () => packEditor(null) }, 'Nowy pakiet'),
          h('button.ghost.small', { type: 'button', onclick: async () => {
            const [f] = await pickFiles('.json,application/json', false); if (!f) return;
            try { const p = packFromFile(JSON.parse(await f.text())); if ((await listPacks()).some(x => x.id === p.id) && !await confirmBox('Pakiet już jest', `Pakiet „${p.name}” (${p.id}) już jest. Zastąpić go wczytanym?`, 'Zastąp')) return; await savePack(p); toast(`Wczytano pakiet „${p.name}”.`, 'ok'); draw(); }
            catch (e) { toast(`${f.name}: ${e.message}`, 'error', 8000); }
          } }, 'Wczytaj pakiet z pliku')),
        ...packs.map(pk => {
          const srcMiss = catalogMissing(all, pk.sources), actsMiss = pk.acts.filter(a => !have.has(a.eli)), wikiMiss = pk.wiki.filter(t => !wikiHave(t));
          const qMiss = (pk.questions || []).filter(q => !dlgKeys.has(q.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()));
          const missText = () => `Brakuje: źródeł ${catalogMissing(all, pk.sources).length}, aktów ${pk.acts.filter(a => !have.has(a.eli)).length}, haseł Wikipedii ${pk.wiki.filter(t => !wikiHave(t)).length}.`;
          const out = h('div.packout'), missLine = h('p.note', missText());
          const run = async (btn, label, items, fn) => {
            btn.disabled = true; clear(out);
            const head = h('p.status', `${label}: 0 z ${items.length}…`), ul = h('ul.packlog'); out.append(head, ul);
            const cnt = {};
            for (let i = 0; i < items.length; i++) {
              const it = items[i], li = h('li', fn.label(it) + ' …'); ul.append(li);
              let r; try { r = await fn.run(it); } catch (e) { r = { status: 'blad', error: e.message }; }
              cnt[r.status] = (cnt[r.status] || 0) + 1;
              li.className = 'pk-' + r.status; li.textContent = `${fn.label(it)} – ${STATUS_TXT[r.status] || r.status}${r.title && r.title !== fn.label(it) ? ': ' + r.title.slice(0, 120) : ''}${r.error ? ' (' + r.error + ')' : ''}`;
              head.textContent = `${label}: ${i + 1} z ${items.length}…`;
            }
            head.textContent = `${label}: gotowe – ` + Object.entries(cnt).map(([k, v]) => `${STATUS_TXT[k] || k}: ${v}`).join(', ') + '. Nowe dokumenty są w Formatowaniu.';
            await refresh(); missLine.textContent = missText();
            toast(`${pk.name}: ${label.toLowerCase()} – gotowe.`, 'ok'); btn.disabled = false;
          };
          // nowsze teksty jednolite aktów z pakietu
          const checkTj = async btn => {
            btn.disabled = true; clear(out);
            const head = h('p.status', 'Szukam nowszych tekstów jednolitych w Dzienniku Ustaw…'), ul = h('ul.packlog'); out.append(head, ul);
            const cache = new Map(); let found = 0;
            for (const a of pk.acts) {
              if (a.tj === '-') continue;
              let n; try { n = await findNewerConsolidated(a, { cache }); } catch (e) { ul.append(h('li.pk-blad', `${a.eli} (${a.note}) – błąd: ${e.message}`)); continue; }
              if (!n) { ul.append(h('li.pk-jest', `${a.eli} (${a.note}) – aktualny`)); continue; }
              found++;
              const li = h('li.pk-zmieniony', `${a.eli} (${a.note}) – jest nowszy tekst jednolity: ${n.eli} – ${n.title.slice(0, 140)} `);
              li.append(h('button.small', { type: 'button', onclick: async e => {
                e.currentTarget.disabled = true; li.append(h('span.note', ' pobieram…'));
                const r = await downloadEliAct(n.eli, { tags: [pk.name], description: `${a.note} (nowszy tekst jednolity). ELI ${n.eli}. Pakiet: ${pk.name}.` });
                if (r.status === 'dodano' || r.status === 'jest') {
                  const old = (await listDocs()).filter(d => d.eli === a.eli); await markOutdated(old, `nowszy tekst jednolity ${n.eli}`);
                  await savePack({ ...pk, acts: pk.acts.map(x => x === a ? { ...a, eli: n.eli } : x) });
                  li.lastChild.textContent = ` pobrano i podmieniono w pakiecie${old.length ? `; poprzednia wersja oznaczona jako „nieaktualny”` : ''}.`;
                  await refresh(); missLine.textContent = missText();
                } else li.lastChild.textContent = ` ${STATUS_TXT[r.status] || r.status}${r.error ? ': ' + r.error : ''}`;
              } }, 'Pobierz i podmień w pakiecie'));
              ul.append(li);
            }
            head.textContent = found ? `Nowsze teksty jednolite: ${found}. Pobranie podmienia akt w pakiecie, a starą wersję w bibliotece oznacza jako „nieaktualny”.` : 'Wszystkie akty z pakietu są w najnowszym tekście jednolitym (sprawdzono ostatnie 5 lat).';
            btn.disabled = false;
          };
          return h('section.pack',
            h('div.row.wrap', h('b', pk.name), pk.builtin ? h('span.badge', pk.edited ? 'wbudowany, zmieniony' : 'wbudowany') : h('span.badge', 'własny'),
              h('span.badge', `${pk.sources.length} źródeł`), h('span.badge', `${pk.acts.length} aktów`), h('span.badge.gen', `${pk.wiki.length} haseł Wikipedii (ogólne)`), h('span.badge', `${(pk.questions || []).length} pytań`), h('span.sp'),
              h('button.ghost.small', { type: 'button', onclick: () => packEditor(pk) }, 'Edytuj pakiet'),
              h('button.ghost.small', { type: 'button', onclick: () => saveFile(`pakiet-${pk.id}.json`, JSON.stringify(packToFile(pk), null, 1)) }, 'Zapisz pakiet do pliku'),
              !pk.builtin || pk.edited ? h('button.ghost.small.danger', { type: 'button', onclick: async () => { if (await confirmBox(pk.builtin ? 'Przywrócić wbudowany pakiet?' : 'Usunąć pakiet?', pk.builtin ? `Twoje zmiany w „${pk.name}” zostaną usunięte.` : `„${pk.name}” zniknie z listy (dokumenty i źródła zostają).`, pk.builtin ? 'Przywróć' : 'Usuń', true)) { await deletePack(pk.id); draw(); } } }, pk.builtin ? 'Przywróć wbudowany' : 'Usuń pakiet') : null),
            pk.description ? h('p.note', pk.description) : null,
            missLine,
            h('div.row.wrap',
              h('button.ghost', { type: 'button', disabled: !srcMiss.length, onclick: async () => { for (const c of srcMiss) await addFromCatalog({ ...c, tags: mergeTags(c.tags, [pk.name]) }); toast(`Dodano ${srcMiss.length} źródeł z pakietu „${pk.name}”.`, 'ok'); draw(); } }, `Dodaj źródła pakietu (${srcMiss.length})`),
              h('button', { type: 'button', disabled: !actsMiss.length, onclick: e => run(e.currentTarget, 'Akty prawne', actsMiss, { label: a => `${a.eli} (${a.note})`, run: a => downloadEliAct(a.eli, { expect: a.expect, tags: [pk.name], description: `${a.note}. ELI ${a.eli}. Pakiet: ${pk.name}.` }) }) }, `Pobierz akty pakietu (${actsMiss.length})`),
              h('button', { type: 'button', disabled: !wikiMiss.length, onclick: e => run(e.currentTarget, 'Hasła Wikipedii', wikiMiss, { label: t => t, run: t => downloadWikiTitle(t, { tags: [pk.name], description: `Pakiet: ${pk.name}.` }) }) }, `Pobierz hasła Wikipedii (${wikiMiss.length})`),
              h('button.ghost', { type: 'button', disabled: !qMiss.length, onclick: async () => { const r = await addQuestionDrafts(qMiss, pk.name); toast(`Dodano ${r.added} ${plural(r.added, 'pytanie', 'pytania', 'pytań')} do rozmów wzorcowych (do uzupełnienia odpowiedzi).`, 'ok', 6000); draw(); } }, `Dodaj pytania do rozmów wzorcowych (${qMiss.length})`),
              h('button.ghost', { type: 'button', disabled: !pk.acts.some(a => a.tj !== '-'), onclick: e => checkTj(e.currentTarget) }, 'Sprawdź nowe teksty jednolite')),
            out);
        }));
    }

    // Edytor pakietu: nazwa, opis, źródła (z listy Researchu), akty (ELI | słowo w tytule | opis), hasła Wikipedii, typowe pytania
    async function packEditor(pk) {
      const p = pk ? JSON.parse(JSON.stringify(pk)) : { id: '', name: '', description: '', sources: [], acts: [], wiki: [], questions: [] };
      const name = h('input', { type: 'text', value: p.name, placeholder: 'np. Ochrona danych osobowych' });
      const desc = h('textarea', { rows: 2, value: p.description, placeholder: 'Czego dotyczy pakiet' });
      const acts = h('textarea.mono', { rows: 6, value: p.acts.map(a => [a.eli, a.expect, a.note, a.tj].filter((x, i) => i < 3 || x).join(' | ')).join('\n'), placeholder: 'DU/2026/1245 | Kodeks pracy | Kodeks pracy – tekst jednolity' });
      const wiki = h('textarea', { rows: 5, value: p.wiki.join('\n'), placeholder: 'Jeden tytuł hasła w linii, np. Urlop wypoczynkowy' });
      const qs = h('textarea', { rows: 5, value: (p.questions || []).join('\n'), placeholder: 'Jedno pytanie w linii, tak jak zadałby je ktoś potocznie' });
      const srcs = await listSources(), inPack = new Set(p.sources.map(s => s.kind + '|' + s.url));
      const srcBoxes = [...p.sources.map(s => ({ s, on: true })), ...srcs.filter(s => !inPack.has(s.kind + '|' + s.url)).map(s => ({ s, on: false }))]
        .map(x => ({ ...x, i: h('input', { type: 'checkbox', checked: x.on }) }));
      const close = modal(pk ? `Edycja pakietu: ${pk.name}` : 'Nowy pakiet',
        h('div.field', h('label', 'Nazwa'), name), h('div.field', h('label', 'Opis'), desc),
        h('div.field', h('label', 'Źródła pakietu ', help('Zaznacz źródła z listy Researchu, które mają wejść do pakietu. „Dodaj źródła pakietu” doda je komuś, kto wczyta ten pakiet.', 'pakiety')),
          srcBoxes.length ? h('div.srcpick', srcBoxes.map(x => h('label.check', x.i, ' ', x.s.name, h('span.note', ' – ' + (x.s.url || ''))))) : h('p.note', 'Brak źródeł na liście Researchu.')),
        h('div.field', h('label', 'Akty prawne (jeden w linii: ELI | słowo, które musi być w tytule | opis | fraza tekstu jednolitego) ', help('Identyfikator ELI z api.sejm.gov.pl, np. DU/2026/1245. Słowo z tytułu chroni przed pomyłką w numerze. Fraza tekstu jednolitego (opcjonalna, domyślnie słowo z tytułu) służy do szukania nowszych tekstów jednolitych; „-” = nie szukaj.', 'pakiety')), acts),
        h('div.field', h('label', 'Hasła Wikipedii (tekst ogólny)'), wiki),
        h('div.field', h('label', 'Typowe pytania (szkielety rozmów wzorcowych)'), qs),
        h('div.row.end', h('button', { type: 'button', onclick: async () => {
          if (!name.value.trim()) return toast('Podaj nazwę pakietu.', 'error', 3000, { log: false });
          const lines = acts.value.split('\n').map(l => l.trim()).filter(Boolean), bad = lines.filter(l => !/^[A-Z]+\/\d{4}\/\d+\b/.test(l));
          if (bad.length) return toast(`Zły identyfikator ELI w linii: „${bad[0]}” (powinno być np. DU/2026/1245).`, 'error', 6000, { log: false });
          const saved = await savePack({ id: p.id || 'pakiet-' + slugify(name.value), name: name.value, description: desc.value,
            sources: srcBoxes.filter(x => x.i.checked).map(({ s }) => ({ name: s.name, kind: s.kind, url: s.url, description: s.description, general: s.general, tags: s.tags || [], eli: s.eli || null })),
            acts: lines.map(l => { const [eli, expect, note, tj] = l.split('|').map(x => (x || '').trim()); return { eli, expect, note: note || expect || eli, tj }; }),
            wiki: wiki.value.split('\n'), questions: qs.value.split('\n') });
          close(); toast(`Zapisano pakiet „${saved.name}”.`, 'ok'); draw();
        } }, 'Zapisz pakiet')));
    }
    const slugify = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'pakiet';

    // SAOS: lista orzeczeń z wyszukiwania + pobieranie pełnej treści do biblioteki
    function saosView(s, L) {
      const box = h('div'), items = L.sample.filter(x => x.id != null);
      (async () => {
        const docs = await listDocs(), have = new Set(docs.map(d => d.sourceUrl));
        const fresh = items.filter(x => !have.has(saosUrl(x.id)));
        const dl = async (x, cell) => {
          cell.textContent = 'pobieram…';
          const r = await downloadSaosJudgment(x.id, { tags: s.tags || [] });
          cell.textContent = STATUS_TXT[r.status] + (r.error ? ': ' + r.error : ''); cell.className = 'pk-' + r.status;
          return r.status === 'dodano';
        };
        box.append(h('div.row.wrap', h('span.note', `Orzeczeń w odpowiedzi: ${num(items.length)}${L.total != null ? ` (wszystkich pasujących: ${num(L.total)})` : ''} — nowe: ${num(fresh.length)}, już pobrane: ${num(items.length - fresh.length)}.`), h('span.sp'),
          fresh.length ? h('button.small', { type: 'button', onclick: async e => { e.currentTarget.disabled = true; let n = 0; for (const x of fresh) { const c = box.querySelector(`[data-sid="${x.id}"]`); if (await dl(x, c)) n++; } toast(`Pobrano ${n} ${plural(n, 'orzeczenie', 'orzeczenia', 'orzeczeń')} do biblioteki.`, 'ok'); } }, `Pobierz wszystkie nowe orzeczenia (${fresh.length})`) : null),
          h('table.srctable', h('tbody', items.map(x => { const got = have.has(saosUrl(x.id)), cell = h('td', { dataset: { sid: String(x.id) } }, got ? h('span.badge.ok', 'już pobrane') : h('button.small.ghost', { type: 'button', onclick: async e => { await dl(x, e.currentTarget.parentNode); } }, 'Pobierz'));
            return h('tr', h('td', h('a', { href: saosUrl(x.id), target: '_blank', rel: 'noopener' }, x.label || String(x.id))), h('td.note', x.date || ''), cell); }))));
      })();
      return h('details', { open: true }, h('summary', 'Orzeczenia (SAOS)'), box);
    }

    async function draw() {
      const all = await listSources();
      clear(list); clear(extra);
      extra.append(await packsView(all));
      const miss = catalogMissing(all);
      if (miss.length) extra.append(h('details.catalog', { open: !all.length }, h('summary', h('b', `Znane źródła do dodania (${miss.length})`), ' ', help('Oficjalne źródła dokumentów prawnych: akty (ELI), decyzje i rekomendacje urzędów (UOKiK, UODO, KNF), interpretacje (ZUS, KIS) oraz API (SAOS, Sejm). Oznaczone „ogólny” to tekst ogólny do nauki zwykłej polszczyzny (stenogramy Sejmu, Wikipedia). Po dodaniu możesz zmienić ich ustawienia w „Edytuj”.', 'research-zrodla')),
        h('div.row.end', h('button', { type: 'button', onclick: async () => { for (const c of miss) await addFromCatalog(c); toast(`Dodano ${miss.length} źródeł.`, 'ok'); draw(); } }, `Dodaj wszystkie (${miss.length})`)),
        ...miss.map(c => h('div.row.wrap.catrow', h('b', c.name), h('span.badge', KIND[c.kind] || 'strona www'), c.general ? h('span.badge.gen', 'ogólny') : null, h('span.note', c.description), h('span.sp'),
          h('button.ghost.small', { type: 'button', onclick: async () => { await addFromCatalog(c); draw(); } }, 'Dodaj')))));
      if (!all.length) list.append(h('p.note', 'Brak źródeł. Dodaj je z „Znanych źródeł” poniżej albo przyciskiem „Dodaj źródło”.'));
      for (const s of all) {
        const n = (await docsOfSource(s)).length, st = h('span.status');
        list.append(h('article.source',
          h('div.row.wrap', h('b', s.name), h('span.badge', s.kind === 'eli' ? `API ELI · ${PUBLISHERS[s.eli.publisher]} · ${s.eli.years}` : KIND[s.kind] || 'strona www'), s.general ? h('span.badge.gen', { title: 'Tekst ogólny (nie prawniczy)' }, 'ogólny') : null, ...tagChips(s.tags),
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
