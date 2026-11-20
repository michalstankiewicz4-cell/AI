// Przenoszenie pracy przez GitHub: zbieranie danych do publikacji i przywracanie opublikowanych.
//
// Publikacja (core/github.js → publish) wysyła wybrane części jednym commitem:
//   data/ustawienia.json, data/dokumenty.json, data/rozmowy-wzorcowe.json (+ .txt do czytania), data/historia-rozmow.json
// Przywracanie dodaje do bazy w tej przeglądarce rekordy, których jeszcze nie ma (to samo id),
// albo — na życzenie — zastępuje istniejące. Ustawienia są zastępowane w całości. Token nigdy nie jest wysyłany.

import { db } from './db.js';
import { log } from './log.js';
import { settings, saveSettings, defaults, tags } from './settings.js';
import { listDocs } from './documents.js';
import { listDialogs } from './dialogs.js';
import { listConversations, changed as conversationsChanged } from './conversations.js';
import { dialogToText } from '../cleaner/dialogs.js';
import { fetchPublished } from './github.js';
import { listSources } from './sources.js';
import { userPacks } from './packs.js';
import { profilesData, loadProfiles } from './profiles.js';
import { loadTagGroups } from './taggroups.js';
import { VERSIONS } from '../version.js';

export const PARTS = {
  settings: { file: 'data/ustawienia.json', label: 'Ustawienia i wersje' },
  documents: { file: 'data/dokumenty.json', label: 'Dokumenty', store: 'documents' },
  dialogs: { file: 'data/rozmowy-wzorcowe.json', label: 'Rozmowy wzorcowe', store: 'dialogs' },
  conversations: { file: 'data/historia-rozmow.json', label: 'Historia rozmów', store: 'conversations' },
  sources: { file: 'data/zrodla.json', label: 'Źródła (Research)', store: 'sources' },
  packs: { file: 'data/pakiety.json', label: 'Własne pakiety', kv: 'userPacks' },
  profiles: { file: 'data/profile.json', label: 'Profile', kv: 'profiles' },
  tagGroups: { file: 'data/grupy-kategorii.json', label: 'Grupy kategorii', kv: 'tagGroups' },
};

// Wszystko, co może pójść na GitHub (pełne rekordy, żeby dało się je odtworzyć 1:1)
export async function collect() {
  const [documents, dialogs, conversations, sources, packs, profiles, tagGroups] = await Promise.all([listDocs(), listDialogs(), listConversations(), listSources(), userPacks(), profilesData(), db.kvGet('tagGroups')]);
  return {
    settings: settings(), versions: { ...VERSIONS },
    documents, dialogs, conversations, sources, packs, profiles, tagGroups: tagGroups || [],
    dialogsText: dialogs.filter(d => !d.draft).reverse().map(d => dialogToText(d.turns, tags())).join('\n\n') + '\n',
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
export async function restore(pub, what, { replace = false, from = 'github' } = {}) {
  const res = {};
  try { return await restoreRaw(pub, what, replace, res, from); } catch (e) { log('error', from === 'plik' ? 'dane' : 'github', `Wczytywanie danych z ${from === 'plik' ? 'pliku' : 'GitHub'} nieudane: ` + e.message, e); throw e; }
}
async function restoreRaw(pub, what, replace, res, from) {
  if (what.settings && pub.settings) {
    const d = defaults(), s = pub.settings.settings || {};
    for (const g in d) Object.assign(d[g], s[g] || {});        // nowe pola z tej wersji panelu zostają z domyślnymi wartościami
    await saveSettings(d); res.settings = { replaced: 1 };
  }
  if (what.tagGroups && pub.tagGroups && (pub.tagGroups.tagGroups || []).length) {
    const own = (await db.kvGet('tagGroups')) || [];
    if (replace || !own.length) { await db.kvSet('tagGroups', pub.tagGroups.tagGroups); res.tagGroups = { added: 0, replaced: pub.tagGroups.tagGroups.length, skipped: 0 }; }
    else res.tagGroups = { added: 0, replaced: 0, skipped: pub.tagGroups.tagGroups.length };
    await loadTagGroups();
  }
  if (what.profiles && pub.profiles) {
    const own = await profilesData(), ids = new Set(own.map(p => p.id)), r = { added: 0, replaced: 0, skipped: 0 };
    for (const p of pub.profiles.profiles || []) { if (!p || !p.id) continue; if (ids.has(p.id)) { if (replace) { own.splice(own.findIndex(x => x.id === p.id), 1, p); r.replaced++; } else r.skipped++; } else { own.push(p); r.added++; } }
    await db.kvSet('profiles', own); await loadProfiles(); res.profiles = r;
  }
  if (what.packs && pub.packs) {
    const own = await userPacks(), ids = new Set(own.map(p => p.id)), r = { added: 0, replaced: 0, skipped: 0 };
    for (const p of pub.packs.packs || []) { if (!p || !p.id) continue; if (ids.has(p.id)) { if (replace) { own.splice(own.findIndex(x => x.id === p.id), 1, p); r.replaced++; } else r.skipped++; } else { own.push(p); r.added++; } }
    await db.kvSet('userPacks', own); res.packs = r;
  }
  for (const k of ['documents', 'dialogs', 'conversations', 'sources']) {
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
  log('info', from === 'plik' ? 'dane' : 'github', `Wczytano dane z ${from === 'plik' ? 'pliku' : 'GitHub'} (${replace ? 'zastąp' : 'dodaj brakujące'})`, res);
  return res;
}

// ---------- plik z danymi (bez GitHub) ----------
// { format: 'ai-prawo-dane', version: 1, exportedAt, versions, settings?, documents?, dialogs?, conversations?, sources?, packs? }
// Wczytanie używa tego samego przywracania co GitHub (te same części, dodaj brakujące albo zastąp).
export async function exportData(what) {
  const d = await collect(), out = { format: 'ai-prawo-dane', version: 1, exportedAt: new Date().toISOString(), versions: d.versions };
  for (const k of Object.keys(PARTS)) if (what[k]) out[k] = d[k];
  log('info', 'dane', 'Zapisano dane do pliku: ' + Object.keys(PARTS).filter(k => what[k]).map(k => PARTS[k].label.toLowerCase()).join(', '));
  return out;
}
// plik → ten sam kształt co fetchPublishedData (część: { publishedAt, [część]: … })
export function dataFromFile(o) {
  if (!o || o.format !== 'ai-prawo-dane') throw new Error('To nie jest plik z danymi panelu (format ai-prawo-dane).');
  const pub = {};
  for (const k of Object.keys(PARTS)) if (o[k] != null) pub[k] = k === 'settings' ? { publishedAt: o.exportedAt, settings: o.settings } : { publishedAt: o.exportedAt, [k]: o[k] };
  return pub;
}
