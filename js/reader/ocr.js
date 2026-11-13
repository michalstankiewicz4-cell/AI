// OCR: rozpoznawanie tekstu ze skanów i zdjęć (Tesseract.js, model polski, vendor/tesseract).
//
// Położenie strony:
//  • bokiem (90°/270°) czy prosto/do góry nogami (0°/180°): na pomniejszonej stronie (ok. 1000 px) sprawdzamy
//    kształt wykrytych linii tekstu — wysokie i wąskie znaczą, że strona leży bokiem;
//  • który z dwóch pasujących obrotów: odczyt w obu, wygrywa ten z największą liczbą poprawnych słów
//    przy najwyższej pewności (tekst do góry nogami daje same błędy). Gdy pierwszy obrót jest pewny, drugiego nie sprawdzamy.
//  • pod kątem (przekrzywiony skan): Tesseract mierzy kąt linii tekstu i prostuje obraz przed odczytem
//    (rotateAuto); zmierzony kąt trafia do raportu.

const VENDOR = new URL('../../vendor/tesseract/', import.meta.url).href;
let lib = null, worker = null;

function loadScript(src) {
  return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Nie udało się wczytać ' + src)); document.head.append(s); });
}
async function getWorker(onLog) {
  if (!lib) { await loadScript(VENDOR + 'tesseract.min.js'); lib = window.Tesseract; }
  if (!worker) {
    worker = await lib.createWorker('pol', 1 /* tylko LSTM */, {
      workerPath: VENDOR + 'worker.min.js', corePath: VENDOR + 'core/', langPath: VENDOR + 'lang/',
      logger: m => onLog && onLog(m),
    });
    // automatyczny podział strony na bloki tekstu (kolumny, nagłówki)
    await worker.setParameters({ tessedit_pageseg_mode: lib.PSM ? lib.PSM.AUTO : '3', preserve_interword_spaces: '1' });
  }
  return worker;
}
export async function stopOcr() { if (worker) { await worker.terminate(); worker = null; } }

// Obrót płótna o 0/90/180/270° i ewentualne pomniejszenie (maxSide)
export function rotated(src, deg, maxSide = Infinity) {
  const w0 = src.width, h0 = src.height, k = Math.min(1, maxSide / Math.max(w0, h0));
  const w = Math.round(w0 * k), hh = Math.round(h0 * k), side = deg % 180 !== 0;
  const c = document.createElement('canvas'); c.width = side ? hh : w; c.height = side ? w : hh;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  g.translate(c.width / 2, c.height / 2); g.rotate(deg * Math.PI / 180); g.drawImage(src, -w / 2, -hh / 2, w, hh);
  return c;
}

// Ocena odczytu: poprawne słowa (min. 3 litery, same litery) × średnia pewność
function score(d) {
  const words = (d.text.match(/[\p{L}]{3,}/gu) || []).length;
  return { words, conf: d.confidence || 0, value: words * Math.max(1, d.confidence || 0) };
}

// Odczyt jednej strony (płótno albo obraz). onStep(tekst, ułamek 0–1) — postęp do pokazania.
export async function ocrPage(canvas, onStep = () => {}) {
  let phase = '';
  const w = await getWorker(m => { if (m.status === 'recognizing text') onStep(phase, m.progress); });
  // 1) położenie: kształt linii tekstu → leży bokiem czy nie; potem wybór jednego z dwóch obrotów
  phase = 'sprawdzam położenie strony';
  const small = rotated(canvas, 0, 1000);
  const first = (await w.recognize(small, {}, { text: true, blocks: true })).data;
  let tall = 0, wide = 0;
  for (const b of first.blocks || []) for (const pa of b.paragraphs || []) for (const l of pa.lines || []) {
    if ((l.text || '').replace(/\s/g, '').length < 3) continue;
    const bw = l.bbox.x1 - l.bbox.x0, bh = l.bbox.y1 - l.bbox.y0;
    if (bh > bw) tall += bh; else wide += bw;
  }
  const cand = tall > wide ? [90, 270] : [0, 180];
  let best = null;
  for (const deg of cand) {
    phase = `sprawdzam położenie strony (${deg}°)`;
    const data = deg === 0 ? first : (await w.recognize(rotated(canvas, deg, 1000))).data;
    const s = score(data);
    if (!best || s.value > best.value) best = { deg, ...s };
    if (deg === cand[0] && s.conf >= 80 && s.words >= 15 && deg === 0) break;
  }
  // 2) właściwy odczyt w pełnej rozdzielczości, z prostowaniem przekrzywienia
  phase = 'rozpoznaję tekst';
  const { data } = await w.recognize(rotated(canvas, best.deg), { rotateAuto: true });
  const skew = data.rotateRadians ? data.rotateRadians * 180 / Math.PI : 0;
  return { text: data.text, rotation: best.deg, skew: Math.round(skew * 10) / 10, confidence: Math.round(data.confidence || 0) };
}

// Obraz (png, jpg, webp, bmp, gif) → płótno. Orientację z EXIF (zdjęcia z telefonu) stosuje przeglądarka.
export async function imageToCanvas(file) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(bmp, 0, 0);
  bmp.close && bmp.close();
  return c;
}
