// Modele: zapis w bazie, aktywny model czatu, eksport/import pliku i format publikacji.
import { log } from './log.js';
//
// Rekord w bazie (magazyn „models”):
//   { id, name, kind: 'base' | 'chat', parent, createdAt, versions, hp, metrics, data, record }
// record = { hp, chars, tok, tensors: Float32Array[], params } — to, co wczytuje wątek silnika.
// Plik modelu (eksport, GitHub) to ten sam rekord z wagami zakodowanymi w base64; opis w docs/modele.md.

import { db } from './db.js';
import { VERSIONS } from '../version.js';

const listeners = new Set();
export const onModels = f => { listeners.add(f); return () => listeners.delete(f); };
const changed = () => listeners.forEach(f => f());

export async function listModels() { return (await db.all('models')).sort((a, b) => b.createdAt - a.createdAt); }
// Lista bez wag (lżejsza do wyświetlania)
export async function listMeta() { return (await listModels()).map(({ record, ...m }) => ({ ...m, params: record.params })); }
export async function saveModel(m) { await db.put('models', m); changed(); }
export async function deleteModel(id) { const m = await db.get('models', id); log('info', 'modele', `Usunięto model „${m ? m.name : id}”`); await db.del('models', id); if (await getActive() === id) await setActive(null); changed(); }
export async function renameModel(id, name) { const m = await db.get('models', id); m.name = name; await db.put('models', m); changed(); }
export const getActive = () => db.kvGet('activeModel');
export async function setActive(id) { await db.kvSet('activeModel', id); if (id) { const m = await db.get('models', id); log('info', 'modele', `Aktywny model: „${m ? m.name : id}”`); } changed(); }

// kolejna nazwa w rodzaju „Baza 3”, „Rozmowa 5”
export async function nextName(kind) {
  const pre = kind === 'base' ? 'Baza' : 'Rozmowa', all = await listModels();
  const nums = all.filter(m => m.kind === kind).map(m => +(m.name.match(new RegExp('^' + pre + ' (\\d+)$')) || [])[1] || 0);
  return `${pre} ${Math.max(0, ...nums) + 1}`;
}

const b64 = f => { const u = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return new Float32Array(u.buffer); };

export function toFile(m) {
  const { record, ...meta } = m;
  return { format: 'ai-prawo-model', formatVersion: VERSIONS.modelFormat, ...meta, record: { ...record, tensors: record.tensors.map(b64) } };
}
export function fromFile(j) {
  if (!j || j.format !== 'ai-prawo-model') throw new Error('To nie jest plik modelu tego AI.');
  if (j.formatVersion > VERSIONS.modelFormat) throw new Error(`Plik w nowszym formacie (${j.formatVersion}) niż ten panel (${VERSIONS.modelFormat}). Zaktualizuj panel.`);
  if (j.versions && j.versions.engine && j.versions.engine.split('.')[0] !== VERSIONS.engine.split('.')[0]) throw new Error(`Model z innej wersji głównej silnika (${j.versions.engine}); ten panel ma ${VERSIONS.engine}.`);
  const { format, formatVersion, record, ...meta } = j;
  return { ...meta, record: { ...record, tensors: record.tensors.map(unb64) } };
}

// Bity na znak: ile informacji sieć „traci” na każdą literę. Mniej = lepiej. Pozwala porównać litery z tokenami.
export const bitsPerChar = (lossPerToken, cpt) => lossPerToken == null ? null : lossPerToken / Math.LN2 / (cpt || 1);
