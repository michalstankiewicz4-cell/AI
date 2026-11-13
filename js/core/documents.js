// Dokumenty do nauki: biblioteka wgranych plików, wynik formatowania (konwertera) i decyzja o zatwierdzeniu.

import { db, uid } from './db.js';
import { cleanDocument } from '../cleaner/cleaner.js';
import { cleanerOpts } from './settings.js';
import { VERSIONS } from '../version.js';
import { ocrSummary } from '../reader/index.js';

// rekord: { id, name, type: 'text'|'html'|'markdown'|'docx'|'odt'|'rtf'|'pdf'|'obraz'|'wklejony', encoding, size, addedAt, description, raw,
//           ocr?: { pages: [{ page, method: 'tekst'|'OCR', rotation, skew, confidence }] },                      ← wgrany plik
//           text, report, chars, cleanerVersion, formattedAt,                                              ← wynik formatowania
//           status: 'do-sprawdzenia'|'zatwierdzony'|'odrzucony', enabled }                                  ← decyzja
// Wgranie od razu formatuje dokument (konwerter): wynik czeka w zakładce „Formatowanie” na zatwierdzenie.
export const STATUS = { 'do-sprawdzenia': 'do sprawdzenia', zatwierdzony: 'zatwierdzony', odrzucony: 'odrzucony' };

// dokumenty zapisane przez wersję 0.1–0.2 (bez statusu i opisu) były już zatwierdzone
const norm = d => { if (!d.status) d.status = 'zatwierdzony'; if (d.description == null) d.description = ''; if (d.enabled == null) d.enabled = true; return d; };
export const listDocs = async () => (await db.all('documents')).map(norm).sort((a, b) => b.addedAt - a.addedAt);

function format(doc) {
  const { text, report } = cleanDocument(doc.raw, cleanerOpts());
  const o = ocrSummary(doc.ocr);                       // PDF/obraz: opis odczytu i ostrzeżenia OCR
  if (o) { report.read = o.text; report.warnings.unshift(...o.warnings); }
  return Object.assign(doc, { text, report, chars: text.length, cleanerVersion: VERSIONS.cleaner, formattedAt: Date.now() });
}
// Wgranie: zapis oryginału + formatowanie; status „do sprawdzenia”
export async function addDoc({ name, type = 'text', encoding = 'UTF-8', raw, size = null, description = '', ocr = null }) {
  const doc = format({ id: uid('d_'), name, type, encoding, size, raw, description, ocr, addedAt: Date.now(), status: 'do-sprawdzenia', enabled: true });
  await db.put('documents', doc);
  return doc;
}
export const saveDoc = doc => db.put('documents', doc);
export const deleteDoc = id => db.del('documents', id);
// Ponowne formatowanie z oryginału aktualnymi regułami. Zatwierdzony dokument wraca do sprawdzenia tylko wtedy, gdy wynik się zmienił.
export async function recleanDoc(doc) {
  const before = doc.text; format(doc);
  if (doc.status === 'zatwierdzony' && doc.text !== before) doc.status = 'do-sprawdzenia';
  await saveDoc(doc); return doc;
}
export async function setStatus(doc, status) { doc.status = status; if (status === 'zatwierdzony') doc.enabled = true; await saveDoc(doc); }

// Tekst do nauki: zatwierdzone i włączone dokumenty, od najstarszego, rozdzielone pustą linią
export async function corpusText() {
  const docs = (await listDocs()).filter(d => d.status === 'zatwierdzony' && d.enabled).reverse();
  return { text: docs.map(d => d.text).join('\n\n') + '\n', docs: docs.length, chars: docs.reduce((a, d) => a + d.chars, 0) };
}
