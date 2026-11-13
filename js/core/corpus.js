// Korpus do nauki: zatwierdzone dokumenty i rozmowy wzorcowe z bazy.

import { db, uid } from './db.js';
import { cleanDocument, cleanLine } from '../cleaner/cleaner.js';
import { checkDialog } from '../cleaner/dialogs.js';
import { cleanerOpts } from './settings.js';
import { VERSIONS } from '../version.js';

// ---------- dokumenty ----------
export const listDocs = async () => (await db.all('documents')).sort((a, b) => b.addedAt - a.addedAt);

// Przygotowanie dokumentu (jeszcze bez zapisu): formatowanie + raport
export function prepareDoc({ name, type = 'text', encoding = 'UTF-8', raw }) {
  const { text, report } = cleanDocument(raw, cleanerOpts());
  return { id: uid('d_'), name, type, encoding, raw, text, report, chars: text.length, cleanerVersion: VERSIONS.cleaner, enabled: true, addedAt: Date.now() };
}
export const saveDoc = doc => db.put('documents', doc);
export const deleteDoc = id => db.del('documents', id);
export async function recleanDoc(doc) { const n = prepareDoc(doc); Object.assign(doc, { text: n.text, report: n.report, chars: n.chars, cleanerVersion: n.cleanerVersion }); await saveDoc(doc); return doc; }

// Tekst do nauki: włączone dokumenty, od najstarszego, rozdzielone pustą linią
export async function corpusText() {
  const docs = (await listDocs()).filter(d => d.enabled).reverse();
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
