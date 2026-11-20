// Grupy kategorii: kategorie (plakietki) dokumentów zebrane w grupy z własnym kolorem, np. „Rodzaj”, „Dziedzina”, „Źródło”, „Stan”.
// Grupy, ich nazwy, kolory i przypisane kategorie zmienia się w Dokumentach („Grupy kategorii”). Kategoria spoza grup trafia do „Inne”.
// Zapis w kv „tagGroups”; bez zapisu obowiązują grupy domyślne.

import { db } from './db.js';
import { log } from './log.js';

export const COLORS = { niebieski: 'blue', zielony: 'green', fioletowy: 'violet', złoty: 'gold', czerwony: 'red', szary: 'gray', turkusowy: 'teal' };
export const DEFAULT_GROUPS = [
  { id: 'rodzaj', name: 'Rodzaj dokumentu', color: 'blue', tags: ['akt prawny', 'orzeczenie', 'wyrok', 'uchwała', 'interpretacja', 'decyzja', 'rekomendacja', 'komentarz', 'doktryna', 'artykuł', 'kazus', 'umowa', 'wzór pisma', 'Wikipedia', 'stenogram Sejmu'] },
  { id: 'dziedzina', name: 'Dziedzina', color: 'violet', tags: ['Prawo pracy', 'Prawo bankowe i kredyty', 'Prawo cywilne', 'kredyty walutowe (CHF)', 'sankcja kredytu darmowego', 'zwrot prowizji'] },
  { id: 'zrodlo', name: 'Źródło', color: 'teal', tags: ['Dziennik Ustaw', 'Monitor Polski', 'KNF', 'SAOS', 'UOKiK', 'Rzecznik Finansowy', 'TSUE', 'Sąd Najwyższy'] },
  { id: 'stan', name: 'Stan', color: 'red', tags: ['nieaktualny', 'stary', 'do przejrzenia', 'sformatowany przez AI'] },
];
const OTHER = { id: 'inne', name: 'Inne', color: 'gray', tags: [] };

let groups = DEFAULT_GROUPS;
let byTag = new Map();
const index = () => { byTag = new Map(); for (const g of groups) for (const t of g.tags) byTag.set(t.toLowerCase(), g); };
index();

export async function loadTagGroups() { const g = await db.kvGet('tagGroups'); if (Array.isArray(g) && g.length) groups = g; index(); return groups; }
export const tagGroups = () => groups;
export const groupOf = tag => byTag.get(String(tag).toLowerCase()) || OTHER;
export const tagColor = tag => groupOf(tag).color;

export async function saveTagGroups(list) {
  const s = v => String(v || '').trim(), seen = new Set();
  groups = list.map((g, i) => ({ id: s(g.id) || 'g' + Date.now().toString(36) + i, name: s(g.name) || 'Grupa', color: Object.values(COLORS).includes(g.color) ? g.color : 'gray',
    tags: (g.tags || []).map(s).filter(t => t && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase())) })).filter(g => g.name);
  index(); await db.kvSet('tagGroups', groups);
  log('info', 'dokumenty', `Zapisano grupy kategorii: ${groups.map(g => `${g.name} (${g.tags.length})`).join(', ')}`);
  return groups;
}
export async function resetTagGroups() { await db.kvSet('tagGroups', null); groups = DEFAULT_GROUPS; index(); }
// przeniesienie kategorii do grupy (null = „Inne”)
export async function moveTag(tag, groupId) {
  const list = groups.map(g => ({ ...g, tags: g.tags.filter(t => t.toLowerCase() !== tag.toLowerCase()) }));
  const g = list.find(x => x.id === groupId); if (g) g.tags.push(tag);
  return saveTagGroups(list);
}
// kategorie pogrupowane: [{ group, items: [[tag, count]] }] w kolejności grup, „Inne” na końcu
export function groupCounts(counts) {
  const out = new Map([...groups, OTHER].map(g => [g.id, { group: g, items: [] }]));
  for (const c of counts) out.get(groupOf(c[0]).id).items.push(c);
  return [...out.values()].filter(x => x.items.length);
}
