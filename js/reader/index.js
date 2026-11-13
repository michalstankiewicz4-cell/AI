// Odczyt wgrywanych plików: wybór sposobu według rodzaju pliku.
//   .txt .md .html  → text.js   (kodowanie, HTML, Markdown)
//   .docx .odt .rtf → office.js (Word, OpenDocument/LibreOffice, RTF); .doc → prośba o zapis jako .docx
//   .pdf            → pdf.js    (warstwa tekstowa; strony-skany przez OCR)
//   obrazy          → ocr.js  (OCR z rozpoznaniem położenia strony i przekrzywienia)
// Wynik: { name, type, encoding, raw, size, ocr? } — `ocr` opisuje strony (sposób odczytu, obrót, kąt, pewność).

import { readTextFile } from './text.js';
import { readOffice } from './office.js';

export const ACCEPT = '.txt,.md,.markdown,.html,.htm,.docx,.odt,.rtf,.doc,.pdf,.png,.jpg,.jpeg,.webp,.bmp,.gif,text/plain,text/markdown,text/html,application/pdf,image/*';
const IMG = /\.(png|jpe?g|webp|bmp|gif)$/i;

export const kindOf = file => /\.(docx|odt|rtf|doc)$/i.test(file.name) ? 'office' : /\.pdf$/i.test(file.name) || file.type === 'application/pdf' ? 'pdf' : IMG.test(file.name) || /^image\//.test(file.type) ? 'obraz' : 'text';

// onProgress({ page, pages, step, frac }) — tylko dla PDF i obrazów (OCR)
export async function readFile(file, onProgress = () => {}) {
  const kind = kindOf(file);
  if (kind === 'text') return readTextFile(file);
  if (kind === 'office') return readOffice(file);
  if (kind === 'pdf') {
    const { readPdf } = await import('./pdf.js');
    const r = await readPdf(file, onProgress);
    return { name: file.name, type: 'pdf', encoding: r.pages.some(p => p.method === 'OCR') ? 'PDF + OCR' : 'PDF', raw: r.text, size: file.size, ocr: { pages: r.pages } };
  }
  const { ocrPage, imageToCanvas } = await import('./ocr.js');
  onProgress({ page: 1, pages: 1, step: 'wczytuję obraz', frac: 0 });
  const r = await ocrPage(await imageToCanvas(file), (step, frac) => onProgress({ page: 1, pages: 1, step, frac }));
  return { name: file.name, type: 'obraz', encoding: 'OCR', raw: r.text, size: file.size, ocr: { pages: [{ page: 1, method: 'OCR', rotation: r.rotation, skew: r.skew, confidence: r.confidence }] } };
}

// Po serii plików: zwolnienie pamięci silnika OCR
export async function finishReading() { try { const { stopOcr } = await import('./ocr.js'); await stopOcr(); } catch (_) { /* OCR nie był używany */ } }

// Opis odczytu do raportu i ostrzeżenia (strony obrócone, przekrzywione, mało pewne)
export function ocrSummary(ocr) {
  if (!ocr || !ocr.pages) return null;
  const P = ocr.pages, o = P.filter(p => p.method === 'OCR');
  const rot = o.filter(p => p.rotation), skew = o.filter(p => Math.abs(p.skew) >= .5), low = o.filter(p => p.confidence < 60);
  const avg = o.length ? Math.round(o.reduce((a, p) => a + p.confidence, 0) / o.length) : null;
  const parts = [`${P.length} ${P.length === 1 ? 'strona' : 'stron'}`];
  if (P.length - o.length) parts.push(`z warstwy tekstowej: ${P.length - o.length}`);
  if (o.length) parts.push(`OCR: ${o.length} (średnia pewność ${avg}%)`);
  if (rot.length) parts.push(`obrócone: ${rot.map(p => `str. ${p.page} o ${p.rotation}°`).join(', ')}`);
  if (skew.length) parts.push(`wyprostowane: ${skew.map(p => `str. ${p.page} o ${p.skew > 0 ? '+' : ''}${String(p.skew).replace('.', ',')}°`).join(', ')}`);
  const warnings = low.length ? [`OCR mało pewny na ${low.length === 1 ? 'stronie' : 'stronach'} ${low.map(p => `${p.page} (${p.confidence}%)`).join(', ')}: sprawdź podgląd — mogą być błędne litery. Lepszy skan (wyższa rozdzielczość, prosto, bez cieni) daje lepszy wynik.`] : [];
  return { text: parts.join(' · '), warnings };
}
