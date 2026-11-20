// Przygotowanie dokumentów dla zewnętrznego AI (np. Claude) do ostatecznego sformatowania – i wczytanie wyniku.
// Plik = instrukcja (edytowalna w Formatowaniu) + dokumenty między znacznikami. AI zwraca te same znaczniki,
// panel podmienia tekst dokumentów (oryginał i formatowanie regułami zostają; wersję od AI można usunąć).

import { saveDoc, mergeTags } from './documents.js';
import { log } from './log.js';

export const AI_TAG = 'sformatowany przez AI';
export { DEFAULT_PROMPT } from './ai-prompt.js';
import { DEFAULT_PROMPT } from './ai-prompt.js';

const START = id => `=== DOKUMENT ${id} ===`, END = id => `=== KONIEC ${id} ===`;

// dokumenty → części pliku (każda z instrukcją), nie dłuższe niż maxChars (dokument dłuższy idzie sam w części)
export function buildExport(docs, prompt = DEFAULT_PROMPT, maxChars = 60000) {
  const blocks = docs.map(d => [START(d.id),
    `Nazwa: ${d.name}`, d.eli ? `ELI: ${d.eli}` : null, d.sourceUrl ? `Źródło: ${d.sourceUrl}` : null, d.tags && d.tags.length ? `Kategorie: ${d.tags.join(', ')}` : null, '',
    (d.aiText || d.text).trim(), END(d.id)].filter(x => x != null).join('\n'));
  const parts = []; let cur = [], len = 0;
  for (const b of blocks) { if (cur.length && len + b.length > maxChars) { parts.push(cur); cur = []; len = 0; } cur.push(b); len += b.length; }
  if (cur.length) parts.push(cur);
  return parts.map((p, i) => `<instrukcja>\n${prompt.trim()}\n</instrukcja>\n\nCzęść ${i + 1} z ${parts.length}, dokumentów: ${p.length}.\n\n${p.join('\n\n')}\n`);
}

// wynik od AI → [{ id, text }] (znaczniki mogą być otoczone ``` albo dodatkowym tekstem)
export function parseImport(text) {
  const out = [], re = /===\s*DOKUMENT\s+(\S+)\s*===\s*\n([\s\S]*?)\n\s*===\s*KONIEC\s+\1\s*===/g;
  let m; while ((m = re.exec(String(text).replace(/\r\n?/g, '\n')))) {
    const body = m[2].replace(/^(Nazwa|ELI|Źródło|Kategorie):.*\n/gm, '').replace(/^```\w*\n?|```$/gm, '').trim();
    if (body) out.push({ id: m[1], text: body });
  }
  return out;
}

// zapis wersji od AI: tekst do nauki = wersja od AI, status do sprawdzenia, kategoria „sformatowany przez AI”
export async function applyAiText(doc, text) {
  doc.aiText = text; doc.aiAt = Date.now(); doc.text = text; doc.chars = text.length;
  doc.status = 'do-sprawdzenia'; doc.tags = mergeTags(doc.tags, [AI_TAG]);
  await saveDoc(doc);
  log('info', 'formatowanie', `„${doc.name}”: wczytano wersję sformatowaną przez AI (${text.length} znaków)`);
  return doc;
}
export async function dropAiText(doc, reformat) {
  delete doc.aiText; delete doc.aiAt; doc.tags = doc.tags.filter(t => t !== AI_TAG);
  await reformat(doc);
  log('info', 'formatowanie', `„${doc.name}”: usunięto wersję od AI, przywrócono formatowanie regułami`);
}
