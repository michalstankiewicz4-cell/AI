// Rozmowy z czatu: zapis, oceny odpowiedzi i zamiana na rozmowę wzorcową.
//
// rekord: { id, startedAt, updatedAt, modelId, modelName, messages: [{ role: 'user'|'bot', text, ts, ms?,
//           status?: 'ok' | 'corrected' | 'wrong', corrected? }], dialogId? }

import { db } from './db.js';

const listeners = new Set();
export const onConversations = f => { listeners.add(f); return () => listeners.delete(f); };
export const changed = () => listeners.forEach(f => f());

export const listConversations = async () => (await db.all('conversations')).sort((a, b) => b.updatedAt - a.updatedAt);
export async function saveConversation(c) { c.updatedAt = Date.now(); await db.put('conversations', c); changed(); }
export async function deleteConversation(id) { await db.del('conversations', id); changed(); }

// Tekst kwestii AI, jaki ma być widziany dalej (w kontekście i w rozmowie wzorcowej): poprawka, jeśli jest
export const botText = m => m.status === 'corrected' && m.corrected ? m.corrected : m.text;

export const unreviewed = c => c.messages.filter(m => m.role === 'bot' && !m.status).length;

// Pary pytanie–odpowiedź do rozmowy wzorcowej: od początku, dopóki odpowiedzi są ocenione jako dobre albo poprawione.
export function toTurns(c) {
  const out = [];
  for (let i = 0; i + 1 < c.messages.length; i += 2) {
    const u = c.messages[i], b = c.messages[i + 1];
    if (u.role !== 'user' || b.role !== 'bot' || !(b.status === 'ok' || b.status === 'corrected')) break;
    out.push({ role: 'user', text: u.text }, { role: 'bot', text: botText(b) });
  }
  return out;
}
