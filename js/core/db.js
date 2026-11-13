// Baza w przeglądarce (IndexedDB). Wszystko zostaje na tym komputerze, w tej przeglądarce.
//
// Magazyny:
//   documents     — dokumenty do nauki: surowy tekst, tekst po formatowaniu, raport, wersja reguł
//   dialogs       — rozmowy wzorcowe do dostrajania
//   conversations — rozmowy z czatu (do przeglądania, poprawiania i przenoszenia do rozmów wzorcowych)
//   models        — wytrenowane modele: metadane + wagi (Float32Array)
//   sources       — źródła dokumentów (strony www, API ELI Sejmu) i wyniki ich sprawdzania (Research)
//   kv            — ustawienia i drobne wartości (aktywny model itp.)

import { VERSIONS } from '../version.js';

const NAME = 'ai-prawo';
const STORES = ['documents', 'dialogs', 'conversations', 'models', 'sources'];   // sources: od wersji bazy 2 (Research)
let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => {
    const rq = indexedDB.open(NAME, VERSIONS.db);
    rq.onupgradeneeded = () => {
      const db = rq.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
  return dbp;
}
const tx = async (store, mode, fn) => {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(store, mode), s = t.objectStore(store), r = fn(s);
    t.oncomplete = () => res(r && 'result' in r ? r.result : undefined);
    t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
  });
};

export const db = {
  all: store => tx(store, 'readonly', s => s.getAll()),
  get: (store, id) => tx(store, 'readonly', s => s.get(id)),
  put: (store, obj) => tx(store, 'readwrite', s => s.put(obj)),
  putMany: (store, list) => tx(store, 'readwrite', s => { list.forEach(o => s.put(o)); }),
  del: (store, id) => tx(store, 'readwrite', s => s.delete(id)),
  clear: store => tx(store, 'readwrite', s => s.clear()),
  count: store => tx(store, 'readonly', s => s.count()),
  kvGet: key => tx('kv', 'readonly', s => s.get(key)),
  kvSet: (key, val) => tx('kv', 'readwrite', s => s.put(val, key)),
};

export const uid = (p = '') => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
