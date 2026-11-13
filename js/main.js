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

const PANELS = [dashboard, documents, pretrain, dialogs, finetune, conversations, models, settingsPanel];
let main, nav, cleanup = null, current = null;

export function go(id) { if (location.hash !== '#' + id) location.hash = id; else show(id); }

async function show(id) {
  const p = PANELS.find(x => x.id === id) || PANELS[0];
  if (cleanup) { try { cleanup(); } catch (_) { /* zakładka już zniknęła */ } cleanup = null; }
  current = p.id;
  nav.querySelectorAll('a').forEach(a => a.setAttribute('aria-current', a.dataset.id === p.id ? 'page' : 'false'));
  clear(main);
  const root = h('div.panel-' + p.id); main.append(root);
  document.title = `${p.title} · ${APP_NAME} – panel`;
  try { const r = await p.render(root, () => show(p.id)); if (typeof r === 'function') cleanup = r; }
  catch (e) { console.error(e); root.append(h('p.warnline', 'Błąd zakładki: ' + e.message)); }
  main.focus({ preventScroll: true }); window.scrollTo(0, 0);
}

async function init() {
  await loadSettings();
  nav = h('nav.side', { 'aria-label': 'Zakładki' }, PANELS.map(p => h('a', { href: '#' + p.id, dataset: { id: p.id } }, h('span.i', p.icon), h('span', p.title), p.id === 'nauka' || p.id === 'dostrajanie' ? h('span.jobdot', { hidden: true }) : null)));
  main = h('main.content', { tabIndex: -1 });
  document.body.append(
    h('header.top', h('a.brand', { href: '#pulpit' }, h('span.logo', '§'), h('b', APP_NAME), h('span.ver', 'v' + VERSIONS.app)), h('span.sub', 'panel administracyjny')),
    h('div.layout', nav, main));
  // kropka przy zakładce, w której trwa nauka
  onTraining(() => {
    const k = state.job ? (state.job.kind === 'base' ? 'nauka' : 'dostrajanie') : null;
    nav.querySelectorAll('a').forEach(a => { const d = a.querySelector('.jobdot'); if (d) d.hidden = a.dataset.id !== k; });
    if (!state.job && state.result && current !== (state.result.kind === 'base' ? 'nauka' : 'dostrajanie') && state.result._toast !== true) { state.result._toast = true; toast(`Zakończono: zapisano model „${state.result.name}”.`, 'ok', 6000); }
    if (state.error && !state._errToast) { state._errToast = true; toast('Nauka przerwana: ' + state.error, 'error', 8000); }
  });
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  window.addEventListener('beforeunload', e => { if (state.job) { e.preventDefault(); e.returnValue = ''; } });
  await initChat();
  show(location.hash.slice(1) || 'pulpit');
}

init().catch(e => { console.error(e); document.body.append(h('p.warnline', 'Nie udało się uruchomić panelu: ' + e.message)); });
