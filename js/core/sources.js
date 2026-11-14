// Research: źródła dokumentów (strony www i API ELI Sejmu), sprawdzanie ich i pobieranie dokumentów do biblioteki.
//
// rekord źródła: { id, name, url, kind: 'www' | 'eli' | 'api' | 'steno' | 'wiki', general (tekst ogólny), description, addedAt,
//                  eli?: { publisher: 'DU'|'MP', years: '2024, 2025', filter: 'kodeks, ustawa' },
//                  last?: { at, ok, status, ms, cors, error, hash, changed, links?, acts? } }
//
// Ograniczenie przeglądarki (CORS): strona może pobrać plik z innego serwisu tylko wtedy, gdy ten serwis na to pozwala.
// Sprawdzanie rozróżnia: działa / serwis odpowiada błędem (kod HTTP) / brak zgody CORS albo brak połączenia.

import { db, uid } from './db.js';
import { listDocs, addDoc, findDuplicate, textHash } from './documents.js';
import { readFile } from '../reader/index.js';
import { log } from './log.js';

export const ELI_API = 'https://api.sejm.gov.pl/eli';
export const PUBLISHERS = { DU: 'Dziennik Ustaw', MP: 'Monitor Polski' };
const DOC_EXT = /\.(pdf|docx?|odt|rtf|txt|html?)(\?|#|$)/i;

export const listSources = async () => (await db.all('sources')).sort((a, b) => a.addedAt - b.addedAt);
export const saveSource = s => db.put('sources', s);
export const deleteSource = id => db.del('sources', id);
export function newSource({ name, url, kind = 'www', description = '', eli = null }) {
  return { id: uid('s_'), name, url, kind, description, eli: kind === 'eli' ? { publisher: 'DU', years: String(new Date().getFullYear()), filter: '', ...eli } : null, addedAt: Date.now() };
}
export const hostOf = u => { try { return new URL(u).host; } catch (_) { return ''; } };

// Domeny, z których pochodzą dokumenty w bibliotece, a których nie ma na liście źródeł
export async function sourcesFromDocuments(sources) {
  const known = new Set(sources.map(s => hostOf(s.url))), by = new Map();
  for (const d of await listDocs()) { const host = hostOf(d.sourceUrl); if (host && !known.has(host)) by.set(host, (by.get(host) || 0) + 1); }
  return [...by].map(([host, n]) => ({ host, n }));
}
// Liczba dokumentów pobranych z danego źródła (po domenie albo ELI)
export async function docsOfSource(src) {
  const host = hostOf(src.url), docs = await listDocs();
  // akt z API ELI należy tylko do źródła ELI tego samego wydawnictwa (nie do innych źródeł z tej samej domeny)
  return docs.filter(d => d.eli ? src.kind === 'eli' && d.eli.startsWith((src.eli || {}).publisher + '/')
    : !!host && hostOf(d.sourceUrl) === host);
}

// Pobranie z rozróżnieniem przyczyn błędu
export async function probe(url, { as = 'text', timeout = 20000 } = {}) {
  const t0 = performance.now(), ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { mode: 'cors', cache: 'no-store', signal: ctl.signal });
    const body = r.ok ? (as === 'json' ? await r.json().catch(() => { throw new Error('Odpowiedź nie jest poprawnym JSON.'); }) : as === 'blob' ? await r.blob() : await r.text()) : null;
    return { ok: r.ok, status: r.status, cors: true, ms: Math.round(performance.now() - t0), body, type: r.headers.get('content-type') || '' };
  } catch (e) {
    const aborted = e.name === 'AbortError';
    return { ok: false, status: 0, cors: false, ms: Math.round(performance.now() - t0), error: aborted ? `Brak odpowiedzi w ${timeout / 1000} s.` : e.message.startsWith('Odpowiedź') ? e.message : 'Brak zgody CORS albo brak połączenia: serwis nie pozwala pobierać danych z tej strony w przeglądarce (albo jest niedostępny).' };
  } finally { clearTimeout(tm); }
}

// ---------- strona www ----------
// Dostępność, czy treść zmieniła się od ostatniego sprawdzenia, linki do dokumentów (nowe / już pobrane)
export async function checkWeb(src) {
  const r = await probe(src.url);
  const last = { at: Date.now(), ok: r.ok, status: r.status, ms: r.ms, cors: r.cors, error: r.error || (r.ok ? null : `Serwis odpowiedział kodem ${r.status}.`) };
  if (r.ok) {
    last.hash = await textHash(r.body);
    last.changed = src.last && src.last.hash ? src.last.hash !== last.hash : null;
    const doc = new DOMParser().parseFromString(r.body, 'text/html'), seen = new Set(), links = [];
    const downloaded = new Set((await listDocs()).map(d => (d.sourceUrl || '').replace(/#.*$/, '')));
    for (const a of doc.querySelectorAll('a[href]')) {
      let href; try { href = new URL(a.getAttribute('href'), src.url).href.replace(/#.*$/, ''); } catch (_) { continue; }
      if (!/^https?:/.test(href) || seen.has(href) || !DOC_EXT.test(href)) continue;
      seen.add(href);
      links.push({ url: href, title: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) || href.split('/').pop(), have: downloaded.has(href) });
    }
    last.links = links.slice(0, 300);
  }
  src.last = last; await saveSource(src);
  return last;
}

// ---------- API ELI Sejmu ----------
// Lista aktów z wybranych lat; nowe = nie ma ich w bibliotece, zmienione = changeDate nowsze niż przy pobraniu.
export async function checkEli(src) {
  const cfg = src.eli || {}, years = String(cfg.years || '').split(/[,\s]+/).filter(Boolean);
  const words = String(cfg.filter || '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean);
  const docs = await listDocs(), byEli = new Map(docs.filter(d => d.eli).map(d => [d.eli, d]));
  const last = { at: Date.now(), ok: true, status: 200, ms: 0, cors: true, acts: [], total: 0 };
  for (const y of years) {
    const r = await probe(`${ELI_API}/acts/${cfg.publisher}/${y}`, { as: 'json' });
    last.ms += r.ms;
    if (!r.ok) { Object.assign(last, { ok: false, status: r.status, cors: r.cors, error: r.error || `API odpowiedziało kodem ${r.status} (rok ${y}).` }); break; }
    const items = Array.isArray(r.body) ? r.body : r.body.items || [];
    last.total += items.length;
    for (const it of items) {
      const title = it.title || '', eli = it.ELI || `${cfg.publisher}/${y}/${it.pos}`;
      if (words.length && !words.some(w => title.toLowerCase().includes(w))) continue;
      const d = byEli.get(eli);
      last.acts.push({ eli, title, changeDate: it.changeDate || null, announcementDate: it.announcementDate || it.promulgation || null, html: !!it.textHTML, pdf: it.textPDF !== false,
        have: !!d, changed: !!(d && it.changeDate && d.sourceChangeDate && it.changeDate > d.sourceChangeDate), docId: d && d.id });
    }
  }
  last.hash = await textHash(JSON.stringify(last.acts.map(a => [a.eli, a.changeDate])));
  last.changed = src.last && src.last.hash ? src.last.hash !== last.hash : null;
  last.acts = last.acts.slice(0, 2000);
  src.last = last; await saveSource(src);
  return last;
}

export async function checkSource(src) {
  let L;
  try { L = await ({ eli: checkEli, api: checkApi, steno: checkSteno, wiki: checkWiki }[src.kind] || checkWeb)(src); }
  catch (e) { log('error', 'research', `Sprawdzanie „${src.name}” przerwane: ${e.message}`, e); throw e; }
  if (L.ok) log('info', 'research', `Sprawdzono „${src.name}”: działa (${L.ms} ms)${L.changed ? ', są zmiany' : ''}`, src.url);
  else log('warn', 'research', `Sprawdzono „${src.name}”: ${L.cors ? 'błąd ' + L.status : 'niedostępne / CORS'}`, [src.url, L.error].filter(Boolean).join('\n'));
  return L;
}

// ---------- pobieranie do biblioteki ----------
const nameFromUrl = (u, type) => { const n = decodeURIComponent((u.split('?')[0].split('/').pop() || 'dokument')); return /\.\w{2,5}$/.test(n) ? n : n + (type.includes('pdf') ? '.pdf' : type.includes('html') ? '.html' : '.txt'); };

// Pobiera plik spod adresu, odczytuje (PDF/OCR/Word/HTML…) i dodaje do biblioteki z adresem źródła.
// Zwraca { doc } albo { duplicate } (gdy taki dokument już jest i nie wymuszono pobrania).
export async function downloadToLibrary(url, { name, description = '', eli = null, sourceChangeDate = null, general = false, tags = [], force = false, onProgress } = {}) {
  if (!force) { const dup = await findDuplicate({ url, eli }); if (dup) return { duplicate: dup }; }
  const r = await probe(url, { as: 'blob', timeout: 60000 });
  if (!r.ok) { const msg = r.error || `Serwis odpowiedział kodem ${r.status}.`; log('error', 'research', 'Nie udało się pobrać dokumentu: ' + msg, url); throw new Error(msg); }
  const file = new File([r.body], name || nameFromUrl(url, r.type), { type: r.type.split(';')[0] });
  const read = await readFile(file, onProgress);
  if (!force) { const dup = await findDuplicate({ raw: read.raw }); if (dup) return { duplicate: dup }; }
  const doc = await addDoc({ ...read, name: name || read.name, description, sourceUrl: url, eli, sourceChangeDate, general, tags });
  return { doc };
}
export const eliTextUrl = (act, kind = act.html ? 'html' : 'pdf') => `${ELI_API}/acts/${act.eli}/text.${kind}`;

// Sprawdzenie adresu: czy dokument spod niego już jest w bibliotece (po adresie albo po treści po pobraniu)
export async function checkUrl(url) {
  const byUrl = await findDuplicate({ url });
  if (byUrl) return { have: true, ...byUrl };
  const r = await probe(url, { as: 'blob' });
  if (!r.ok) return { have: false, reachable: false, error: r.error || `Serwis odpowiedział kodem ${r.status}.` };
  const read = await readFile(new File([r.body], nameFromUrl(url, r.type), { type: r.type.split(';')[0] }));
  const byText = await findDuplicate({ raw: read.raw });
  return byText ? { have: true, ...byText, reachable: true } : { have: false, reachable: true, chars: read.raw.length };
}

// Dokumenty z adresem źródła: czy u źródła zmieniła się treść od pobrania
export async function checkDocChanged(d) {
  const r = await probe(d.sourceUrl, { as: 'blob', timeout: 60000 });
  if (!r.ok) return { ok: false, error: r.error || `Kod ${r.status}.` };
  const read = await readFile(new File([r.body], d.name, { type: r.type.split(';')[0] }));
  return { ok: true, changed: (await textHash(read.raw)) !== (d.rawHash || await textHash(d.raw)), read };
}

// ---------- znane źródła (katalog do dodania jednym kliknięciem) ----------
// Adresy sprawdzone w listopadzie 2026 r. na stronach urzędów; jeśli urząd zmieni adres, popraw go w „Edytuj”.
export const CATALOG = [
  { name: 'Dziennik Ustaw (API ELI Sejmu)', kind: 'eli', url: ELI_API, eli: { publisher: 'DU', years: '2025, 2026', filter: 'kodeks, ustawa' }, description: 'Ustawy i rozporządzenia; nowe i zmienione akty z wybranych lat.' },
  { name: 'Monitor Polski (API ELI Sejmu)', kind: 'eli', url: ELI_API, eli: { publisher: 'MP', years: '2026', filter: '' }, description: 'Uchwały, obwieszczenia, zarządzenia.' },
  { name: 'UOKiK – baza decyzji Prezesa UOKiK', kind: 'www', url: 'https://decyzje.uokik.gov.pl/bp/dec_prez.nsf', description: 'Decyzje z zakresu ochrony konkurencji i konsumentów (PDF).' },
  { name: 'UODO – decyzje Prezesa UODO', kind: 'www', url: 'https://uodo.gov.pl/pl/p/decyzje', description: 'Decyzje w sprawach ochrony danych osobowych (RODO).' },
  { name: 'KNF – rekomendacje dla banków', kind: 'www', url: 'https://www.knf.gov.pl/dla_rynku/regulacje_i_praktyka/rekomendacje_i_wytyczne/rekomendacje_dla_bankow', description: 'Rekomendacje Komisji Nadzoru Finansowego (PDF).' },
  { name: 'KNF – Dziennik Urzędowy KNF', kind: 'www', url: 'https://dziennikurzedowy.knf.gov.pl/', description: 'Oficjalne teksty aktów KNF (rekomendacje, wytyczne, uchwały).' },
  { name: 'ZUS – interpretacje (BIP)', kind: 'www', url: 'https://www.zus.pl/en/web/biuletyn-informacji-publicznej/inne/interpretacje', description: 'Pisemne interpretacje przepisów z zakresu ubezpieczeń społecznych; strona z wyszukiwarką – linki do dokumentów mogą pojawiać się dopiero po wyszukaniu.' },
  { name: 'KIS – EUREKA (interpretacje podatkowe)', kind: 'www', url: 'https://eureka.mf.gov.pl/', description: 'Interpretacje indywidualne i ogólne, objaśnienia podatkowe; wyszukiwarka – linki do dokumentów mogą pojawiać się dopiero po wyszukaniu.' },
  { name: 'SAOS – orzeczenia sądów (API)', kind: 'api', url: 'https://www.saos.org.pl/api/search/judgments?pageSize=20&sortingField=JUDGMENT_DATE&sortingDirection=DESC', description: 'System Analizy Orzeczeń Sądowych: publiczne API (JSON, bez klucza) – najnowsze orzeczenia sądów powszechnych, SN, TK, KIO.' },
  { name: 'Sejm – druki sejmowe (API)', kind: 'api', url: 'https://api.sejm.gov.pl/sejm/term10/prints?sort_by=-deliveryDate', description: 'Projekty ustaw, sprawozdania komisji i inne druki Sejmu X kadencji, najnowsze najpierw (JSON).' },
  { name: 'Sejm – procesy legislacyjne (API)', kind: 'api', url: 'https://api.sejm.gov.pl/sejm/term10/processes', description: 'Przebieg prac nad projektami ustaw w Sejmie X kadencji: etapy, druki, uchwalenie (JSON).' },
  { name: 'Sejm – interpelacje (API)', kind: 'api', url: 'https://api.sejm.gov.pl/sejm/term10/interpellations?limit=50', description: 'Interpelacje poselskie i odpowiedzi ministrów – często z wykładnią przepisów (JSON).' },
  { name: 'Sejm – stenogramy posiedzeń', kind: 'steno', general: true, url: 'https://api.sejm.gov.pl/sejm/term10/proceedings', description: 'Stenogramy dni posiedzeń Sejmu X kadencji (PDF z API Sejmu): mówiona polszczyzna blisko tematów prawnych. Dokumenty urzędowe – bez ograniczeń prawa autorskiego.' },
  { name: 'Wikipedia (pl) – losowe artykuły', kind: 'wiki', general: true, url: 'https://pl.wikipedia.org/w/api.php', description: 'Współczesna, poprawna polszczyzna z różnych dziedzin. Licencja CC BY-SA 4.0: przy publikacji danych zostaje adres artykułu jako podanie źródła.' },
];
export function catalogMissing(sources, list = CATALOG) {
  // to samo źródło: ta sama nazwa albo ten sam rodzaj i adres (dla ELI także wydawnictwo i filtr tytułów)
  const key = s => s.kind + '|' + s.url + '|' + (s.eli ? s.eli.publisher + '|' + (s.eli.filter || '').toLowerCase().replace(/\s+/g, '') : '');
  const have = new Set(sources.map(key)), names = new Set(sources.map(s => s.name));
  return list.filter(c => !have.has(key(c)) && !names.has(c.name));
}
export const addFromCatalog = c => saveSource({ ...newSource(c), general: !!c.general, tags: [...(c.tags || [])], eli: c.eli ? { ...c.eli } : null });

// ---------- API (JSON) ----------
// Czy API odpowiada poprawnym JSON, ile ma pozycji (tablica albo pole items / results / data) i czy coś się zmieniło.
export async function checkApi(src) {
  const r = await probe(src.url, { as: 'json' });
  const last = { at: Date.now(), ok: r.ok, status: r.status, ms: r.ms, cors: r.cors, error: r.error || (r.ok ? null : `API odpowiedziało kodem ${r.status}.`) };
  if (r.ok) {
    const b = r.body, list = Array.isArray(b) ? b : Array.isArray(b.items) ? b.items : Array.isArray(b.results) ? b.results : Array.isArray(b.data) ? b.data : null;
    last.count = list ? list.length : null;
    last.total = b && b.info && b.info.totalResults != null ? b.info.totalResults : b && b.count != null ? b.count : null;
    const label = it => it.title || it.name || (it.courtCases && it.courtCases[0] && it.courtCases[0].caseNumber) || it.number || it.id;
    last.sample = list ? list.slice(0, isSaos(src.url) ? 50 : 10).map(it => ({ id: it.id ?? null, label: String(label(it) ?? '').slice(0, 160), date: it.judgmentDate || it.documentDate || it.date || it.deliveryDate || it.receiptDate || it.processStartDate || (Array.isArray(it.dates) ? it.dates[0] : '') || '' })) : [];
    last.hash = await textHash(JSON.stringify(b));
    last.changed = src.last && src.last.hash ? src.last.hash !== last.hash : null;
  }
  src.last = last; await saveSource(src);
  return last;
}

// ---------- stenogramy Sejmu ----------
// Lista posiedzeń → dni, które już się odbyły (najnowsze najpierw); każdy dzień to PDF stenogramu.
// Wynik w tym samym kształcie co linki ze strony www, więc pobieranie działa tak samo.
export async function checkSteno(src, { days = 20 } = {}) {
  const r = await probe(src.url, { as: 'json' });
  const last = { at: Date.now(), ok: r.ok, status: r.status, ms: r.ms, cors: r.cors, error: r.error || (r.ok ? null : `API odpowiedziało kodem ${r.status}.`) };
  if (r.ok) {
    const today = new Date().toISOString().slice(0, 10), base = src.url.replace(/\/$/, '');
    const all = (Array.isArray(r.body) ? r.body : []).flatMap(p => (p.dates || []).filter(d => d <= today).map(d => ({ num: p.number, date: d, title: p.title || `Posiedzenie nr ${p.number}` })))
      .filter(x => x.num > 0).sort((a, b) => b.date.localeCompare(a.date));
    const have = new Set((await listDocs()).map(d => d.sourceUrl));
    last.total = all.length;
    last.links = all.slice(0, days).map(x => { const url = `${base}/${x.num}/${x.date}/transcripts/pdf`;
      return { url, title: `${x.date} · ${x.title}`, name: `Stenogram Sejmu ${x.date} (posiedzenie nr ${x.num})`, have: have.has(url) }; });
    last.hash = await textHash(JSON.stringify(all));
    last.changed = src.last && src.last.hash ? src.last.hash !== last.hash : null;
  }
  src.last = last; await saveSource(src);
  return last;
}

// ---------- Wikipedia ----------
// API MediaWiki pozwala na pobieranie z innych stron po dodaniu origin=*.
const wikiUrl = (src, q) => src.url + '?' + new URLSearchParams({ format: 'json', origin: '*', ...q });
export async function checkWiki(src) {
  const r = await probe(wikiUrl(src, { action: 'query', meta: 'siteinfo', siprop: 'statistics' }), { as: 'json' });
  const last = { at: Date.now(), ok: r.ok, status: r.status, ms: r.ms, cors: r.cors, error: r.error || (r.ok ? null : `API odpowiedziało kodem ${r.status}.`), changed: null };
  if (r.ok) { const st = r.body.query && r.body.query.statistics; last.articles = st ? st.articles : null; }
  src.last = last; await saveSource(src);
  return last;
}
// Losowe artykuły (pełny tekst bez znaczników); krótkie (zalążki, ujednoznacznienia) i już pobrane są pomijane.
export async function downloadWiki(src, n = 10, { minChars = 3000, onStep } = {}) {
  const added = [];
  for (let tries = 0; added.length < n && tries < n * 4; tries++) {
    const r = await probe(wikiUrl(src, { action: 'query', generator: 'random', grnnamespace: 0, grnlimit: 1, prop: 'extracts|info', explaintext: 1, inprop: 'url' }), { as: 'json' });
    if (!r.ok) throw new Error(r.error || `API odpowiedziało kodem ${r.status}.`);
    const page = Object.values((r.body.query || {}).pages || {})[0];
    if (!page || !page.extract || page.extract.length < minChars || /ujednoznacznienie/i.test(page.title)) continue;
    if (await findDuplicate({ url: page.fullurl })) continue;
    added.push(await addWikiPage(page));
    if (onStep) onStep(added.length, n, page.title);
  }
  log('info', 'research', `Wikipedia: pobrano ${added.length} z ${n} artykułów`);
  return added;
}

// ---------- pobieranie po identyfikatorach (pakiety tematyczne, listy) ----------
// Akt z API ELI po identyfikatorze (np. DU/2026/1245). expect: słowo, które musi być w tytule – zabezpieczenie przed pomyłką w numerze.
// Wynik: { status: 'dodano' | 'jest' | 'zmieniony' | 'inny-tytul' | 'blad', title, doc?, error? }
export async function downloadEliAct(eli, { expect = '', general = false, description = '', tags = [], onProgress } = {}) {
  const info = await probe(`${ELI_API}/acts/${eli}`, { as: 'json' });
  if (!info.ok) { const error = info.error || `API odpowiedziało kodem ${info.status}.`; log('error', 'pakiety', `Akt ${eli}: ${error}`); return { status: 'blad', error }; }
  const it = info.body, title = it.title || eli;
  if (expect && !title.toLowerCase().includes(expect.toLowerCase())) {
    log('warn', 'pakiety', `Akt ${eli}: tytuł nie zawiera „${expect}” – pominięto (sprawdź numer w pakiecie)`, title);
    return { status: 'inny-tytul', title };
  }
  const dup = await findDuplicate({ eli }), d = dup && dup.doc;
  const changed = !!(d && it.changeDate && d.sourceChangeDate && it.changeDate > d.sourceChangeDate);
  if (d && !changed) return { status: 'jest', title, doc: d };
  try {
    const r = await downloadToLibrary(eliTextUrl({ eli, html: !!it.textHTML }), { name: `${eli.replace(/\//g, ' ')} – ${title}`.slice(0, 180),
      description: description || `ELI ${eli} (${PUBLISHERS[eli.split('/')[0]] || ''})`, eli, sourceChangeDate: it.changeDate || null, general, tags, force: changed, onProgress });
    return { status: changed ? 'zmieniony' : 'dodano', title, doc: r.doc };
  } catch (e) { return { status: 'blad', title, error: e.message }; }
}

// Artykuły Wikipedii po tytułach (przekierowania są rozwijane). Wynik jak wyżej: 'dodano' | 'jest' | 'brak' | 'blad'.
export const WIKI_API = 'https://pl.wikipedia.org/w/api.php';
async function addWikiPage(page, extra = '', tags = []) {
  const raw = page.extract.replace(/^(=+)\s*(.+?)\s*\1$/gm, '$2');
  return addDoc({ name: `Wikipedia – ${page.title}`, type: 'text', raw, sourceUrl: page.fullurl, general: true, tags,
    description: `Wikipedia (pl), artykuł „${page.title}”, licencja CC BY-SA 4.0.${extra ? ' ' + extra : ''}` });
}
export async function downloadWikiTitle(title, { api = WIKI_API, description = '', tags = [] } = {}) {
  const r = await probe(wikiUrl({ url: api }, { action: 'query', titles: title, redirects: 1, prop: 'extracts|info', explaintext: 1, inprop: 'url' }), { as: 'json' });
  if (!r.ok) { const error = r.error || `API odpowiedziało kodem ${r.status}.`; log('error', 'pakiety', `Wikipedia „${title}”: ${error}`); return { status: 'blad', error }; }
  const page = Object.values((r.body.query || {}).pages || {})[0];
  if (!page || page.missing != null || !page.extract) { log('warn', 'pakiety', `Wikipedia: brak artykułu „${title}”`); return { status: 'brak' }; }
  if (await findDuplicate({ url: page.fullurl })) return { status: 'jest', title: page.title };
  return { status: 'dodano', title: page.title, doc: await addWikiPage(page, description, tags) };
}

// ---------- nowszy tekst jednolity ----------
// Szuka w wykazach Dziennika Ustaw (ostatnie lata) obwieszczeń „…jednolitego tekstu…” z frazą act.tj (albo act.expect),
// ogłoszonych po akcie z pakietu. Zwraca najnowszy { eli, title, changeDate } albo null. cache: Map rok → wykaz.
export async function findNewerConsolidated(act, { cache = new Map(), years = 5 } = {}) {
  const phrase = (act.tj || act.expect || '').toLowerCase().replace(/[-–—]/g, '–');
  if (!phrase || phrase === '–') return null;
  const [pub, y0, p0] = act.eli.split('/'), now = new Date().getFullYear();
  let best = null;
  for (let y = Math.max(+y0, now - years + 1); y <= now; y++) {
    if (!cache.has(y)) { const r = await probe(`${ELI_API}/acts/${pub}/${y}`, { as: 'json' }); if (!r.ok) throw new Error(r.error || `API odpowiedziało kodem ${r.status} (wykaz ${pub} ${y}).`); cache.set(y, Array.isArray(r.body) ? r.body : r.body.items || []); }
    for (const it of cache.get(y)) {
      const t = (it.title || '').toLowerCase().replace(/[-–—]/g, '–'), pos = +it.pos || +String(it.ELI || '').split('/')[2] || 0;
      if (!t.includes('jednolitego tekstu') || !t.includes(phrase)) continue;
      if (y < +y0 || (y === +y0 && pos <= +p0)) continue;
      if (!best || y > best.y || (y === best.y && pos > best.pos)) best = { y, pos, eli: it.ELI || `${pub}/${y}/${pos}`, title: it.title, changeDate: it.changeDate || null };
    }
  }
  return best && { eli: best.eli, title: best.title, changeDate: best.changeDate };
}

// ---------- SAOS: pełne orzeczenia ----------
// Źródło API z adresem saos.org.pl: pozycje z wyszukiwania można pobrać w całości (treść z /api/judgments/{id}).
export const isSaos = url => /(^|\.)saos\.org\.pl\//.test(String(url).replace(/^https?:\/\//, ''));
export const saosUrl = id => `https://www.saos.org.pl/judgments/${id}`;
const COURT = { COMMON: 'sąd powszechny', SUPREME: 'Sąd Najwyższy', CONSTITUTIONAL_TRIBUNAL: 'Trybunał Konstytucyjny', NATIONAL_APPEAL_CHAMBER: 'Krajowa Izba Odwoławcza', ADMINISTRATIVE: 'sąd administracyjny' };
export async function downloadSaosJudgment(id, { tags = [], description = '' } = {}) {
  if (await findDuplicate({ url: saosUrl(id) })) return { status: 'jest' };
  const r = await probe(`https://www.saos.org.pl/api/judgments/${id}`, { as: 'json', timeout: 60000 });
  if (!r.ok) { const error = r.error || `API odpowiedziało kodem ${r.status}.`; log('error', 'research', `SAOS ${id}: ${error}`); return { status: 'blad', error }; }
  const d = r.body.data || r.body, html = d.textContent;
  if (!html) return { status: 'blad', error: 'Brak treści orzeczenia w odpowiedzi API.' };
  const sig = (d.courtCases || []).map(c => c.caseNumber).filter(Boolean).join(', ') || `SAOS ${id}`;
  const court = (d.division && d.division.court && d.division.court.name) || COURT[d.courtType] || d.courtType || '';
  const read = await readFile(new File([/<[a-z][\s\S]*>/i.test(html) ? html : `<pre>${html}</pre>`], `${sig}.html`, { type: 'text/html' }));
  const doc = await addDoc({ ...read, name: `Orzeczenie ${sig}${d.judgmentDate ? ' z ' + d.judgmentDate : ''}`.slice(0, 180), sourceUrl: saosUrl(id), tags,
    description: description || [court, d.judgmentType && d.judgmentType.toLowerCase(), d.judgmentDate, 'źródło: SAOS'].filter(Boolean).join(' · ') });
  return { status: 'dodano', title: sig, doc };
}
