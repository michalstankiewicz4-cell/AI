// Przenoszenie pracy przez GitHub: zbieranie danych do publikacji i przywracanie opublikowanych.
//
// Publikacja (core/github.js → publish) wysyła wybrane części jednym commitem:
//   data/ustawienia.json, data/dokumenty.json, data/rozmowy-wzorcowe.json (+ .txt do czytania), data/historia-rozmow.json
// Przywracanie dodaje do bazy w tej przeglądarce rekordy, których jeszcze nie ma (to samo id),
// albo — na życzenie — zastępuje istniejące. Ustawienia są zastępowane w całości. Token nigdy nie jest wysyłany.

import { db } from './db.js';
import { settings, saveSettings, defaults, tags } from './settings.js';
import { listDocs } from './documents.js';
import { listDialogs } from './dialogs.js';
import { listConversations, changed as conversationsChanged } from './conversations.js';
import { dialogToText } from '../cleaner/dialogs.js';
import { fetchPublished } from './github.js';
import { VERSIONS } from '../version.js';

export const PARTS = {
  settings: { file: 'data/ustawienia.json', label: 'Ustawienia i wersje' },
  documents: { file: 'data/dokumenty.json', label: 'Dokumenty', store: 'documents' },
  dialogs: { file: 'data/rozmowy-wzorcowe.json', label: 'Rozmowy wzorcowe', store: 'dialogs' },
  conversations: { file: 'data/historia-rozmow.json', label: 'Historia rozmów', store: 'conversations' },
};

// Wszystko, co może pójść na GitHub (pełne rekordy, żeby dało się je odtworzyć 1:1)
export async function collect() {
  const [documents, dialogs, conversations] = await Promise.all([listDocs(), listDialogs(), listConversations()]);
  return {
    settings: settings(), versions: { ...VERSIONS },
    documents, dialogs, conversations,
    dialogsText: dialogs.slice().reverse().map(d => dialogToText(d.turns, tags())).join('\n\n') + '\n',
  };
}

// Co jest opublikowane: { settings: {publishedAt, settings} | null, documents: {publishedAt, documents} | null, … }
export async function fetchPublishedData(cfg) {
  const out = {};
  await Promise.all(Object.entries(PARTS).map(async ([k, p]) => { out[k] = await fetchPublished(p.file, cfg, { optional: true }).catch(() => null); }));
  return out;
}

// Przywrócenie wybranych części. replace: zastąp rekordy o tym samym id (domyślnie pomiń).
// Zwraca { part: { added, replaced, skipped } }.
export async function restore(pub, what, { replace = false } = {}) {
  const res = {};
  if (what.settings && pub.settings) {
    const d = defaults(), s = pub.settings.settings || {};
    for (const g in d) Object.assign(d[g], s[g] || {});        // nowe pola z tej wersji panelu zostają z domyślnymi wartościami
    await saveSettings(d); res.settings = { replaced: 1 };
  }
  for (const k of ['documents', 'dialogs', 'conversations']) {
    if (!what[k] || !pub[k]) continue;
    const list = pub[k][k] || [], store = PARTS[k].store, r = { added: 0, replaced: 0, skipped: 0 };
    const have = new Set((await db.all(store)).map(x => x.id)), put = [];
    for (const rec of list) {
      if (!rec || !rec.id) continue;
      if (have.has(rec.id)) { if (replace) { put.push(rec); r.replaced++; } else r.skipped++; }
      else { put.push(rec); r.added++; }
    }
    if (put.length) await db.putMany(store, put);
    res[k] = r;
  }
  if (res.conversations) conversationsChanged();
  return res;
}
