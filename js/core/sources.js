// Research: źródła dokumentów (strony www i API ELI Sejmu), sprawdzanie ich i pobieranie dokumentów do biblioteki.
//
// rekord źródła: { id, name, url, kind: 'www' | 'eli', description, addedAt,
//                  eli?: { publisher: 'DU'|'MP', years: '2024, 2025', filter: 'kodeks, ustawa' },
//                  last?: { at, ok, status, ms, cors, error, hash, changed, links?, acts? } }
//
// Ograniczenie przeglądarki (CORS): strona może pobrać plik z innego serwisu tylko wtedy, gdy ten serwis na to pozwala.
// Sprawdzanie rozróżnia: działa / serwis odpowiada błędem (kod HTTP) / brak zgody CORS albo brak połączenia.

import { db, uid } from './db.js';
import { listDocs, addDoc, findDuplicate, textHash } from './documents.js';
import { readFile } from '../reader/index.js';

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
  return docs.filter(d => (src.kind === 'eli' ? d.eli && d.eli.startsWith((src.eli || {}).publisher + '/') : false) || (host && hostOf(d.sourceUrl) === host));
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

export const checkSource = src => src.kind === 'eli' ? checkEli(src) : checkWeb(src);

// ---------- pobieranie do biblioteki ----------
const nameFromUrl = (u, type) => { const n = decodeURIComponent((u.split('?')[0].split('/').pop() || 'dokument')); return /\.\w{2,5}$/.test(n) ? n : n + (type.includes('pdf') ? '.pdf' : type.includes('html') ? '.html' : '.txt'); };

// Pobiera plik spod adresu, odczytuje (PDF/OCR/Word/HTML…) i dodaje do biblioteki z adresem źródła.
// Zwraca { doc } albo { duplicate } (gdy taki dokument już jest i nie wymuszono pobrania).
export async function downloadToLibrary(url, { name, description = '', eli = null, sourceChangeDate = null, force = false, onProgress } = {}) {
  if (!force) { const dup = await findDuplicate({ url, eli }); if (dup) return { duplicate: dup }; }
  const r = await probe(url, { as: 'blob', timeout: 60000 });
  if (!r.ok) throw new Error(r.error || `Serwis odpowiedział kodem ${r.status}.`);
  const file = new File([r.body], name || nameFromUrl(url, r.type), { type: r.type.split(';')[0] });
  const read = await readFile(file, onProgress);
  if (!force) { const dup = await findDuplicate({ raw: read.raw }); if (dup) return { duplicate: dup }; }
  const doc = await addDoc({ ...read, name: name || read.name, description, sourceUrl: url, eli, sourceChangeDate });
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
