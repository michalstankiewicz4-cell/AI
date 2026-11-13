// Rozmowy wzorcowe: zestaw do dostrajania (każda kwestia po formatowaniu, rozmowa po sprawdzeniu formatu).

import { db, uid } from './db.js';
import { cleanLine } from '../cleaner/cleaner.js';
import { checkDialog } from '../cleaner/dialogs.js';
import { cleanerOpts } from './settings.js';
import { VERSIONS } from '../version.js';

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
