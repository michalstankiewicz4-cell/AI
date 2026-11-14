// Test panelu w prawdziwej przeglądarce (Playwright + Chrome): cały cykl od wgrania dokumentu do rozmowy w czacie,
// Pomoc, dymki [?], podgląd budowy, publikacja (okno) i „Wczytaj z GitHub” (na podstawionych plikach).
//
//   npm i -D playwright            (raz)
//   node tests/e2e/panel.e2e.mjs   (CHROME=ścieżka do Chrome, jeśli Playwright nie ma własnej przeglądarki)
//
// Zrzuty ekranu trafiają do tests/e2e/out/ (folder pomijany przez git).

import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const ROOT = fileURLToPath(new URL('../../', import.meta.url)), OUT = join(ROOT, 'tests/e2e/out'), FIX = join(OUT, 'fixtures');
await mkdir(FIX, { recursive: true });

// ---------- dane testowe ----------
function fixtures() {
  let seed = 1; const rnd = a => a[Math.floor((seed = (seed * 16807) % 2147483647) / 2147483647 * a.length)];
  const subj = ['Sprzedawca', 'Kupujący', 'Wynajmujący', 'Najemca', 'Pracodawca', 'Dłużnik', 'Wierzyciel'];
  const verb = ['jest obowiązany', 'może', 'nie może', 'ma prawo'], obj = ['wydać rzecz w stanie wolnym od wad', 'zapłacić umówioną cenę', 'wypowiedzieć umowę z zachowaniem terminu', 'żądać naprawienia szkody', 'odstąpić od umowy w terminie 14 dni'];
  const L = ['Kodeks cywilny – wybrane przepisy', '©Kancelaria Sejmu'];
  for (let a = 1; a < 400; a++) {
    L.push(`Art. ${a}. § 1. ${rnd(subj)} ${rnd(verb)} ${rnd(obj)}, jeżeli przepis szcze-`, `gólny nie stanowi inaczej . § 2. Termin przedawnienia wynosi ${rnd(['trzy lata', 'sześć lat', 'dwa lata', 'rok'])}.`);
    if (a % 7 === 0) L.push('©Kancelaria Sejmu', `s. ${a / 7}/57`);
  }
  const qs = [['Ile wynosi termin przedawnienia?', 'Podstawowy termin przedawnienia wynosi sześć lat.'], ['Kto ma obowiązek wydać rzecz?', 'Sprzedawca jest obowiązany wydać rzecz w stanie wolnym od wad.'], ['Czy najemca może wypowiedzieć umowę?', 'Najemca może wypowiedzieć umowę z zachowaniem terminu.'], ['W jakim terminie można odstąpić od umowy?', 'Można odstąpić od umowy w terminie 14 dni.']];
  const D = Array.from({ length: 40 }, () => { const [q, a] = rnd(qs); return `Ty: ${q}\nAI: ${a}`; });
  D.push('AI: zła rozmowa bez pytania');
  // Windows-1250: sprawdza rozpoznawanie kodowania
  const cp = { 'ą': 0xb9, 'ć': 0xe6, 'ę': 0xea, 'ł': 0xb3, 'ń': 0xf1, 'ó': 0xf3, 'ś': 0x9c, 'ź': 0x9f, 'ż': 0xbf, 'Ą': 0xa5, 'Ć': 0xc6, 'Ę': 0xca, 'Ł': 0xa3, 'Ń': 0xd1, 'Ó': 0xd3, 'Ś': 0x8c, 'Ź': 0x8f, 'Ż': 0xaf, '–': 0x96, '©': 0xa9 };
  const txt = L.join('\n'), buf = Buffer.from([...txt].map(c => cp[c] ?? c.charCodeAt(0)));
  return { kodeks: buf, rozmowy: D.join('\n\n') + '\n' };
}
const fx = fixtures();
await writeFile(join(FIX, 'kodeks.txt'), fx.kodeks); await writeFile(join(FIX, 'rozmowy.txt'), fx.rozmowy);

// ---------- serwer statyczny ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '') || 'index.html';
  try { const b = await readFile(join(ROOT, p)); res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end(); }
}).listen(0);
const BASE = `http://localhost:${server.address().port}/`;

// ---------- test ----------
let fails = 0; const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--enable-unsafe-webgpu'] });
const p = await browser.newPage({ viewport: { width: 1360, height: 900 }, colorScheme: 'light' });
const errors = [];
p.on('pageerror', e => errors.push(e.message)); // 404 są oczekiwane: test „Wczytaj z GitHub” udaje brak części plików w repo
p.on('console', m => m.type() === 'error' && !/api\.github\.com|raw\.githubusercontent|status of 404/.test(m.text()) && errors.push(m.text()));
p.on('dialog', d => d.accept());
const shot = n => p.screenshot({ path: join(OUT, n + '.png') });
const file = async (button, path) => { const fc = p.waitForEvent('filechooser'); await p.click(button); (await fc).setFiles(path); };

console.log('Dokumenty i Formatowanie');
await p.goto(BASE + '#pulpit'); await p.waitForTimeout(800); await shot('01-pulpit');
await p.click('a[href="#dokumenty"]'); await file('text=Wgraj pliki', join(FIX, 'kodeks.txt'));
await p.waitForSelector('dialog.modal .statgrid');
const stats = await p.textContent('dialog.modal');
ok(/Wyrazy przeniesione do nowej linii\s*399/.test(stats) && /Numery stron, nagłówki i stopki\s*115/.test(stats), 'statystyki formatowania po wgraniu (zmiany według reguł)');
await shot('02a-statystyki'); await p.keyboard.press('Escape');
await p.waitForSelector('article.docrow');
ok((await p.textContent('article.docrow')).includes('windows-1250'), 'rozpoznane kodowanie Windows-1250');
await p.fill('textarea.desc', 'Testowy wyciąg z kodeksu'); await p.press('textarea.desc', 'Tab'); await p.waitForTimeout(300); await shot('02-dokumenty');
await p.click('article.docrow button.badge'); await p.waitForSelector('.panel-formatowanie article.doc'); await p.waitForTimeout(300); await shot('03-formatowanie');
const prev = await p.textContent('.panel-formatowanie pre.preview');
ok(!prev.includes('Kancelaria') && prev.includes('przewidzianych') === false && prev.includes('szczególny nie stanowi inaczej.'), 'formatowanie: stopki usunięte, przeniesienia sklejone');
await p.click('.panel-formatowanie >> text=Zatwierdź do nauki'); await p.waitForTimeout(300);
await p.click('.seg >> text=Wszystkie'); await p.click('.panel-formatowanie article.doc >> text=Formatuj ponownie'); await p.waitForSelector('dialog.modal section.cmp');
ok((await p.textContent('dialog.modal p.verdict')).startsWith('Bez efektu'), 'formatowanie ponowne bez zmian ustawień: werdykt „Bez efektu”');
await p.keyboard.press('Escape'); await p.waitForTimeout(200);
await p.click('.panel-formatowanie header .help'); await p.waitForTimeout(400);
ok((await p.evaluate(() => location.hash)) === '#pomoc/formatowanie', 'kliknięcie [?] prowadzi do działu Pomocy'); await shot('04-pomoc');

console.log('Nauka');
await p.click('a[href="#nauka"]'); await p.waitForTimeout(500);
for (const [id, v] of [['unit', 'bpe512'], ['layers', '2'], ['dim', '64'], ['ctx', '64'], ['steps', '500'], ['device', 'wasm']]) await p.selectOption('#f-pretrain-' + id, v);
await p.click('text=Rozpocznij naukę');
await p.waitForSelector('.panel-nauka >> text=/Gotowe: zapisano model|Błąd:/', { timeout: 600000 }); await shot('05-nauka');
ok((await p.textContent('.panel-nauka .train .status')).startsWith('Gotowe'), 'nauka zakończona, model zapisany');

console.log('Rozmowy wzorcowe i Dostrajanie');
await p.click('a[href="#rozmowy-wzorcowe"]'); await p.waitForTimeout(300);
await file('text=Wczytaj z pliku', join(FIX, 'rozmowy.txt')); await p.waitForSelector('dialog.modal');
ok((await p.textContent('dialog.modal')).includes('Poprawnych rozmów: 40. Błędnych: 1'), 'import rozmów: 40 dobrych, 1 błędna');
await p.click('dialog.modal >> text=/^Dodaj \\d+/'); await p.waitForTimeout(300);
await p.click('a[href="#dostrajanie"]'); await p.waitForTimeout(500);
await p.selectOption('#f-finetune-steps', '300'); await p.selectOption('#f-finetune-device', 'wasm');
await p.click('text=Rozpocznij dostrajanie');
await p.waitForSelector('.panel-dostrajanie >> text=/Gotowe: zapisano model|Błąd:/', { timeout: 600000 }); await shot('06-dostrajanie');
ok((await p.textContent('.panel-dostrajanie .train .status')).startsWith('Gotowe'), 'dostrajanie zakończone');

console.log('Czat i Historia');
await p.click('text=Ustaw jako aktywny i otwórz czat'); await p.waitForTimeout(400);
await p.fill('.chat-input', 'Ile wynosi termin przedawnienia?'); await p.keyboard.press('Enter');
await p.waitForSelector('.msg.ai .rate', { timeout: 30000 });
ok((await p.textContent('.msg.ai')).includes('sześć lat'), 'czat odpowiada zgodnie z rozmowami wzorcowymi');
const refs = await p.$('.msg.ai .refs');
ok(refs && (await refs.textContent()).includes('Z biblioteki') && /przedawni/i.test(await refs.textContent()), 'pod odpowiedzią fragmenty z biblioteki (o przedawnieniu)');
await p.click('.msg.ai .refs summary'); await p.waitForTimeout(200); await shot('07b-czat-biblioteka');
await p.click('.msg.ai >> nth=0 >> button[title="Dobra odpowiedź"]'); await p.waitForTimeout(200);
await p.click('.chat-hbtn[title^="Ustawienia rozmowy"]'); await p.waitForTimeout(200); await shot('07-czat');
await p.click('.chat-fab'); await p.click('a[href="#historia"]'); await p.waitForTimeout(400);
await p.click('text=Otwórz'); await p.click('dialog.modal >> text=/Dodaj do rozmów wzorcowych \\(/'); await p.waitForTimeout(200);
await p.click('dialog.modal >> nth=-1 >> text=Zapisz'); await p.waitForTimeout(400);
ok(await p.evaluate(async () => (await import('./js/core/db.js')).db.count('dialogs')) === 41, 'rozmowa z czatu dodana do rozmów wzorcowych');

console.log('Modele, publikacja, GitHub');
await p.click('a[href="#modele"]'); await p.waitForTimeout(400);
await p.click('text=Podgląd budowy'); await p.waitForTimeout(400); await shot('08-podglad-budowy'); await p.keyboard.press('Escape');
await p.evaluate(() => localStorage.setItem('ai-prawo.githubToken', 'atrapa'));
// GitHub API podstawione (bez sieci i limitów zapytań): okno publikacji pyta tylko, czy repo jest publiczne
await p.route(/api\.github\.com/, r => r.fulfill({ json: { private: false, full_name: 'michalstankiewicz4-cell/AI', permissions: { push: true } } }));
await p.click('.model >> nth=0 >> text=Opublikuj na GitHub'); await p.waitForTimeout(400);
ok(/models\/rozmowa-1-v[\d.]+-c_/.test(await p.textContent('dialog.modal')), 'okno publikacji: wersja w nazwie pliku modelu');
await p.check('#pub-documents'); ok(await p.isVisible('dialog.modal .warnline'), 'ostrzeżenie o publicznym repo przy danych');
await shot('09-publikacja'); await p.keyboard.press('Escape');
// „Wczytaj z GitHub” na podstawionych plikach data/*.json (bez sieci)
const fake = { publishedAt: '2026-11-13T18:00:00Z', versions: { app: '0.5.0' } };
await p.route(/data\/dokumenty\.json$/, r => r.fulfill({ json: { ...fake, documents: [{ id: 'd_gh1', name: 'Z GitHub', description: 'test', type: 'text', raw: 'Art. 1. Tekst.', text: 'Art. 1. Tekst.', chars: 14, report: { rules: [], removed: {}, warnings: [], before: 14, after: 14, paragraphs: 1 }, status: 'zatwierdzony', enabled: true, addedAt: 1, cleanerVersion: '1.0.0' }] } }));
await p.route(/data\/(ustawienia|rozmowy-wzorcowe|historia-rozmow)\.json$/, r => r.fulfill({ status: 404, body: '' }));
await p.route(/models\/index\.json$/, r => r.fulfill({ status: 404, body: '' }));
await p.click('text=Wczytaj z GitHub'); await p.waitForSelector('text=Wczytaj zaznaczone'); await shot('10-wczytaj-z-github');
await p.click('text=Wczytaj zaznaczone'); await p.waitForSelector('dialog.modal >> text=/Wczytano\\./');
ok(await p.evaluate(async () => !!(await (await import('./js/core/db.js')).db.get('documents', 'd_gh1'))), 'dokument z GitHub dodany do bazy');

console.log('Dymki, motyw');
await p.keyboard.press('Escape'); await p.goto(BASE + '#ustawienia'); await p.waitForTimeout(500);
let bad = 0;
for (const hb of await p.$$('button.help')) { if (!await hb.isVisible()) continue; await hb.hover(); const r = await p.$eval('#tipfloat', e => { const b = e.getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight; }); if (!r) bad++; }
ok(bad === 0, 'wszystkie dymki [?] mieszczą się na ekranie');
await p.click('.themebtn'); await p.reload(); await p.waitForTimeout(400);
ok(await p.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'motyw noc zapamiętany po odświeżeniu'); await shot('11-noc');

ok(!errors.length, 'brak błędów w konsoli' + (errors.length ? ': ' + errors.join(' | ') : ''));
await browser.close(); server.close();
console.log(fails ? `\n${fails} błędów` : '\nwszystko w porządku');
process.exit(fails ? 1 : 0);
