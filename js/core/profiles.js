// Profile: osobny przebieg pracy dla jednej dziedziny (np. „Prawo pracy”) na wspólnej bibliotece.
// Profil wybiera się na Pulpicie; „Wszystkie profile” (brak profilu) = cała biblioteka i ustawienia ogólne.
//
// profil: { id, name, description, tags: [kategorie], general: true (tekst ogólny też należy do profilu),
//           template: 'mala' | 'srednia' | 'duza', settings: { pretrain, finetune }, activeModel, createdAt }
// Dokument / rozmowa należy do profilu, gdy ma choć jedną z jego kategorii (albo jest tekstem ogólnym).
// Przełączenie profilu zapisuje bieżące ustawienia nauki i dostrajania oraz aktywny model w poprzednim profilu
// (albo w „Wszystkich profilach”) i wczytuje te z wybranego – reszta panelu działa bez zmian.

import { db, uid } from './db.js';
import { log } from './log.js';
import { settings, saveSettings, defaults } from './settings.js';

// gotowe szablony sieci (jeszcze niewyuczone) – parametry nauki na dokumentach
export const TEMPLATES = {
  mala: { label: 'Mała', note: 'ok. 1 mln parametrów; minuty nauki; na start i do sprawdzania danych', pretrain: { unit: 'bpe1024', layers: 4, dim: 128, heads: 4, ctx: 128, steps: 4000, lr: .003 } },
  srednia: { label: 'Średnia', note: 'ok. 3–4 mln parametrów; kilkadziesiąt minut na GPU; dziedzina z kilkoma MB tekstu', pretrain: { unit: 'bpe2048', layers: 6, dim: 192, heads: 4, ctx: 256, steps: 8000, lr: .003 } },
  duza: { label: 'Duża', note: 'ok. 7–8 mln parametrów; godziny na GPU (np. RTX 3050); dużo tekstu i rozmów', pretrain: { unit: 'bpe2048', layers: 8, dim: 256, heads: 8, ctx: 256, steps: 16000, lr: .001 } },
};
const GROUPS = ['pretrain', 'finetune'];
const clone = o => JSON.parse(JSON.stringify(o));

let cache = { list: [], active: null };
const listeners = new Set();
export const onProfile = f => { listeners.add(f); return () => listeners.delete(f); };
const emit = () => listeners.forEach(f => { try { f(cache.active); } catch (_) { /* widok */ } });

export async function loadProfiles() {
  cache.list = (await db.kvGet('profiles')) || [];
  const id = await db.kvGet('activeProfile');
  cache.active = cache.list.find(p => p.id === id) || null;
  return cache;
}
export const listProfiles = () => cache.list;
export const activeProfile = () => cache.active;
const persist = () => db.kvSet('profiles', cache.list);

// czy dokument / rozmowa / model należy do profilu (bez profilu: wszystko)
export function inProfile(rec, p = cache.active) {
  if (!p) return true;
  if (rec.profileId && rec.profileId === p.id) return true;
  const t = rec.tags || [];
  return p.tags.some(x => t.includes(x)) || (p.general !== false && !!rec.general);
}
export const profileTags = () => cache.active ? [...cache.active.tags] : [];

export async function saveProfile(p) {
  const s = v => String(v || '').trim();
  const n = { id: p.id || uid('p_'), name: s(p.name) || 'Profil', description: s(p.description), tags: [...new Set((p.tags || []).map(s).filter(Boolean))],
    general: p.general !== false, template: TEMPLATES[p.template] ? p.template : 'mala', settings: p.settings || null, activeModel: p.activeModel || null, createdAt: p.createdAt || Date.now() };
  if (!n.settings) { const d = defaults(); n.settings = { pretrain: { ...clone(settings().pretrain || d.pretrain), ...TEMPLATES[n.template].pretrain }, finetune: clone(settings().finetune || d.finetune) }; }
  const i = cache.list.findIndex(x => x.id === n.id);
  if (i >= 0) cache.list[i] = { ...cache.list[i], ...n, settings: cache.list[i].settings && !p.settings ? cache.list[i].settings : n.settings }; else cache.list.push(n);
  await persist();
  if (cache.active && cache.active.id === n.id) { cache.active = cache.list.find(x => x.id === n.id); emit(); }
  log('info', 'profile', `Zapisano profil „${n.name}” (kategorie: ${n.tags.join(', ') || '–'})`);
  return cache.list.find(x => x.id === n.id);
}

// szablon sieci w profilu: nadpisuje budowę sieci i liczbę kroków w ustawieniach nauki profilu
export async function applyTemplate(id, template) {
  const p = cache.list.find(x => x.id === id); if (!p || !TEMPLATES[template]) return;
  p.template = template; p.settings.pretrain = { ...p.settings.pretrain, ...TEMPLATES[template].pretrain };
  await persist();
  if (cache.active && cache.active.id === id) { const s = settings(); Object.assign(s.pretrain, TEMPLATES[template].pretrain); await saveSettings(s); }
}

export async function deleteProfile(id) {
  if (cache.active && cache.active.id === id) await setActiveProfile(null);
  const p = cache.list.find(x => x.id === id);
  cache.list = cache.list.filter(x => x.id !== id); await persist();
  if (p) log('info', 'profile', `Usunięto profil „${p.name}” (dokumenty, rozmowy i modele zostają)`);
}

// Przełączenie: zapamiętaj ustawienia nauki/dostrajania i aktywny model bieżącego profilu, wczytaj z wybranego.
export async function setActiveProfile(id, { setActiveModel } = {}) {
  const s = settings(), curModel = await db.kvGet('activeModel');
  const snap = { pretrain: clone(s.pretrain), finetune: clone(s.finetune) };
  if (cache.active) { const c = cache.list.find(x => x.id === cache.active.id); if (c) { c.settings = snap; c.activeModel = curModel || null; } await persist(); }
  else await db.kvSet('profileAll', { settings: snap, activeModel: curModel || null });
  const next = id ? cache.list.find(x => x.id === id) : null;
  const slot = next || (await db.kvGet('profileAll')) || null;
  if (slot && slot.settings) { for (const g of GROUPS) s[g] = { ...defaults()[g], ...slot.settings[g] }; await saveSettings(s); }
  cache.active = next; await db.kvSet('activeProfile', next ? next.id : null);
  const model = slot ? slot.activeModel || null : null;
  if (setActiveModel) await setActiveModel(model); else await db.kvSet('activeModel', model);
  log('info', 'profile', next ? `Wybrano profil „${next.name}”` : 'Wybrano: wszystkie profile');
  emit();
  return next;
}

// dane do pliku / publikacji
export async function profilesData() { return (await db.kvGet('profiles')) || []; }
