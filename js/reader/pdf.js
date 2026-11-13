// PDF: tekst z warstwy tekstowej (pdf.js, vendor/pdfjs), a strony bez tekstu (skany) przez OCR.
// Strona ma warstwę tekstową, jeśli wyciągnięty z niej tekst ma co najmniej MIN_TEXT znaków (bez spacji).

import { ocrPage } from './ocr.js';

const VENDOR = new URL('../../vendor/pdfjs/', import.meta.url).href;
const MIN_TEXT = 30, SCALE = 2;          // skala renderu do OCR: 2 ≈ 150 dpi dla A4
let pdfjs = null;

async function lib() {
  if (!pdfjs) {
    pdfjs = await import(VENDOR + 'pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = VENDOR + 'pdf.worker.min.mjs';
  }
  return pdfjs;
}

// Tekst strony z warstwy tekstowej: kolejne fragmenty, koniec linii tam, gdzie pdf.js go zgłasza albo zmienia się wysokość wiersza
function pageText(content) {
  let out = '', lastY = null;
  for (const it of content.items) {
    if (!('str' in it)) continue;
    const y = it.transform ? it.transform[5] : null;
    if (lastY != null && y != null && Math.abs(y - lastY) > 2 && !out.endsWith('\n')) out += '\n';
    out += it.str;
    if (it.hasEOL) out += '\n';
    if (y != null) lastY = y;
  }
  return out;
}

// onProgress({ page, pages, step, frac }) — do paska postępu
export async function readPdf(file, onProgress = () => {}, { forceOcr = false } = {}) {
  const pj = await lib();
  const doc = await pj.getDocument({ data: new Uint8Array(await file.arrayBuffer()), standardFontDataUrl: VENDOR + 'standard_fonts/', wasmUrl: VENDOR + 'wasm/' }).promise;
  const pages = [], texts = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    onProgress({ page: n, pages: doc.numPages, step: 'czytam warstwę tekstową', frac: 0 });
    const t = forceOcr ? '' : pageText(await page.getTextContent());
    if (t.replace(/\s/g, '').length >= MIN_TEXT) { texts.push(t); pages.push({ page: n, method: 'tekst' }); continue; }
    // skan: render strony i OCR
    const vp = page.getViewport({ scale: SCALE }), c = document.createElement('canvas');
    c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp, canvas: c }).promise;
    const r = await ocrPage(c, (step, frac) => onProgress({ page: n, pages: doc.numPages, step, frac }));
    texts.push(r.text); pages.push({ page: n, method: 'OCR', rotation: r.rotation, skew: r.skew, confidence: r.confidence });
    page.cleanup();
  }
  await doc.destroy();
  return { text: texts.join('\n\n'), pages };
}
