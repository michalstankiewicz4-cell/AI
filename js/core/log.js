// Logi: co i kiedy działo się w panelu, żeby dało się ustalić, w którym momencie coś się popsuło.
// Zapis w IndexedDB (magazyn `logs`), najwyżej MAX wpisów (najstarsze są usuwane). Nic nie trafia na GitHub.
//
// wpis: { id (rosnący w czasie), at, level: 'error'|'warn'|'info'|'debug', area, msg, details, app }

import { db } from './db.js';
import { VERSIONS } from '../version.js';

export const LEVELS = {
  error: { label: 'Błąd', desc: 'coś się nie udało: nauka przerwana błędem, plik nieodczytany, publikacja odrzucona, błąd strony' },
  warn: { label: 'Ostrzeżenie', desc: 'udało się, ale coś wymaga uwagi: źródło niedostępne, ostrzeżenie formatowania, pominięte znaki' },
  info: { label: 'Informacja', desc: 'zwykłe zdarzenia: start panelu, nowy dokument, początek i koniec nauki, publikacja' },
  debug: { label: 'Szczegóły', desc: 'drobiazgi do szukania przyczyn: czasy odpowiedzi czatu, wczytanie modelu do pamięci' },
};
export const MAX = 5000;

const listeners = new Set();
export const onLog = f => { listeners.add(f); return () => listeners.delete(f); };
let seq = 0, writes = 0;

const text = d => {
  if (d == null) return null;
  if (d instanceof Error) return (d.stack || d.message || String(d));
  if (typeof d === 'string') return d;
  try { return JSON.stringify(d, null, 1); } catch (_) { return String(d); }
};

export async function log(level, area, msg, details = null) {
  const at = Date.now();
  const e = { id: at.toString(36).padStart(9, '0') + (seq++ % 1296).toString(36).padStart(2, '0'), at, level: LEVELS[level] ? level : 'info',
    area: area || 'panel', msg: String(msg instanceof Error ? msg.message : msg).slice(0, 1000), details: (text(details) || '').slice(0, 20000) || null, app: VERSIONS.app };
  listeners.forEach(f => { try { f(e); } catch (_) { /* widok logów */ } });
  try { await db.put('logs', e); if (++writes % 100 === 1) await trim(); } catch (_) { /* bez bazy (np. testy w Node) logi tylko w pamięci słuchaczy */ }
  return e;
}
export const logError = (area, msg, details) => log('error', area, msg, details);
export const logWarn = (area, msg, details) => log('warn', area, msg, details);
export const logInfo = (area, msg, details) => log('info', area, msg, details);
export const logDebug = (area, msg, details) => log('debug', area, msg, details);

async function trim() {
  const n = await db.count('logs');
  if (n <= MAX) return;
  const old = (await db.all('logs')).sort((a, b) => a.id < b.id ? -1 : 1).slice(0, n - MAX);
  await db.delMany('logs', old.map(e => e.id));
}
export const listLogs = async () => (await db.all('logs')).sort((a, b) => a.id < b.id ? 1 : -1);
export const clearLogs = () => db.clear('logs');

// Plik tekstowy do wysłania komuś albo przejrzenia poza panelem
export function logsToText(list) {
  const pad = n => String(n).padStart(2, '0');
  const ts = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, '0')}`; };
  return list.slice().reverse().map(e => `${ts(e.at)} [${LEVELS[e.level].label.toUpperCase()}] (${e.area}, v${e.app}) ${e.msg}` + (e.details ? '\n    ' + e.details.replace(/\n/g, '\n    ') : '')).join('\n') + '\n';
}
