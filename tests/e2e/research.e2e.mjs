// Test zakładki Research na podstawionych serwisach (bez sieci): strona www z linkami do dokumentów,
// API ELI Sejmu z listą aktów, serwis bez zgody CORS; „czy już pobrany”, wykrywanie duplikatu przy wgrywaniu.
//   node tests/e2e/research.e2e.mjs   (PLAYWRIGHT=…, CHROME=… jak w panel.e2e.mjs)

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url)), OUT = join(ROOT, 'tests/e2e/out');
await mkdir(OUT, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '') || 'index.html';
  try { const b = await readFile(join(ROOT, p)); res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

const CORS = { 'Access-Control-Allow-Origin': '*' };
const ACT = n => `<html><body><main><h1>Ustawa nr ${n}</h1><p>Art. 1. § 1. Przepis testowy numer ${n} dotyczy przedawnienia roszczeń majątkowych.</p><p>Art. 2. Ustawa wchodzi w życie po upływie 14 dni od dnia ogłoszenia.</p></main></body></html>`;
let pageVersion = 1;
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1360, height: 950 } }); const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('dialog', d => d.accept());
// strona sądu: lista dokumentów (druga wersja strony ma jeden dokument więcej)
await p.route('https://sad.test/orzeczenia', r => r.fulfill({ headers: CORS, contentType: 'text/html', body: `<ul><li><a href="/doc/1.html">Wyrok 1</a></li><li><a href="/doc/2.html">Wyrok 2</a></li>${pageVersion > 1 ? '<li><a href="/doc/3.html">Wyrok 3</a></li>' : ''}<li><a href="/o-nas">O nas</a></li></ul>` }));
await p.route(/https:\/\/sad\.test\/doc\/(\d)\.html/, r => r.fulfill({ headers: CORS, contentType: 'text/html', body: ACT('S' + r.request().url().match(/(\d)\.html/)[1]) }));
// API ELI: lista aktów i tekst HTML
await p.route('https://api.sejm.gov.pl/eli/acts/DU/2025', r => r.fulfill({ headers: CORS, json: { count: 3, items: [
  { ELI: 'DU/2025/10', title: 'Ustawa o zmianie ustawy – Kodeks cywilny', changeDate: '2025-02-01T10:00:00', textHTML: true },
  { ELI: 'DU/2025/11', title: 'Rozporządzenie w sprawie opłat', changeDate: '2025-02-02T10:00:00', textHTML: true },
  { ELI: 'DU/2025/12', title: 'Kodeks postępowania cywilnego – tekst jednolity', changeDate: '2025-03-01T10:00:00', textHTML: true }] } }));
await p.route(/api\.sejm\.gov\.pl\/eli\/acts\/DU\/2025\/(\d+)\/text\.html/, r => r.fulfill({ headers: CORS, contentType: 'text/html', body: ACT('ELI-' + r.request().url().match(/2025\/(\d+)/)[1]) }));
// serwis bez zgody CORS: w przeglądarce kończy się tym samym błędem fetch co brak połączenia; odpowiedzi podstawione
// przez Playwright omijają blokadę CORS, więc symulujemy ją zerwaniem połączenia
await p.route('https://zamkniety.test/', r => r.abort('failed'));

await p.goto(BASE + '#research'); await p.waitForTimeout(600);
ok((await p.textContent('nav.side')).match(/Pulpit\s*🔎?\s*Research\s*📄?\s*Dokumenty/) !== null || (await p.$$eval('nav.side a', as => as.map(a => a.dataset.id))).join(',').startsWith('pulpit,research,dokumenty'), 'Research w menu między Pulpitem a Dokumentami');

const addSource = async (name, url, kind, extra = {}) => {
  await p.click('text=Dodaj źródło'); await p.waitForSelector('dialog.modal');
  const inputs = await p.$$('dialog.modal input[type=text]');
  if (kind === 'eli') await p.selectOption('dialog.modal select >> nth=0', 'eli');
  await inputs[0].fill(name); await inputs[1].fill(url);
  if (extra.years) await (await p.$$('dialog.modal input[type=text]'))[3].fill(extra.years);
  if (extra.filter != null) await (await p.$$('dialog.modal input[type=text]'))[4].fill(extra.filter);
  await p.click('dialog.modal >> text=Zapisz'); await p.waitForTimeout(300);
};
console.log('Strona www');
await addSource('Sąd testowy', 'https://sad.test/orzeczenia', 'www');
await p.click('article.source >> nth=0 >> text=Sprawdź'); await p.waitForSelector('article.source >> text=Dokumenty na stronie');
let t = await p.textContent('article.source >> nth=0');
ok(t.includes('działa') && t.includes('nowe: 2') && !t.includes('o-nas'), 'strona działa, 2 nowe dokumenty, link bez dokumentu pominięty');
await p.click('article.source >> nth=0 >> text=/Pobierz wszystkie nowe/'); await p.waitForTimeout(1500);
ok(await p.evaluate(async () => (await (await import('./js/core/db.js')).db.count('documents'))) === 2, 'pobrano 2 dokumenty do biblioteki');
pageVersion = 2;
await p.click('article.source >> nth=0 >> text=Sprawdź'); await p.waitForTimeout(800);
t = await p.textContent('article.source >> nth=0');
ok(t.includes('są zmiany od poprzedniego sprawdzenia') && t.includes('nowe: 1') && t.includes('już pobrane: 2'), 'zmiana strony wykryta: 1 nowy, 2 już pobrane');
await p.screenshot({ path: join(OUT, 'research-www.png') });

console.log('API ELI');
await addSource('Dziennik Ustaw (ELI)', 'https://api.sejm.gov.pl/eli', 'eli', { years: '2025', filter: 'kodeks' });
await p.click('article.source >> nth=1 >> text=Sprawdź'); await p.waitForSelector('article.source >> nth=1 >> text=Akty prawne');
t = await p.textContent('article.source >> nth=1');
ok(t.includes('3 akty') && t.includes('pasujących do filtra: 2') && t.includes('nowe: 2'), 'API: 3 akty, filtr „kodeks” → 2 nowe');
await p.click('article.source >> nth=1 >> button:text-is("Pobierz") >> nth=0'); await p.waitForTimeout(1200);
const eliDoc = await p.evaluate(async () => (await (await import('./js/core/db.js')).db.all('documents')).find(d => d.eli));
ok(eliDoc && eliDoc.eli === 'DU/2025/10' && eliDoc.sourceChangeDate === '2025-02-01T10:00:00' && eliDoc.raw.includes('ELI-10'), 'akt pobrany z identyfikatorem ELI i datą zmiany');
await p.route('https://api.sejm.gov.pl/eli/acts/DU/2025', r => r.fulfill({ headers: CORS, json: { items: [{ ELI: 'DU/2025/10', title: 'Ustawa o zmianie ustawy – Kodeks cywilny', changeDate: '2025-06-01T10:00:00', textHTML: true }] } }));
await p.click('article.source >> nth=1 >> text=Sprawdź'); await p.waitForTimeout(800);
t = await p.textContent('article.source >> nth=1');
ok(t.includes('zmienione od pobrania: 1') && t.includes('Pobierz nową wersję'), 'zmiana aktu w API wykryta (changeDate)');
await p.screenshot({ path: join(OUT, 'research-eli.png') });

console.log('CORS, czy już pobrany, duplikat');
await addSource('Zamknięty serwis', 'https://zamkniety.test/', 'www');
await p.click('article.source >> nth=2 >> text=Sprawdź'); await p.waitForTimeout(800);
const cors = await p.textContent('article.source >> nth=2'); ok(cors.includes('niedostępne / CORS'), 'serwis bez zgody CORS rozpoznany' + (cors.includes('niedostępne') ? '' : ' — panel pokazał: ' + cors.slice(0, 200)));
await p.fill('input[aria-label="Adres dokumentu"]', 'https://sad.test/doc/1.html'); await p.click('text=Sprawdź adres'); await p.waitForSelector('.urlout >> text=/Już pobrany|Nie ma/');
ok((await p.textContent('.urlout')).includes('Już pobrany') && (await p.textContent('.urlout')).includes('adres'), 'adres już pobranego dokumentu rozpoznany');
await p.route('https://kopia.test/wyrok.html', r => r.fulfill({ headers: CORS, contentType: 'text/html', body: ACT('S1') }));
await p.fill('input[aria-label="Adres dokumentu"]', 'https://kopia.test/wyrok.html'); await p.click('text=Sprawdź adres'); await p.waitForSelector('.urlout >> text=/Już pobrany|Nie ma/');
ok((await p.textContent('.urlout')).includes('treść'), 'ten sam dokument pod innym adresem rozpoznany po treści');
await writeFile(join(OUT, 'dup.html'), ACT('S2'));
await p.goto(BASE + '#dokumenty'); await p.waitForTimeout(500);
let asked = '';
p.removeAllListeners('dialog');
const fc = p.waitForEvent('filechooser'); await p.click('text=Wgraj pliki'); (await fc).setFiles(join(OUT, 'dup.html'));
await p.waitForSelector('dialog.modal >> text=Ten dokument już jest'); asked = await p.textContent('dialog.modal');
ok(asked.includes('taką samą treść'), 'przy wgrywaniu: ostrzeżenie o duplikacie');
await p.click('dialog.modal >> text=Anuluj'); await p.waitForTimeout(300);

console.log('Znane źródła i API (JSON)');
await p.goto(BASE + '#research'); await p.waitForTimeout(600);
ok((await p.textContent('details.catalog summary')).includes('(13)'), 'katalog: 13 znanych źródeł (Dziennik Ustaw już jest na liście)');
await p.route(/https:\/\/www\.saos\.org\.pl\/api\/search\/judgments.*/, r => r.fulfill({ headers: CORS, json: { items: [
  { id: 1, courtCases: [{ caseNumber: 'I C 1/26' }], judgmentDate: '2026-11-10' }, { id: 2, courtCases: [{ caseNumber: 'II K 2/26' }], judgmentDate: '2026-11-09' }], info: { totalResults: 450000 } } }));
await p.click('details.catalog summary');
await p.click('.catrow:has-text("SAOS") >> text=Dodaj'); await p.waitForTimeout(400);
ok((await p.textContent('details.catalog summary')).includes('(12)') && (await p.textContent('main.content')).includes('SAOS – orzeczenia sądów (API)'), 'SAOS dodany z katalogu, znika z katalogu');
const saos = 'article.source:has-text("SAOS")';
await p.click(saos + ' >> text=Sprawdź'); await p.waitForSelector(saos + ' >> text=Odpowiedź API');
t = await p.textContent(saos);
ok(t.includes('działa') && t.includes('2 pozycji') && t.includes('450') && t.includes('I C 1/26'), 'API (JSON): działa, 2 pozycje z 450 000, sygnatury widoczne');
await p.click('details.catalog summary'); await p.click('text=/Dodaj wszystkie \\(12\\)/'); await p.waitForTimeout(600);
ok(!(await p.$('details.catalog')), 'Dodaj wszystkie: katalog pusty');
ok(await p.evaluate(async () => (await (await import('./js/core/db.js')).db.count('sources'))) === 16, 'źródeł razem: 3 własne + 13 z katalogu');
await p.screenshot({ path: join(OUT, 'research-katalog.png'), fullPage: true });

console.log('Tekst ogólny: stenogramy Sejmu, Wikipedia, udział w nauce');
await p.route(/https:\/\/api\.sejm\.gov\.pl\/sejm\/term10\/proceedings$/, r => r.fulfill({ headers: CORS, json: [
  { number: 0, title: 'Zgromadzenie', dates: ['2024-01-01'] }, { number: 5, title: '5. Posiedzenie Sejmu', dates: ['2024-02-01', '2024-02-02'] }, { number: 99, title: 'Przyszłe', dates: ['2099-01-01'] }] }));
await p.route(/proceedings\/5\/(.+)\/transcripts\/pdf/, r => r.fulfill({ headers: CORS, contentType: 'text/plain', body: 'Marszałek: Otwieram posiedzenie Sejmu. Poseł: Wysoka Izbo, ustawa o ochronie lokatorów wymaga zmian, bo ludzie nie rozumieją przepisów.\n'.repeat(5) + r.request().url() }));
let wikiN = 0;
await p.route(/https:\/\/pl\.wikipedia\.org\/w\/api\.php.*/, r => {
  const u = new URL(r.request().url());
  if (u.searchParams.get('meta') === 'siteinfo') return r.fulfill({ headers: CORS, json: { query: { statistics: { articles: 1700000 } } } });
  const i = ++wikiN, short = i === 2;
  return r.fulfill({ headers: CORS, json: { query: { pages: { [i]: { title: 'Artykuł ' + i, fullurl: 'https://pl.wikipedia.org/wiki/Artyku%C5%82_' + i,
    extract: short ? 'Krótki zalążek.' : `\n\n== Historia ==\nTo jest zwykły polski tekst numer ${i} o rzece, mieście i ludziach. `.repeat(60) } } } } });
});
const steno = 'article.source:has-text("stenogramy posiedzeń")';
ok((await p.textContent(steno)).includes('ogólny'), 'źródło stenogramów oznaczone jako ogólne');
await p.click(steno + ' >> text=Sprawdź'); await p.waitForSelector(steno + ' >> text=/Stenogramy \\(najnowsze/');
t = await p.textContent(steno);
ok(t.includes('2024-02-02') && t.includes('2024-02-01') && !t.includes('2099') && !t.includes('Zgromadzenie'), 'stenogramy: dni posiedzeń, które już były (bez przyszłych i posiedzenia 0)');
await p.click(steno + ' >> text=/Pobierz wszystkie nowe/'); await p.waitForTimeout(1500);
let docsNow = await p.evaluate(async () => (await (await import('./js/core/documents.js')).listDocs()).filter(d => /Stenogram Sejmu/.test(d.name)).map(d => d.general));
ok(docsNow.length === 2 && docsNow.every(Boolean), 'pobrano 2 stenogramy jako tekst ogólny');
const wiki = 'article.source:has-text("Wikipedia (pl)")';
await p.click(wiki + ' >> text=Sprawdź'); await p.waitForSelector(wiki + ' >> text=Pobierz losowe artykuły');
ok((await p.textContent(wiki)).includes('1 700 000') || (await p.textContent(wiki)).includes('1\u00a0700\u00a0000'), 'Wikipedia: API działa, liczba artykułów');
await p.selectOption(wiki + ' select', '5'); await p.click(wiki + ' >> text=Pobierz losowe artykuły'); await p.waitForSelector(wiki + ' >> text=/Dodano 5 artykułów/');
docsNow = await p.evaluate(async () => (await (await import('./js/core/documents.js')).listDocs()).filter(d => /^Wikipedia – /.test(d.name)));
ok(docsNow.length === 5 && docsNow.every(d => d.general && d.description.includes('CC BY-SA') && !d.raw.includes('==')), 'Wikipedia: 5 artykułów (zalążek pominięty), ogólne, z licencją, bez znaczników nagłówków');
await p.evaluate(async () => { const m = await import('./js/core/documents.js'); for (const d of await m.listDocs()) await m.setStatus(d, 'zatwierdzony'); });
await p.goto(BASE + '#dokumenty'); await p.waitForTimeout(600);
ok((await p.$$('.docrow .badge.gen')).length === 7, 'Dokumenty: plakietka „ogólny” przy 7 dokumentach');
await p.goto(BASE + '#nauka'); await p.waitForTimeout(800);
t = await p.textContent('main.content');
ok(/Ogólne: w nauce [\d\s\u00a0]+ z [\d\s\u00a0]+ znaków \(\d+% tekstu, limit 20%/.test(t), 'Nauka: podział na prawnicze i ogólne, limit 20%');
await p.screenshot({ path: join(OUT, 'nauka-ogolny.png') });
ok(!errs.length, 'brak błędów strony' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close(); server.close();
console.log(fails ? `\n${fails} błędów` : '\nwszystko w porządku'); process.exit(fails ? 1 : 0);
