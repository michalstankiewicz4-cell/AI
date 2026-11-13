// Korpus do nauki: zatwierdzone dokumenty i rozmowy wzorcowe z bazy.

import { db, uid } from './db.js';
import { cleanDocument, cleanLine } from '../cleaner/cleaner.js';
import { checkDialog } from '../cleaner/dialogs.js';
import { cleanerOpts } from './settings.js';
import { VERSIONS } from '../version.js';

// ---------- dokumenty ----------
// rekord: { id, name, type: 'text'|'html'|'markdown'|'wklejony', encoding, size, addedAt, description, raw,   ← wgrany plik
//           text, report, chars, cleanerVersion, formattedAt,                                              ← wynik formatowania
//           status: 'do-sprawdzenia'|'zatwierdzony'|'odrzucony', enabled }                                  ← decyzja
// Wgranie od razu formatuje dokument (konwerter): wynik czeka w zakładce „Formatowanie” na zatwierdzenie.
export const STATUS = { 'do-sprawdzenia': 'do sprawdzenia', zatwierdzony: 'zatwierdzony', odrzucony: 'odrzucony' };

// dokumenty zapisane przez wersję 0.1–0.2 (bez statusu i opisu) były już zatwierdzone
const norm = d => { if (!d.status) d.status = 'zatwierdzony'; if (d.description == null) d.description = ''; if (d.enabled == null) d.enabled = true; return d; };
export const listDocs = async () => (await db.all('documents')).map(norm).sort((a, b) => b.addedAt - a.addedAt);

function format(doc) {
  const { text, report } = cleanDocument(doc.raw, cleanerOpts());
  return Object.assign(doc, { text, report, chars: text.length, cleanerVersion: VERSIONS.cleaner, formattedAt: Date.now() });
}
// Wgranie: zapis oryginału + formatowanie; status „do sprawdzenia”
export async function addDoc({ name, type = 'text', encoding = 'UTF-8', raw, size = null, description = '' }) {
  const doc = format({ id: uid('d_'), name, type, encoding, size, raw, description, addedAt: Date.now(), status: 'do-sprawdzenia', enabled: true });
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

// ---------- rozmowy wzorcowe ----------
// rekord: { id, turns: [{role, text}], source: 'ręcznie' | 'plik' | 'czat', enabled, addedAt, cleanerVersion, conversationId? }
export const listDialogs = async () => (await db.all('dialogs')).sort((a, b) => b.addedAt - a.addedAt);
export function makeDialog(turns, source, extra = {}) {
  const o = cleanerOpts(), t = turns.map(x => ({ role: x.role, text: cleanLine(x.text, o).text }));
  const err = checkDialog(t, o);
  if (err) throw new Error(err);
  return { id: uid('r_'), turns: t, source, enabled: true, addedAt: Date.now(), cleanerVersion: VERSIONS.cleaner, ...extra };
}
export const saveDialog = d => db.put('dialogs', d);
export const deleteDialog = id => db.del('dialogs', id);
export async function trainingDialogs() { return (await listDialogs()).filter(d => d.enabled).reverse(); }
