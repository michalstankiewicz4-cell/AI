// Test odczytu PDF i OCR w prawdziwej przeglądarce: strona prosta, do góry nogami, bokiem, przekrzywiona;
// PDF z warstwą tekstową i PDF-skan (sam obraz). Pliki testowe tworzone w locie (Chrome: canvas i page.pdf).
//   node tests/e2e/ocr.e2e.mjs   (PLAYWRIGHT=…, CHROME=… jak w panel.e2e.mjs)

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

const TEXT = ['Art. 117. § 1. Z zastrzeżeniem wyjątków w ustawie', 'przewidzianych, roszczenia majątkowe ulegają', 'przedawnieniu. § 2. Po upływie terminu', 'przedawnienia ten, przeciwko komu przysługuje', 'roszczenie, może uchylić się od jego zaspokojenia.', 'Art. 118. Jeżeli przepis szczególny nie stanowi', 'inaczej, termin przedawnienia wynosi sześć lat.'];
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(BASE); await p.waitForTimeout(500);

// obrazy: tekst narysowany na płótnie, obrócony (deg) i przekrzywiony (skew)
const image = (deg, skew) => p.evaluate(async ({ TEXT, deg, skew }) => {
  const W = 1400, H = 900, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); g.fillStyle = '#111'; g.font = '34px Georgia, serif';
  TEXT.forEach((l, i) => g.fillText(l, 70, 110 + i * 70));
  const r = document.createElement('canvas'), side = deg % 180 !== 0; r.width = side ? H : W; r.height = side ? W : H;
  const q = r.getContext('2d'); q.fillStyle = '#fff'; q.fillRect(0, 0, r.width, r.height);
  q.translate(r.width / 2, r.height / 2); q.rotate((deg + skew) * Math.PI / 180); q.drawImage(c, -W / 2, -H / 2);
  const blob = await new Promise(res => r.toBlob(res, 'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}, { TEXT, deg, skew });
const read = (name, bytes, type) => p.evaluate(async ({ name, bytes, type }) => {
  const { readFile } = await import('./js/reader/index.js');
  const r = await readFile(new File([new Uint8Array(bytes)], name, { type }));
  return { raw: r.raw, ocr: r.ocr, type: r.type };
}, { name, bytes, type });
const words = s => ['przedawnienia', 'roszczenia', 'majątkowe', 'szczególny', 'sześć'].filter(w => s.includes(w)).length;

console.log('Obrazy (OCR)');
for (const [deg, skew, label] of [[0, 0, 'prosto'], [180, 0, 'do góry nogami'], [90, 0, 'bokiem (90°)'], [270, 0, 'bokiem (270°)'], [0, 4, 'pod kątem 4°']]) {
  const bytes = await image(deg, skew); await writeFile(join(OUT, `ocr-${deg}-${skew}.png`), Buffer.from(bytes));
  const t0 = Date.now(), r = await read(`skan-${deg}.png`, bytes, 'image/png'), pg = r.ocr.pages[0];
  const back = (360 - deg) % 360;   // obrót, który przywraca tekst
  ok(pg.rotation === back && words(r.raw) >= 4, `${label}: obrót ${pg.rotation}°, przekrzywienie ${pg.skew}°, pewność ${pg.confidence}%, słowa ${words(r.raw)}/5 (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (skew) ok(Math.abs(Math.abs(pg.skew) - skew) < 1.5, `${label}: zmierzony kąt ${pg.skew}° ≈ ${skew}°`);
}

console.log('PDF');
const html = body => `<!doctype html><meta charset="utf-8"><body style="font:20px Georgia;margin:60px">${body}</body>`;
const pdfText = await (async () => { const q = await b.newPage(); await q.setContent(html(TEXT.map(l => `<p>${l}</p>`).join(''))); const r = await q.pdf({ format: 'A4' }); await q.close(); return r; })();
let r = await read('tekst.pdf', Array.from(pdfText), 'application/pdf');
ok(r.ocr.pages[0].method === 'tekst' && words(r.raw) === 5, `PDF z warstwą tekstową: odczyt bez OCR, słowa ${words(r.raw)}/5`);
const img = Buffer.from(await image(180, 0)).toString('base64');
const pdfScan = await (async () => { const q = await b.newPage(); await q.setContent(html(`<img src="data:image/png;base64,${img}" style="width:100%">`)); const r = await q.pdf({ format: 'A4' }); await q.close(); return r; })();
r = await read('skan.pdf', Array.from(pdfScan), 'application/pdf');
ok(r.ocr.pages[0].method === 'OCR' && r.ocr.pages[0].rotation === 180 && words(r.raw) >= 4, `PDF-skan do góry nogami: OCR, obrót ${r.ocr.pages[0].rotation}°, słowa ${words(r.raw)}/5`);

ok(!errs.length, 'brak błędów strony' + (errs.length ? ': ' + errs.join(' | ') : ''));
await b.close(); server.close();
console.log(fails ? `\n${fails} błędów` : '\nwszystko w porządku'); process.exit(fails ? 1 : 0);
