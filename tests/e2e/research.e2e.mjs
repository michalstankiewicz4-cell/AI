// Test zakładki Research na podstawionych serwisach (bez sieci): strona www z linkami do dokumentów,
// API ELI Sejmu z listą aktów, serwis bez zgody CORS; „czy już pobrany”, wykrywanie duplikatu przy wgrywaniu.
//   node tests/e2e/research.e2e.mjs   (PLAYWRIGHT=…, CHROME=… jak w panel.e2e.mjs)

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
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
ok((await p.textContent('details.catalog summary')).includes('(14)'), 'katalog: 14 znanych źródeł (własne źródło ELI ma inny filtr niż katalogowe)');
await p.route(/https:\/\/www\.saos\.org\.pl\/api\/search\/judgments.*/, r => r.fulfill({ headers: CORS, json: { items: [
  { id: 1, courtCases: [{ caseNumber: 'I C 1/26' }], judgmentDate: '2026-11-10' }, { id: 2, courtCases: [{ caseNumber: 'II K 2/26' }], judgmentDate: '2026-11-09' }], info: { totalResults: 450000 } } }));
await p.click('details.catalog summary');
await p.click('.catrow:has-text("SAOS") >> text=Dodaj'); await p.waitForTimeout(400);
ok((await p.textContent('details.catalog summary')).includes('(13)') && (await p.textContent('main.content')).includes('SAOS – orzeczenia sądów (API)'), 'SAOS dodany z katalogu, znika z katalogu');
const saos = 'article.source:has-text("SAOS")';
await p.click(saos + ' >> text=Sprawdź'); await p.waitForSelector(saos + ' >> text=Orzeczenia (SAOS)'); await p.waitForTimeout(300);
t = await p.textContent(saos);
ok(t.includes('działa') && t.includes('Orzeczeń w odpowiedzi: 2') && t.includes('450') && t.includes('I C 1/26') && t.includes('Pobierz wszystkie nowe orzeczenia (2)'), 'API SAOS: działa, 2 orzeczenia z 450 000, sygnatury, pobieranie');
await p.click('details.catalog summary'); await p.click('text=/Dodaj wszystkie \\(13\\)/'); await p.waitForTimeout(600);
ok(!(await p.$('details.catalog')), 'Dodaj wszystkie: katalog pusty');
ok(await p.evaluate(async () => (await (await import('./js/core/db.js')).db.count('sources'))) === 17, 'źródeł razem: 3 własne + 14 z katalogu');
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
console.log('Pakiety tematyczne (prawo pracy)');
await p.route(/https:\/\/api\.sejm\.gov\.pl\/eli\/acts\/DU\/(19|20)\d\d\/\d+(\/text\.(html|pdf))?$/, r => {
  const u = r.request().url(), m = u.match(/acts\/(DU\/\d+\/\d+)(\/text\.(html|pdf))?$/), eli = m[1];
  if (eli === 'DU/2024/288') return r.fulfill({ status: 404, headers: CORS, body: 'nie ma' });
  const title = eli === 'DU/2026/474' ? 'Rozporządzenie w sprawie czegoś zupełnie innego' : ({ 'DU/2026/1245': 'Obwieszczenie w sprawie ogłoszenia jednolitego tekstu ustawy – Kodeks pracy', 'DU/1997/14': 'Rozporządzenie w sprawie szczegółowych zasad udzielania urlopu wypoczynkowego' }[eli] || 'Akt o: świadectwa pracy niedotyczących pracowników minimalnym wynagrodzeniu minimalnego wynagrodzenia choroby i macierzyństwa związkach zawodowych układach zbiorowych Inspekcji Pracy');
  if (!m[2]) return r.fulfill({ headers: CORS, json: { ELI: eli, title, textHTML: true, changeDate: '2026-09-01T10:00:00' } });
  return r.fulfill({ headers: CORS, contentType: 'text/html', body: `<html><body><h1>${title}</h1><p>Art. 1. Przepis testowy aktu ${eli}. Pracownik ma prawo do urlopu.</p><p>Art. 2. Drugi przepis.</p></body></html>` });
});
await p.route(/https:\/\/pl\.wikipedia\.org\/w\/api\.php.*/, r => {
  const t = new URL(r.request().url()).searchParams.get('titles'); if (!t) return r.fallback();
  if (t === 'Strajk') return r.fulfill({ headers: CORS, json: { query: { pages: { '-1': { title: t, missing: '' } } } } });
  return r.fulfill({ headers: CORS, json: { query: { pages: { 7: { title: t, fullurl: 'https://pl.wikipedia.org/wiki/' + encodeURIComponent(t.replace(/ /g, '_')), extract: `${t} – zwykły tekst o prawie pracy. `.repeat(20) + '\n\n== Historia ==\nDawniej było inaczej.' } } } } });
});
await p.goto(BASE + '#research'); await p.waitForSelector('section.pack');
const pack = 'section.pack:has-text("Prawo pracy")';
t = await p.textContent(pack);
ok(t.includes('12 aktów') && t.includes('32 haseł Wikipedii') && t.includes('Brakuje: źródeł 2'), 'pakiet: liczby, brakuje 2 źródeł (ZUS już dodany z katalogu)');
await p.click(pack + ' >> text=/Dodaj źródła pakietu/'); await p.waitForTimeout(500);
ok(await p.evaluate(async () => (await (await import('./js/core/db.js')).db.count('sources'))) === 19 && (await p.textContent(pack)).includes('Brakuje: źródeł 0'), 'pakiet: dodano 2 źródła, brak duplikatów');
await p.click(pack + ' >> text=/Pobierz akty pakietu \\(12\\)/'); await p.waitForSelector(pack + ' >> text=/Akty prawne: gotowe/', { timeout: 60000 });
t = await p.textContent(pack);
ok(t.includes('dodano: 10') && t.includes('pominięto – inny tytuł niż w pakiecie: 1') && t.includes('błąd: 1'), 'pakiet: 10 aktów dodanych, 1 pominięty (inny tytuł), 1 błąd');
await p.click(pack + ' >> text=/Pobierz hasła Wikipedii \\(32\\)/'); await p.waitForSelector(pack + ' >> text=/Hasła Wikipedii: gotowe/', { timeout: 60000 });
t = await p.textContent(pack);
ok(t.includes('dodano: 31') && t.includes('brak takiego artykułu: 1'), 'pakiet: 31 haseł Wikipedii, 1 brakujące');
const pk = await p.evaluate(async () => { const l = await (await import('./js/core/documents.js')).listDocs();
  return { acts: l.filter(d => /Pakiet: Prawo pracy/.test(d.description) && d.eli), wiki: l.filter(d => /Pakiet: Prawo pracy/.test(d.description) && /^Wikipedia/.test(d.name)) }; });
ok(pk.acts.length === 10 && pk.acts.every(d => !d.general && d.eli && d.sourceChangeDate) && pk.wiki.length === 31 && pk.wiki.every(d => d.general && d.description.includes('CC BY-SA')), 'pakiet: akty prawnicze z ELI, Wikipedia jako ogólne z licencją');
ok((await p.textContent(pack)).includes('Brakuje: źródeł 0, aktów 2, haseł Wikipedii 1'), 'pakiet: licznik „Brakuje” odświeżony po pobraniu');
await p.goto(BASE + '#pulpit'); await p.waitForTimeout(300); await p.goto(BASE + '#research'); await p.waitForSelector('section.pack');
ok((await p.textContent(pack)).includes('Brakuje: źródeł 0, aktów 2, haseł Wikipedii 1'), 'pakiet: po ponownym otwarciu brakuje tylko tego, czego nie udało się pobrać');
await p.screenshot({ path: join(OUT, 'pakiet.png'), fullPage: true });
console.log('Kategorie, nieaktualny, pytania, teksty jednolite, własny pakiet, SAOS, plik z danymi');
const eliSrc = 'article.source:has-text("Dziennik Ustaw (ELI)")';
await p.goto(BASE + '#pulpit'); await p.goto(BASE + '#research'); await p.waitForSelector(eliSrc);
if (!(await p.isVisible(eliSrc + ' >> text=/Zmienione/'))) await p.click(eliSrc + ' >> summary:has-text("Akty prawne")');
await p.click(eliSrc + ' >> label:has-text("Zmienione")');
await p.click(eliSrc + ' >> text=Pobierz nową wersję'); await p.waitForTimeout(1500);
let tagsOf = await p.evaluate(async () => (await (await import('./js/core/documents.js')).listDocs()).filter(d => d.eli === 'DU/2025/10').map(d => d.tags));
ok(tagsOf.length === 2 && tagsOf.filter(x => x.includes('nieaktualny')).length === 1, 'nowa wersja aktu: starsza dostaje plakietkę „nieaktualny”');
await p.goto(BASE + '#dokumenty'); await p.waitForSelector('.tagfilter');
t = await p.textContent('.tagfilter');
ok(t.includes('Prawo pracy (41)') && t.includes('Wikipedia') && t.includes('akt prawny') && t.includes('nieaktualny (1)'), 'filtr kategorii z liczbami (Prawo pracy, Wikipedia, akt prawny, nieaktualny)');
await p.click('.tagfilter >> text=/^Prawo pracy/'); await p.waitForTimeout(400);
ok((await p.$$('article.docrow')).length === 41, 'filtr „Prawo pracy”: 41 dokumentów');
await p.click('.tagfilter >> text=/^akt prawny/'); await p.waitForTimeout(400);
ok((await p.$$('article.docrow')).length === 10, 'dwie kategorie naraz: Prawo pracy + akt prawny = 10');
await p.fill('article.docrow >> nth=0 >> input.taginput', 'do przejrzenia'); await p.press('article.docrow >> nth=0 >> input.taginput', 'Enter'); await p.waitForTimeout(400);
ok((await p.textContent('.tagfilter')).includes('do przejrzenia (1)'), 'ręcznie dodana kategoria pojawia się w filtrze');
await p.screenshot({ path: join(OUT, 'kategorie.png') });
await p.goto(BASE + '#formatowanie'); await p.waitForSelector('.tagfilter');
await p.click('label:has-text("Wszystkie") input'); await p.click('.tagfilter >> text=/^Wikipedia/'); await p.waitForTimeout(300);
ok((await p.$$('article.doc')).length >= 31 && (await p.$$('article.doc')).length === (await p.$$('article.doc:has(.tag:text("Wikipedia"))')).length, 'Formatowanie: filtr kategorii, plakietki przy dokumentach');

// pytania z pakietu
await p.goto(BASE + '#research'); await p.waitForSelector('section.pack');
await p.click(pack + ' >> text=/Dodaj pytania do rozmów wzorcowych \\(20\\)/'); await p.waitForTimeout(500);
await p.goto(BASE + '#rozmowy-wzorcowe'); await p.waitForTimeout(500);
ok((await p.textContent('main.content')).includes('Do uzupełnienia (pytania z pakietów bez odpowiedzi): 20'), 'pytania pakietu: 20 szkieletów do uzupełnienia');
ok(await p.evaluate(async () => (await (await import('./js/core/dialogs.js')).trainingDialogs()).length) === 0, 'szkielety nie idą do dostrajania');
await p.click('text=Uzupełnij >> nth=0'); await p.waitForSelector('dialog.modal textarea');
const tas = await p.$$('dialog.modal textarea'); await tas[tas.length - 1].fill('Zależy od stażu pracy: 20 dni przy stażu krótszym niż 10 lat, 26 dni przy co najmniej 10 latach (art. 154 Kodeksu pracy).');
await p.click('dialog.modal >> text=Zapisz'); await p.waitForTimeout(400);
ok(await p.evaluate(async () => (await (await import('./js/core/dialogs.js')).trainingDialogs()).length) === 1 && (await p.textContent('main.content')).includes('pakietów bez odpowiedzi): 19'), 'uzupełniona rozmowa trafia do dostrajania');

// nowsze teksty jednolite
await p.route(/https:\/\/api\.sejm\.gov\.pl\/eli\/acts\/DU\/(19|20)\d\d$/, r => {
  const y = +r.request().url().slice(-4);
  return r.fulfill({ headers: CORS, json: y === 2026 ? [{ ELI: 'DU/2026/1999', pos: 1999, title: 'Obwieszczenie Marszałka Sejmu w sprawie ogłoszenia jednolitego tekstu ustawy - Kodeks pracy', changeDate: '2026-11-10T10:00:00' }, { ELI: 'DU/2026/1000', pos: 1000, title: 'Obwieszczenie w sprawie ogłoszenia jednolitego tekstu ustawy – Kodeks pracy', changeDate: null }] : [] });
});
await p.goto(BASE + '#pulpit'); await p.goto(BASE + '#research'); await p.waitForSelector('section.pack');
await p.click(pack + ' >> text=Sprawdź nowe teksty jednolite'); await p.waitForSelector(pack + ' >> text=/Nowsze teksty jednolite: 1/', { timeout: 30000 });
ok((await p.textContent(pack)).includes('DU/2026/1999'), 'wykryto nowszy tekst jednolity Kodeksu pracy (DU/2026/1999, nie starszy 1000)');
await p.click(pack + ' >> text=Pobierz i podmień w pakiecie'); await p.waitForSelector(pack + ' >> text=/podmieniono w pakiecie/');
const kp = await p.evaluate(async () => { const l = await (await import('./js/core/documents.js')).listDocs(); const pk = await (await import('./js/core/packs.js')).packById('prawo-pracy');
  return { old: l.find(d => d.eli === 'DU/2026/1245').tags, neu: l.find(d => d.eli === 'DU/2026/1999').tags, pack: pk.acts[0].eli, edited: pk.edited }; });
ok(kp.old.includes('nieaktualny') && kp.neu.includes('Prawo pracy') && kp.pack === 'DU/2026/1999' && kp.edited, 'podmiana: nowy tekst w pakiecie, stary „nieaktualny”');

// własny pakiet + plik pakietu
await p.goto(BASE + '#pulpit'); await p.goto(BASE + '#research'); await p.waitForSelector('section.pack');
ok((await p.textContent(pack)).includes('wbudowany, zmieniony'), 'zmieniony wbudowany pakiet oznaczony');
await p.click('text=Nowy pakiet'); await p.waitForSelector('dialog.modal');
const mi = await p.$$('dialog.modal input[type=text]'); await mi[0].fill('Ochrona danych');
const mt = await p.$$('dialog.modal textarea'); await mt[1].fill('DU/2019/1781 | ochronie danych | ustawa o ochronie danych osobowych'); await mt[2].fill('Ogólne rozporządzenie o ochronie danych'); await mt[3].fill('Czy szef może sprawdzać moją pocztę?');
await p.click('dialog.modal >> text=Zapisz pakiet'); await p.waitForSelector('section.pack:has-text("Ochrona danych")');
const own = 'section.pack:has-text("Ochrona danych")';
ok((await p.textContent(own)).includes('własny') && (await p.textContent(own)).includes('1 aktów'), 'własny pakiet zapisany');
const dlp = p.waitForEvent('download'); await p.click(own + ' >> text=Zapisz pakiet do pliku');
const packFile = join(OUT, 'pakiet.json'); await (await dlp).saveAs(packFile);
ok(JSON.parse(readFileSync(packFile, 'utf8')).format === 'ai-prawo-pakiet', 'pakiet zapisany do pliku');
await p.click(own + ' >> text=Usuń pakiet'); await p.click('dialog >> text=Usuń'); await p.waitForTimeout(500);
ok(!(await p.$(own)), 'własny pakiet usunięty');
const fcp = p.waitForEvent('filechooser'); await p.click('text=Wczytaj pakiet z pliku'); (await fcp).setFiles(packFile); await p.waitForSelector(own);
ok(true, 'pakiet wczytany z pliku');

// SAOS: pełne orzeczenia
await p.route(/https:\/\/www\.saos\.org\.pl\/api\/judgments\/\d+$/, r => { const id = r.request().url().split('/').pop();
  return r.fulfill({ headers: CORS, json: { data: { id: +id, courtType: 'COMMON', courtCases: [{ caseNumber: `IV P ${id}/26` }], judgmentType: 'SENTENCE', judgmentDate: '2026-11-0' + id, division: { court: { name: 'Sąd Rejonowy w Testowie' } }, textContent: `<h2>WYROK</h2><p>Sąd Rejonowy w Testowie, Wydział Pracy, po rozpoznaniu sprawy z powództwa pracownika o przywrócenie do pracy (${id}) orzeka: przywraca powoda do pracy.</p>` } } }); });
const saosPk = 'article.source:has-text("orzeczenia powołujące Kodeks pracy")';
await p.click(saosPk + ' >> text=Sprawdź'); await p.waitForSelector(saosPk + ' >> text=/Pobierz wszystkie nowe orzeczenia \\(2\\)/');
await p.click(saosPk + ' >> text=/Pobierz wszystkie nowe orzeczenia/'); await p.waitForTimeout(1500);
const ors = await p.evaluate(async () => (await (await import('./js/core/documents.js')).listDocs()).filter(d => /saos\.org\.pl\/judgments/.test(d.sourceUrl)));
ok(ors.length === 2 && ors.every(d => d.tags.includes('orzeczenie') && d.tags.includes('Prawo pracy') && d.raw.includes('przywraca powoda') && /IV P \d\/26/.test(d.name)), 'SAOS: 2 pełne orzeczenia w bibliotece, kategorie orzeczenie + Prawo pracy');

// plik z danymi: zapis i wczytanie
await p.goto(BASE + '#ustawienia'); await p.waitForSelector('text=Zapisz dane do pliku');
await p.click('text=Zapisz dane do pliku'); await p.waitForSelector('dialog.modal');
const dld = p.waitForEvent('download'); await p.click('dialog.modal >> text=Zapisz plik');
const dataFile = join(OUT, 'dane.json'); await (await dld).saveAs(dataFile);
const dj = JSON.parse(readFileSync(dataFile, 'utf8'));
const nDocs = await p.evaluate(async () => (await (await import('./js/core/db.js')).db.count('documents')));
ok(dj.format === 'ai-prawo-dane' && dj.documents.length === nDocs && dj.sources.length >= 19 && dj.packs.length >= 2 && !JSON.stringify(dj).includes('githubToken'), 'plik z danymi: dokumenty, źródła, pakiety, bez tokenu');
await p.evaluate(async () => { const { db } = await import('./js/core/db.js'); await db.clear('documents'); await db.clear('sources'); });
const fcd = p.waitForEvent('filechooser'); await p.click('text=Wczytaj dane z pliku'); (await fcd).setFiles(dataFile);
await p.waitForSelector('dialog.modal >> text=Wczytaj'); await p.click('dialog.modal button:text-is("Wczytaj")'); await p.waitForSelector('dialog.modal >> text=/Wczytano\./');
ok(await p.evaluate(async () => (await (await import('./js/core/db.js')).db.count('documents'))) === nDocs && await p.evaluate(async () => (await (await import('./js/core/db.js')).db.count('sources'))) >= 19, 'wczytanie pliku odtwarza dokumenty i źródła');

console.log('Profile');
await p.goto(BASE + '#pulpit'); await p.waitForSelector('.profilecard');
ok((await p.textContent('.profchip')).includes('Wszystkie profile'), 'bez profilu: „Wszystkie profile” w pasku');
await p.click('.profilecard >> text=Nowy profil'); await p.waitForSelector('dialog.modal');
await p.fill('dialog.modal input[type=text] >> nth=0', 'Prawo pracy');
await p.click('dialog.modal .tagbtn:text-is("Prawo pracy")');
await p.click('dialog.modal input[value=srednia]');
await p.click('dialog.modal >> text=Zapisz profil'); await p.waitForTimeout(800);
ok((await p.textContent('.profchip')).includes('Profil: Prawo pracy'), 'nowy profil wybrany, nazwa w pasku');
const st = await p.evaluate(async () => (await import('./js/core/settings.js')).settings().pretrain);
ok(st.layers === 6 && st.dim === 192, 'szablon „Średnia” w ustawieniach nauki profilu');
const allDocsN = await p.evaluate(async () => (await (await import('./js/core/db.js')).db.count('documents')));
await p.goto(BASE + '#dokumenty'); await p.waitForSelector('.scope');
t = await p.textContent('.scope');
ok(/pokazuję dokumenty profilu: \d+ z /.test(t) && (await p.$$('article.docrow')).length < allDocsN, 'Dokumenty: tylko dokumenty profilu');
await p.click('.scope >> text=Pokaż wszystko'); await p.waitForTimeout(300);
ok((await p.$$('article.docrow')).length === allDocsN, '„Pokaż wszystko”: cała biblioteka');
await p.evaluate(async () => { const m = await import('./js/core/documents.js'); await m.addDoc({ name: 'notatka', type: 'text', raw: 'Pracownik ma prawo do urlopu.' }); });
ok((await p.evaluate(async () => (await (await import('./js/core/documents.js')).listDocs()).find(d => d.name === 'notatka').tags)).includes('Prawo pracy'), 'nowy dokument dostaje kategorię profilu');
await p.goto(BASE + '#nauka'); await p.waitForTimeout(600);
ok((await p.textContent('main.content')).includes('Profil: Prawo pracy'), 'Nauka: informacja o profilu');
await p.goto(BASE + '#pulpit'); await p.waitForSelector('.profilecard select');
await p.selectOption('.profilecard select', ''); await p.waitForTimeout(800);
const st2 = await p.evaluate(async () => (await import('./js/core/settings.js')).settings().pretrain);
ok((await p.textContent('.profchip')).includes('Wszystkie profile') && st2.layers !== 6, 'powrót do „Wszystkich profili” przywraca poprzednie ustawienia');
await p.screenshot({ path: join(OUT, 'profile.png') });

console.log('Logi');
await p.goto(BASE + '#logi'); await p.waitForSelector('.logrow');
t = await p.textContent('main.content');
ok((await p.$$('.logrow.lv-warn')).length >= 1 && t.includes('Zamknięty serwis') && t.includes('niedostępne / CORS'), 'Logi: ostrzeżenie o niedostępnym źródle (złote)');
ok((await p.$$('.logrow.lv-info')).length >= 5 && t.includes('Uruchomienie panelu') && t.includes('Dodano dokument'), 'Logi: informacje (start panelu, dokumenty)');
ok(!(await p.$('.logrow.lv-debug')), 'Logi: szczegóły domyślnie ukryte');
await p.click('.logchip.lv-debug input'); await p.waitForTimeout(200);
ok((await p.$$('.logrow.lv-debug')).length >= 1, 'Logi: po zaznaczeniu „Szczegóły” widać szczegóły');
await p.fill('input[aria-label="Szukaj w logach"]', 'Wikipedia: pobrano'); await p.waitForTimeout(200);
ok((await p.$$('.logrow')).length === 1, 'Logi: wyszukiwanie');
await p.fill('input[aria-label="Szukaj w logach"]', '');
await p.evaluate(() => Promise.reject(new Error('test nieobsłużonego błędu'))).catch(() => {});
await p.evaluate(() => { setTimeout(() => Promise.reject(new Error('próbny błąd w tle')), 0); }); await p.waitForTimeout(400);
ok((await p.textContent('.loglist')).includes('próbny błąd w tle') && (await p.$$('.logrow.lv-error')).length >= 1, 'Logi: nieobsłużony błąd strony zapisany na czerwono, na żywo');
await p.screenshot({ path: join(OUT, 'logi.png'), fullPage: true });
errs.splice(0, errs.length, ...errs.filter(e => !e.includes('próbny błąd w tle') && !e.includes('test nieobsłużonego')));
ok(!errs.length, 'brak błędów strony' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close(); server.close();
console.log(fails ? `\n${fails} błędów` : '\nwszystko w porządku'); process.exit(fails ? 1 : 0);
