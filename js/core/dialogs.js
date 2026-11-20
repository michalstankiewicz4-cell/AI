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

// ---------- kazusy z orzeczeń ----------
// Orzeczenie w częściach (np. po formatowaniu przez zewnętrzne AI): „Stan faktyczny”, „Analiza (prawna)”, „Rozstrzygnięcie”.
// Z nich szkielet rozmowy: pytanie = stan faktyczny, odpowiedź = rozstrzygnięcie z uzasadnieniem (skrócone do limitu odpowiedzi).
const SECTION = { fakty: /stan faktyczny|ustalenia faktyczne/i, analiza: /analiza|uzasadnienie|ocena prawna|rozważania/i, wynik: /rozstrzygni|sentencja|wyrok sądu|orzeczenie sądu/i };
export function judgmentSections(text) {
  const out = {}; let key = null;
  for (const line of String(text || '').split('\n')) {
    const h = /^\s*(#{1,6}\s*)?([^\n]{3,60}?)\s*:?\s*$/.exec(line);
    const isHead = h && (h[1] || line.trim().length < 40) && Object.entries(SECTION).find(([, re]) => re.test(h[2]));
    if (isHead) { key = isHead[0]; out[key] = out[key] || ''; continue; }
    if (key) out[key] += line + '\n';
  }
  for (const k of Object.keys(out)) out[k] = out[k].trim();
  return out;
}
const cutAt = (t, n) => { t = t.replace(/\s+/g, ' ').trim(); if (t.length <= n) return t; const c = t.slice(0, n), i = Math.max(c.lastIndexOf('. '), c.lastIndexOf('; ')); return (i > n * .5 ? c.slice(0, i + 1) : c.trimEnd()) + ' …'; };
export function caseFromJudgment(doc, maxAnswer = 600) {
  const s = judgmentSections(doc.text);
  if (!s.fakty || !(s.wynik || s.analiza)) return { error: 'brak części „Stan faktyczny” i „Rozstrzygnięcie”/„Analiza” – sformatuj orzeczenie przez zewnętrzne AI' };
  const question = cutAt(s.fakty, 700) + ' Jak to ocenić prawnie i jak powinien rozstrzygnąć sąd?';
  const answer = cutAt([s.wynik, s.analiza].filter(Boolean).join(' Uzasadnienie: '), maxAnswer);
  return { question, answer };
}
export async function addCaseDrafts(docs) {
  const o = cleanerOpts(), have = new Set((await listDialogs()).map(d => d.caseOf).filter(Boolean)), recs = [], skipped = [];
  for (const d of docs) {
    if (have.has(d.id)) { skipped.push({ doc: d, why: 'kazus już jest w rozmowach wzorcowych' }); continue; }
    const c = caseFromJudgment(d, o.maxAnswer); if (c.error) { skipped.push({ doc: d, why: c.error }); continue; }
    recs.push({ id: uid('r_'), turns: [{ role: 'user', text: cleanLine(c.question, o).text }, { role: 'bot', text: cleanLine(c.answer, o).text }], source: 'kazus', caseOf: d.id,
      tags: [...new Set(['kazus', ...(d.tags || []).filter(t => t !== 'orzeczenie'), ...profileTags()])], draft: true, enabled: false, addedAt: Date.now() + recs.length, cleanerVersion: VERSIONS.cleaner });
  }
  if (recs.length) await db.putMany('dialogs', recs);
  return { added: recs.length, skipped };
}
