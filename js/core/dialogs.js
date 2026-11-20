// Rozmowy wzorcowe: zestaw do dostrajania (każda kwestia po formatowaniu, rozmowa po sprawdzeniu formatu).

import { db, uid } from './db.js';
import { cleanLine } from '../cleaner/cleaner.js';
import { checkDialog } from '../cleaner/dialogs.js';
import { cleanerOpts } from './settings.js';
import { VERSIONS } from '../version.js';
import { activeProfile, inProfile, profileTags } from './profiles.js';

// rozmowa należy do profilu, gdy ma jego kategorię; rozmowa bez kategorii jest wspólna dla wszystkich profili
export const dialogInProfile = (d, p = activeProfile()) => !p || !(d.tags && d.tags.length) || inProfile(d, p);

// rekord: { id, turns: [{role, text}], source: 'ręcznie' | 'plik' | 'czat' | 'pakiet', enabled, addedAt, cleanerVersion, conversationId?,
//           draft?: true, pack? }   ← szkielet z pakietu: pytanie bez odpowiedzi, nie bierze udziału w dostrajaniu, dopóki nie dopiszesz odpowiedzi
export const listDialogs = async () => (await db.all('dialogs')).sort((a, b) => b.addedAt - a.addedAt);
export function makeDialog(turns, source, extra = {}) {
  const o = cleanerOpts(), t = turns.map(x => ({ role: x.role, text: cleanLine(x.text, o).text }));
  const err = checkDialog(t, o);
  if (err) throw new Error(err);
  return { id: uid('r_'), turns: t, source, enabled: true, addedAt: Date.now(), cleanerVersion: VERSIONS.cleaner, tags: profileTags(), ...extra };
}
export const saveDialog = d => db.put('dialogs', d);
export const deleteDialog = id => db.del('dialogs', id);
export async function trainingDialogs() { return (await listDialogs()).filter(d => d.enabled && !d.draft && dialogInProfile(d)).reverse(); }
// Typowe pytania z pakietu → szkielety rozmów (pytanie bez odpowiedzi). Pomija pytania, które już są w zestawie.
const qkey = t => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export async function addQuestionDrafts(questions, pack) {
  const o = cleanerOpts(), have = new Set((await listDialogs()).map(d => qkey(d.turns[0] ? d.turns[0].text : ''))), recs = [];
  let skipped = 0;
  for (const q of questions) {
    const text = cleanLine(q, o).text; if (!text) continue;
    if (have.has(qkey(text))) { skipped++; continue; }
    have.add(qkey(text));
    recs.push({ id: uid('r_'), turns: [{ role: 'user', text }, { role: 'bot', text: '' }], source: 'pakiet', pack, tags: [...new Set([pack, ...profileTags()])], draft: true, enabled: false, addedAt: Date.now() + recs.length, cleanerVersion: VERSIONS.cleaner });
  }
  if (recs.length) await db.putMany('dialogs', recs);
  return { added: recs.length, skipped };
}
