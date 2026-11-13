// Panel administracyjny: układ (pasek górny, menu, treść), przełączanie zakładek przez adres (#zakładka) i czat.

import { h, clear, toast } from './ui/dom.js';
import { loadSettings } from './core/settings.js';
import { initChat } from './chat/widget.js';
import { onTraining, state } from './core/training.js';
import { VERSIONS, APP_NAME } from './version.js';

import dashboard from './panels/dashboard.js';
import documents from './panels/documents.js';
import pretrain from './panels/pretrain.js';
import dialogs from './panels/dialogs.js';
import finetune from './panels/finetune.js';
import conversations from './panels/conversations.js';
import models from './panels/models.js';
import settingsPanel from './panels/settings.js';
import formatting from './panels/formatting.js';
import helpPanel from './panels/help.js';
import research from './panels/research.js';
import logsPanel from './panels/logs.js';
import { logInfo, logError } from './core/log.js';

const PANELS = [dashboard, research, documents, formatting, pretrain, dialogs, finetune, conversations, models, settingsPanel, logsPanel, helpPanel];
let main, nav, cleanup = null, current = null;

// Adres: #zakładka albo #zakładka/argument (np. #pomoc/formatowanie, #formatowanie/<id dokumentu>)
export function go(id) { if (location.hash !== '#' + id) location.hash = id; else show(id); }

async function show(route) {
  const [id, ...rest] = (route || '').split('/'), arg = rest.join('/') || null;
  const p = PANELS.find(x => x.id === id) || PANELS[0];
  document.querySelectorAll('dialog[open]').forEach(d => d.close());   // przejście z okna (np. kliknięcie [?]) zamyka je
  if (cleanup) { try { cleanup(); } catch (_) { /* zakładka już zniknęła */ } cleanup = null; }
  current = p.id;
  nav.querySelectorAll('a').forEach(a => a.setAttribute('aria-current', a.dataset.id === p.id ? 'page' : 'false'));
  clear(main);
  const root = h('div.panel-' + p.id); main.append(root);
  document.title = `${p.title} · ${APP_NAME} – panel`;
  try { const r = await p.render(root, () => show(route), arg); if (typeof r === 'function') cleanup = r; }
  catch (e) { console.error(e); root.append(h('p.warnline', 'Błąd zakładki: ' + e.message)); }
  main.focus({ preventScroll: true }); window.scrollTo(0, 0);
}

// Przełącznik dzień/noc: zapamiętany w tej przeglądarce; bez wyboru panel bierze motyw systemu
function themeButton() {
  const root = document.documentElement;
  const b = h('button.themebtn', { type: 'button', onclick: () => {
    const t = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = t; try { localStorage.setItem('ai-prawo.theme', t); } catch (_) { /* bez localStorage */ }
    set(); window.dispatchEvent(new Event('themechange'));
  } });
  const set = () => { const dark = root.dataset.theme === 'dark'; b.textContent = dark ? '☀' : '☾'; b.title = dark ? 'Włącz jasny motyw (dzień)' : 'Włącz ciemny motyw (noc)'; b.setAttribute('aria-label', b.title); };
  set();
  return b;
}

// błędy strony, których nikt nie złapał – do Logów
window.addEventListener('error', e => logError('strona', e.message || 'Błąd strony', [e.filename && `${e.filename}:${e.lineno}:${e.colno}`, e.error && e.error.stack].filter(Boolean).join('\n')));
window.addEventListener('unhandledrejection', e => { const r = e.reason; logError('strona', 'Nieobsłużony błąd: ' + (r && r.message ? r.message : String(r)), r && r.stack); });

async function init() {
  await loadSettings();
  logInfo('panel', `Uruchomienie panelu, wersja ${VERSIONS.app}`, { wersje: VERSIONS, przegladarka: navigator.userAgent, adres: location.pathname + location.hash });
  // grupy kolorów w menu: 2 = Dokumenty, Formatowanie i Nauka (fioletowy), 3 = Rozmowy wzorcowe i Dostrajanie (zielony)
  const STAGE = { 2: 'Dokumenty, formatowanie i nauka języka', 3: 'Rozmowy wzorcowe i nauka odpowiadania' };
  nav = h('nav.side', { 'aria-label': 'Zakładki' }, PANELS.map(p => h('a' + (p.stage ? '.stage' + p.stage : ''), { href: '#' + p.id, dataset: { id: p.id }, title: p.stage ? STAGE[p.stage] : null }, h('span.i', p.icon), h('span', p.title), p.id === 'nauka' || p.id === 'dostrajanie' ? h('span.jobdot', { hidden: true }) : null)));
  main = h('main.content', { tabIndex: -1 });
  document.body.append(
    h('header.top', h('a.brand', { href: '#pulpit' }, h('span.logo', '§'), h('b', APP_NAME), h('span.ver', 'v' + VERSIONS.app)), h('span.sub', 'panel administracyjny'), h('span.sp'), themeButton()),
    h('div.layout', nav, main));
  // kropka przy zakładce, w której trwa nauka
  onTraining(() => {
    const k = state.job ? (state.job.kind === 'base' ? 'nauka' : 'dostrajanie') : null;
    nav.querySelectorAll('a').forEach(a => { const d = a.querySelector('.jobdot'); if (d) d.hidden = a.dataset.id !== k; });
    if (!state.job && state.result && current !== (state.result.kind === 'base' ? 'nauka' : 'dostrajanie') && state.result._toast !== true) { state.result._toast = true; toast(`Zakończono: zapisano model „${state.result.name}”.`, 'ok', 6000); }
    if (state.error && !state._errToast) { state._errToast = true; toast('Nauka przerwana: ' + state.error, 'error', 8000, { log: false }); }
  });
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  window.addEventListener('datachange', () => show(location.hash.slice(1)));
  window.addEventListener('beforeunload', e => { if (state.job) { e.preventDefault(); e.returnValue = ''; } });
  await initChat();
  show(location.hash.slice(1) || 'pulpit');
}

init().catch(e => { console.error(e); document.body.append(h('p.warnline', 'Nie udało się uruchomić panelu: ' + e.message)); });
